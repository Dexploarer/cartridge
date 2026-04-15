import {
	type PlatformEventEnvelope,
	type PlatformEventMap,
	GameSessionManager,
	createDefaultAppRegistry,
	type AppCatalogSummary,
	type EnqueueCommandInput,
	type GameSessionRecord,
	type ResolveCommandInput,
} from "@cartridge/app-platform";
import {
	BRANDING_PROFILE,
	PRIMARY_GAME_APPS,
	type BrandingProfile,
	type GameAppManifest,
	type Persona,
	type SessionLaunchInput,
} from "@cartridge/shared";
import { clone, createId, isoNow, trimHistory } from "@cartridge/shared";

import { buildAiPlaneState, getEffectiveElizaToken } from "./ai-plane";
import type { AiPlaneState } from "./ai-plane-types";
import { type AiProbeBundle, runAllAiProbes } from "./ai-plane-probe";
import { mergeBrandingFromEnv } from "./branding-env";
import { fetchRemoteDataPlane } from "./data-plane-remote";
import { TypedEventBus, type TypedEventEnvelope } from "./events";
import type { KnowledgeDocument, DataStoreRecord } from "./state-types";

export type { KnowledgeDocument, DataStoreRecord } from "./state-types";
export type {
	AiPlaneState,
	AiLinkStatus,
	ElizaCloudSlice,
	ExternalApiSlice,
	LocalModelSlice,
} from "./ai-plane-types";

export type RuntimeLocation = "local" | "cloud" | "hybrid";
export type ChatChannel = "ops" | "game" | "support" | "stream" | "system";
export type ChatThreadKind = "ops" | "game" | "support" | "stream";
export type ConnectorMode = "community" | "audience" | "ops";
export type ConnectorStatus = "connected" | "degraded" | "planned";
export type AgentStatus =
	| "ready"
	| "in-game"
	| "streaming"
	| "building"
	| "watching";
export type StreamStatus = "live" | "standby" | "offline";
export type PiPScreenState = "live" | "watching" | "idle";

export type RuntimeConfig = {
	runtimeId: string;
	brandingProfile: BrandingProfile;
	runtimeLocation: RuntimeLocation;
	connectorBundle: string[];
	streamingDestinations: string[];
	featureFlags: {
		wallet: boolean;
		cloud: boolean;
		connectors: boolean;
		streaming: boolean;
		codingSwarm: boolean;
	};
};

export type RuntimeSnapshot = {
	runtimeId: string;
	brandId: string;
	appName: string;
	runtimeLocation: RuntimeLocation;
	cloudEnabled: boolean;
	walletEnabled: boolean;
	connectorCount: number;
	streamingDestinationCount: number;
	totalSurfaceCount: number;
	activeSessionCount: number;
	totalSessionCount: number;
	bootedAt: string | null;
	/** Last remote data-plane sync error, if any. */
	dataPlaneSyncError: string | null;
};

export type AgentProfile = {
	agentId: string;
	displayName: string;
	persona: Persona;
	role: string;
	status: AgentStatus;
	homeAppId: string | null;
	currentAppId: string | null;
	activeSessionId: string | null;
	streamDestination: string | null;
	summary: string;
	capabilities: string[];
	threadIds: string[];
};

export type ChatMessage = {
	messageId: string;
	threadId: string;
	author: string;
	body: string;
	channel: ChatChannel;
	appId: string | null;
	sessionId: string | null;
	sentAt: string;
};

export type ChatThread = {
	threadId: string;
	title: string;
	kind: ChatThreadKind;
	appId: string | null;
	summary: string;
	participants: string[];
	lastActivityAt: string;
	messages: ChatMessage[];
};

export type ConnectorState = {
	connectorId: string;
	label: string;
	mode: ConnectorMode;
	status: ConnectorStatus;
	channels: string[];
	latencyMs: number;
};

export type StreamDestinationState = {
	destinationId: string;
	label: string;
	status: StreamStatus;
	destinationType: "platform" | "rtmp";
	appId: string | null;
	sessionId: string | null;
	scene: string;
	outputLabel: string;
	viewerCount: number;
};

export type PiPScreen = {
	screenId: string;
	title: string;
	subtitle: string;
	state: PiPScreenState;
	sourceType: "game-session" | "support-session" | "stream" | "agent";
	appId: string | null;
	sessionId: string | null;
	focus: string;
	metrics: Array<{ label: string; value: string }>;
};

/** Main-window embed session; uses `viewer: "embedded"`. */
export type ShellEmbedState = {
	sessionId: string;
	appId: string;
	displayName: string;
	/** Manifest launch URL. */
	embedUrl: string;
	persona: Persona;
	/** Two-pane split play uses separate webview partitions. */
	splitPlay: boolean;
};

export type RuntimeState = {
	runtime: RuntimeSnapshot;
	catalog: AppCatalogSummary;
	sessions: GameSessionRecord[];
	agents: AgentProfile[];
	chatThreads: ChatThread[];
	connectors: ConnectorState[];
	streams: StreamDestinationState[];
	pipScreens: PiPScreen[];
	knowledge: KnowledgeDocument[];
	dataStores: DataStoreRecord[];
	/** AI provider state for cloud, external, and local models. */
	aiPlane: AiPlaneState;
	/** Active shell embed session. */
	shellEmbed: ShellEmbedState | null;
};

export type CartridgeRuntimeEventMap = PlatformEventMap & {
	"runtime.booted": RuntimeSnapshot;
	"cloud.state.changed": {
		runtimeLocation: RuntimeLocation;
		cloudEnabled: boolean;
	};
};

export type SendChatMessageInput = {
	threadId?: string;
	author: string;
	body: string;
	channel?: ChatChannel;
	appId?: string | null;
	sessionId?: string | null;
};

type AgentSeed = {
	agentId: string;
	displayName: string;
	persona: Persona;
	role: string;
	homeAppId: string | null;
	idleSummary: string;
	capabilities: string[];
};

const DEFAULT_CONNECTOR_BUNDLE = ["discord", "twitch", "telegram"];
const DEFAULT_STREAMING_DESTINATIONS = [
	"twitch",
	"youtube",
	"x",
	"custom-rtmp",
];
const MAX_THREAD_MESSAGES = 32;
const OPS_THREAD_ID = "ops-bridge";
const STREAM_THREAD_ID = "stream-control";

const BASE_AGENT_SEEDS: AgentSeed[] = [
	{
		agentId: "oracle-relay",
		displayName: "Oracle Relay",
		persona: "agent-gamer",
		role: "Babylon market pilot",
		homeAppId: "babylon",
		idleSummary: "Waiting for a Babylon market to open.",
		capabilities: ["prediction-market", "crowd-signal", "wallet-routing"],
	},
	{
		agentId: "claw-captain",
		displayName: "Claw Captain",
		persona: "agent-gamer",
		role: "ClawVille world navigator",
		homeAppId: "clawville",
		idleSummary: "Watching the ClawVille world state and social graph.",
		capabilities: ["world-nav", "skill-learning", "party-rally"],
	},
	{
		agentId: "lane-marshal",
		displayName: "Lane Marshal",
		persona: "agent-gamer",
		role: "Defense of the Agents shot-caller",
		homeAppId: "defense-of-the-agents",
		idleSummary: "Ready to call tactical lanes and queue commands.",
		capabilities: ["lane-control", "tactics", "command-queue"],
	},
	{
		agentId: "scape-runner",
		displayName: "Scape Runner",
		persona: "agent-gamer",
		role: "Scape autonomy runner",
		homeAppId: "scape",
		idleSummary: "Maintaining idle loop state for long-form Scape runs.",
		capabilities: ["autonomy-loop", "journaling", "operator-steering"],
	},
	{
		agentId: "swarm-forge",
		displayName: "Swarm Forge",
		persona: "dev-gamer",
		role: "Coding swarm orchestrator",
		homeAppId: "coding",
		idleSummary: "Standing by to route dev-gamer swarm work.",
		capabilities: ["multi-agent", "pty", "artifact-retention"],
	},
	{
		agentId: "steward-keeper",
		displayName: "Steward Keeper",
		persona: "user-gamer",
		role: "Approval and wallet sentinel",
		homeAppId: "steward",
		idleSummary: "Monitoring wallet approvals and value-moving actions.",
		capabilities: ["wallet-review", "identity-state", "policy-gates"],
	},
	{
		agentId: "companion-director",
		displayName: "Companion Director",
		persona: "agent-gamer",
		role: "Avatar and presence director",
		homeAppId: "companion",
		idleSummary: "Maintaining presence, voice, and overlay continuity.",
		capabilities: ["avatar", "presence", "overlay-control"],
	},
];

function getThreadIdForApp(appId: string): string {
	return `${appId}-bridge`;
}

function createSeedThreads(
	apps: GameAppManifest[],
	appName: string,
): ChatThread[] {
	const now = isoNow();
	const seedMessage = (threadId: string, body: string): ChatMessage => ({
		messageId: createId("message"),
		threadId,
		author: "System",
		body,
		channel: "system",
		appId: null,
		sessionId: null,
		sentAt: now,
	});

	const opsThread: ChatThread = {
		threadId: OPS_THREAD_ID,
		title: "Ops Bridge",
		kind: "ops",
		appId: null,
		summary: "Cross-surface operator coordination and alerts.",
		participants: ["System", `${appName} Ops`],
		lastActivityAt: now,
		messages: [
			seedMessage(
				OPS_THREAD_ID,
				`Cartridge operator mesh online for ${appName}. Knowledge index, data plane, agents, and monitors are wired.`,
			),
		],
	};

	const streamThread: ChatThread = {
		threadId: STREAM_THREAD_ID,
		title: "Stream Control",
		kind: "stream",
		appId: null,
		summary: "Live stream routing, overlays, and audience hooks.",
		participants: ["System", "Creator Ops"],
		lastActivityAt: now,
		messages: [
			seedMessage(
				STREAM_THREAD_ID,
				"Streaming destinations are provisioned for Twitch, YouTube, X, and RTMP.",
			),
		],
	};

	const appThreads = apps.map((app) => {
		const threadId = getThreadIdForApp(app.appId);
		return {
			threadId,
			title: `${app.displayName} Bridge`,
			kind: app.category === "game" ? "game" : "support",
			appId: app.appId,
			summary: app.summary,
			participants: ["System", app.displayName],
			lastActivityAt: now,
			messages: [
				{
					...seedMessage(
						threadId,
						`${app.displayName} is wired into chat, agent control, and monitoring.`,
					),
					appId: app.appId,
				},
			],
		} satisfies ChatThread;
	});

	return [opsThread, streamThread, ...appThreads];
}

function channelFromThreadKind(kind: ChatThreadKind): ChatChannel {
	switch (kind) {
		case "game":
			return "game";
		case "support":
			return "support";
		case "stream":
			return "stream";
		default:
			return "ops";
	}
}

function compareIsoDesc(left: string, right: string): number {
	return right.localeCompare(left);
}

function latestSessionByAppId(
	sessions: GameSessionRecord[],
	appId: string,
): GameSessionRecord | null {
	return (
		sessions.find(
			(session) =>
				session.appId === appId &&
				(session.status === "active" || session.status === "paused"),
		) ?? null
	);
}

function latestSessionMetric(
	session: GameSessionRecord,
	index: number,
	fallbackLabel: string,
	fallbackValue: string,
): { label: string; value: string } {
	const telemetry = session.telemetry[session.telemetry.length - 1 - index];
	if (!telemetry) {
		return { label: fallbackLabel, value: fallbackValue };
	}

	return { label: telemetry.label, value: telemetry.value };
}

export function resolveRuntimeConfig(
	overrides: Partial<RuntimeConfig> = {},
): RuntimeConfig {
	return {
		runtimeId: overrides.runtimeId ?? "cartridge-local-runtime",
		brandingProfile: mergeBrandingFromEnv(overrides.brandingProfile ?? BRANDING_PROFILE),
		runtimeLocation: overrides.runtimeLocation ?? "local",
		connectorBundle: overrides.connectorBundle ?? DEFAULT_CONNECTOR_BUNDLE,
		streamingDestinations:
			overrides.streamingDestinations ?? DEFAULT_STREAMING_DESTINATIONS,
		featureFlags: {
			wallet: overrides.featureFlags?.wallet ?? true,
			cloud: overrides.featureFlags?.cloud ?? true,
			connectors: overrides.featureFlags?.connectors ?? true,
			streaming: overrides.featureFlags?.streaming ?? true,
			codingSwarm: overrides.featureFlags?.codingSwarm ?? true,
		},
	};
}

export class CartridgeRuntime {
	private readonly config: RuntimeConfig;
	private readonly registry = createDefaultAppRegistry();
	private readonly bus = new TypedEventBus<CartridgeRuntimeEventMap>();
	private readonly sessions = new GameSessionManager(
		{
			getApp: (appId) => this.registry.getApp(appId),
			getOperatorSurface: (appId) => this.registry.getOperatorSurface(appId),
		},
		(event) => this.handlePlatformEvent(event),
	);
	private readonly chatThreads = new Map<string, ChatThread>();
	private bootedAt: string | null = null;
	private remoteKnowledge: KnowledgeDocument[] | null = null;
	private remoteDataStores: DataStoreRecord[] | null = null;
	private remoteDataPlaneError: string | null = null;
	private elizaCloudTokenOverride: string | null = null;
	private activeAiProviderId: string | null = null;
	private activeAiModelId: string | null = null;
	private aiProbeCache: AiProbeBundle | null = null;
	private aiProbeAt: string | null = null;
	private aiProbeAggregateError: string | null = null;
	/** Current shell-embed session id. */
	private shellEmbedSessionId: string | null = null;
	/** Whether the shell embed is split into two panes. */
	private shellEmbedSplitPlay = false;

	constructor(overrides: Partial<RuntimeConfig> = {}) {
		this.config = resolveRuntimeConfig(overrides);
		for (const thread of createSeedThreads(
			this.registry.listApps(),
			this.config.brandingProfile.appName,
		)) {
			this.chatThreads.set(thread.threadId, thread);
		}
	}

	boot(): RuntimeSnapshot {
		if (!this.bootedAt) {
			this.bootedAt = isoNow();
			this.bus.emit("runtime.booted", this.getSnapshot());
			this.bus.emit("cloud.state.changed", {
				runtimeLocation: this.config.runtimeLocation,
				cloudEnabled: this.config.featureFlags.cloud,
			});
		}

		return this.getSnapshot();
	}

	subscribe<K extends keyof CartridgeRuntimeEventMap>(
		type: K,
		handler: (
			payload: CartridgeRuntimeEventMap[K],
			envelope: TypedEventEnvelope<CartridgeRuntimeEventMap, K>,
		) => void,
	): () => void {
		return this.bus.subscribe(type, handler);
	}

	getEventHistory(): Array<TypedEventEnvelope<CartridgeRuntimeEventMap>> {
		return this.bus.getHistory();
	}

	getConfig(): RuntimeConfig {
		return clone(this.config);
	}

	getSnapshot(): RuntimeSnapshot {
		return {
			runtimeId: this.config.runtimeId,
			brandId: this.config.brandingProfile.brandId,
			appName: this.config.brandingProfile.appName,
			runtimeLocation: this.config.runtimeLocation,
			cloudEnabled: this.config.featureFlags.cloud,
			walletEnabled: this.config.featureFlags.wallet,
			connectorCount: this.config.connectorBundle.length,
			streamingDestinationCount: this.config.streamingDestinations.length,
			totalSurfaceCount: this.registry.listApps().length,
			activeSessionCount: this.sessions.listActiveSessions().length,
			totalSessionCount: this.sessions.listSessions().length,
			bootedAt: this.bootedAt,
			dataPlaneSyncError: this.remoteDataPlaneError,
		};
	}

	/** Refresh remote knowledge and data stores from configured HTTP APIs. */
	async refreshDataPlaneFromApis(): Promise<void> {
		const result = await fetchRemoteDataPlane();
		this.remoteKnowledge = result.knowledge;
		this.remoteDataStores = result.dataStores;
		this.remoteDataPlaneError = result.error;
	}

	/** Refresh AI provider probes. */
	async refreshAiPlaneProbes(): Promise<void> {
		try {
			const token = getEffectiveElizaToken(this.elizaCloudTokenOverride);
			const bundle = await runAllAiProbes(this.config.brandingProfile, token);
			this.aiProbeCache = bundle;
			this.aiProbeAt = isoNow();
			this.aiProbeAggregateError = null;
		} catch (e) {
			this.aiProbeAggregateError = e instanceof Error ? e.message : String(e);
		}
	}

	/** Set a process-local Eliza token override. */
	setElizaCloudSessionToken(token: string | null): void {
		this.elizaCloudTokenOverride = token;
	}

	clearElizaCloudSession(): void {
		this.elizaCloudTokenOverride = null;
	}

	/** Set the active AI provider and model. */
	setActiveAiModel(providerId: string | null, modelId: string | null): void {
		this.activeAiProviderId = providerId;
		this.activeAiModelId = modelId;
	}

	private buildAiPlane(): AiPlaneState {
		return buildAiPlaneState(this.config.brandingProfile, {
			elizaTokenOverride: this.elizaCloudTokenOverride,
			activeProviderId: this.activeAiProviderId,
			activeModelId: this.activeAiModelId,
			lastProbe: this.aiProbeCache,
			lastProbeAt: this.aiProbeAt,
			aggregateProbeError: this.aiProbeAggregateError,
		});
	}

	getRuntimeState(): RuntimeState {
		const sessions = this.sessions.listSessions();
		const connectors = this.buildConnectors();
		const streams = this.buildStreams(sessions);
		const agents = this.buildAgents(sessions, streams);
		const chatThreads = [...this.chatThreads.values()]
			.sort((left, right) => compareIsoDesc(left.lastActivityAt, right.lastActivityAt))
			.map((thread) => clone(thread));

		return {
			runtime: this.getSnapshot(),
			catalog: this.registry.getCatalogSummary(),
			sessions,
			agents,
			chatThreads,
			connectors,
			streams,
			pipScreens: this.buildPiPScreens(sessions, agents, streams, chatThreads),
			knowledge: this.buildKnowledgeIndex(sessions, agents),
			dataStores: this.buildDataStores(),
			aiPlane: this.buildAiPlane(),
			shellEmbed: this.buildShellEmbed(sessions),
		};
	}

	private buildShellEmbed(sessions: GameSessionRecord[]): ShellEmbedState | null {
		if (!this.shellEmbedSessionId) {
			return null;
		}
		const session = sessions.find((s) => s.sessionId === this.shellEmbedSessionId);
		if (!session || session.status === "ended") {
			this.shellEmbedSessionId = null;
			this.shellEmbedSplitPlay = false;
			return null;
		}
		const surface = this.getSurface(session.appId);
		const embedUrl = surface?.launchUrl?.trim() || "about:blank";
		return {
			sessionId: session.sessionId,
			appId: session.appId,
			displayName: session.displayName,
			embedUrl,
			persona: session.persona,
			splitPlay: this.shellEmbedSplitPlay,
		};
	}

	/** Launch a surface in the main-shell embed, replacing any existing session. */
	launchSurfaceInShell(input: {
		appId: string;
		persona: Persona;
		/** Enables two-pane split play with separate webview partitions. */
		splitPlay?: boolean;
	}): GameSessionRecord {
		this.boot();
		if (this.shellEmbedSessionId) {
			const prev = this.shellEmbedSessionId;
			this.shellEmbedSessionId = null;
			this.shellEmbedSplitPlay = false;
			this.endSession(prev, "Replaced by new shell embed");
		}
		const session = this.launchSurface({
			appId: input.appId,
			persona: input.persona,
			launchedFrom: "desktop-main",
			viewer: "embedded",
		});
		this.shellEmbedSessionId = session.sessionId;
		this.shellEmbedSplitPlay = input.splitPlay === true;
		return session;
	}

	/** End the current shell embed session. */
	clearShellEmbed(): void {
		if (!this.shellEmbedSessionId) {
			return;
		}
		const id = this.shellEmbedSessionId;
		this.shellEmbedSessionId = null;
		this.shellEmbedSplitPlay = false;
		this.endSession(id, "Shell embed closed");
	}

	listLaunchableSurfaces(persona?: Persona): GameAppManifest[] {
		return persona
			? this.registry.listAppsForPersona(persona)
			: this.registry.listApps();
	}

	getSurface(appId: string): GameAppManifest | null {
		return this.registry.getApp(appId);
	}

	getOperatorSurface(appId: string) {
		return this.registry.getOperatorSurface(appId);
	}

	getPreferredThreadId(appId: string | null): string {
		if (!appId) {
			return OPS_THREAD_ID;
		}

		const threadId = getThreadIdForApp(appId);
		return this.chatThreads.has(threadId) ? threadId : OPS_THREAD_ID;
	}

	launchSurface(input: SessionLaunchInput): GameSessionRecord {
		this.boot();
		const session = this.sessions.startSession(input);
		this.sendChatMessage({
			threadId: this.getPreferredThreadId(input.appId),
			author: "System",
			body: `${session.displayName} launched for ${input.persona} via ${input.launchedFrom}.`,
			channel: this.getSurface(input.appId)?.category === "game" ? "game" : "support",
			appId: input.appId,
			sessionId: session.sessionId,
		});
		return session;
	}

	appendTelemetry(
		sessionId: string,
		frames: Parameters<GameSessionManager["appendTelemetry"]>[1],
	): GameSessionRecord {
		return this.sessions.appendTelemetry(sessionId, frames);
	}

	enqueueOperatorCommand(
		sessionId: string,
		input: EnqueueCommandInput,
	) {
		return this.sessions.enqueueCommand(sessionId, input);
	}

	markCommandResolved(
		sessionId: string,
		input: ResolveCommandInput,
	): GameSessionRecord {
		return this.sessions.resolveCommand(sessionId, input);
	}

	pauseSession(sessionId: string, note?: string): GameSessionRecord {
		const session = this.sessions.pauseSession(sessionId, note);
		this.sendChatMessage({
			appId: session.appId,
			sessionId,
			author: "System",
			body: `${session.displayName} paused${note ? `: ${note}` : "."}`,
			channel: "ops",
		});
		return session;
	}

	resumeSession(sessionId: string, note?: string): GameSessionRecord {
		const session = this.sessions.resumeSession(sessionId, note);
		this.sendChatMessage({
			appId: session.appId,
			sessionId,
			author: "System",
			body: `${session.displayName} resumed${note ? `: ${note}` : "."}`,
			channel: "ops",
		});
		return session;
	}

	addSessionNote(sessionId: string, note: string): GameSessionRecord {
		return this.sessions.addSessionNote(sessionId, note);
	}

	endSession(sessionId: string, note?: string): GameSessionRecord {
		const liveSession = this.sessions.getSession(sessionId);
		const ended = this.sessions.endSession(sessionId, note);
		if (liveSession) {
			this.sendChatMessage({
				appId: liveSession.appId,
				sessionId,
				author: "System",
				body: `${liveSession.displayName} session ended${note ? `: ${note}` : "."}`,
				channel: "ops",
			});
		}
		return ended;
	}

	sendChatMessage(input: SendChatMessageInput): ChatThread {
		const thread = this.resolveThread(input.threadId, input.appId ?? null);
		const message: ChatMessage = {
			messageId: createId("message"),
			threadId: thread.threadId,
			author: input.author,
			body: input.body,
			channel: input.channel ?? channelFromThreadKind(thread.kind),
			appId: input.appId ?? thread.appId,
			sessionId: input.sessionId ?? null,
			sentAt: isoNow(),
		};

		thread.messages = trimHistory(
			[...thread.messages, message],
			MAX_THREAD_MESSAGES,
		);
		thread.lastActivityAt = message.sentAt;
		thread.participants = [...new Set([...thread.participants, input.author])];
		this.chatThreads.set(thread.threadId, thread);
		return clone(thread);
	}

	routeWorkspaceMessage(
		sessionId: string,
		author: string,
		body: string,
	): ChatThread {
		const session = this.sessions.getSession(sessionId);
		if (!session) {
			throw new Error(`Unknown session for workspace routing: ${sessionId}`);
		}

		return this.sendChatMessage({
			appId: session.appId,
			sessionId,
			author,
			body,
			channel:
				this.getSurface(session.appId)?.category === "game" ? "game" : "support",
		});
	}

	private resolveThread(
		threadId?: string,
		appId?: string | null,
	): ChatThread {
		const resolvedThreadId =
			threadId ?? (appId ? this.getPreferredThreadId(appId) : OPS_THREAD_ID);
		const existing = this.chatThreads.get(resolvedThreadId);
		if (existing) {
			return existing;
		}

		const app = appId ? this.registry.getApp(appId) : null;
		const now = isoNow();
		const thread: ChatThread = {
			threadId: resolvedThreadId,
			title: app ? `${app.displayName} Bridge` : "Ops Bridge",
			kind: app ? (app.category === "game" ? "game" : "support") : "ops",
			appId: app?.appId ?? null,
			summary: app?.summary ?? "Operator coordination thread.",
			participants: ["System"],
			lastActivityAt: now,
			messages: [],
		};
		this.chatThreads.set(thread.threadId, thread);
		return thread;
	}

	private buildConnectors(): ConnectorState[] {
		const bundle = new Set(this.config.connectorBundle);
		const connected = this.config.featureFlags.connectors;

		const definitions: ConnectorState[] = [
			{
				connectorId: "discord",
				label: "Discord",
				mode: "community",
				status: bundle.has("discord") && connected ? "connected" : "planned",
				channels: ["#ops-bridge", "#launch-bay", "#babylon-floor"],
				latencyMs: 42,
			},
			{
				connectorId: "twitch",
				label: "Twitch Chat",
				mode: "audience",
				status: bundle.has("twitch") && connected ? "connected" : "planned",
				channels: ["chat-events", "poll-hooks", "audience-replies"],
				latencyMs: 57,
			},
			{
				connectorId: "telegram",
				label: "Telegram",
				mode: "ops",
				status: bundle.has("telegram") && connected ? "connected" : "planned",
				channels: ["mobile-ops", "alerts"],
				latencyMs: 71,
			},
		];

		return definitions.map((connector) => clone(connector));
	}

	private buildStreams(
		sessions: GameSessionRecord[],
	): StreamDestinationState[] {
		const leadSession =
			sessions.find(
				(session) =>
					session.status !== "ended" &&
					PRIMARY_GAME_APPS.some((app) => app.appId === session.appId),
			) ??
			sessions.find((session) => session.status !== "ended") ??
			null;

		const streamingEnabled = this.config.featureFlags.streaming;

		return this.config.streamingDestinations.map((destinationId, index) => {
			const isRtmp = destinationId === "custom-rtmp";
			const status: StreamStatus = !streamingEnabled
				? "offline"
				: !leadSession
					? isRtmp
						? "standby"
						: "offline"
					: destinationId === "x"
						? "standby"
						: "live";

			const labelMap: Record<string, string> = {
				twitch: "Twitch Live",
				youtube: "YouTube Live",
				x: "X Amplify",
				"custom-rtmp": "Custom RTMP",
			};

			return {
				destinationId,
				label: labelMap[destinationId] ?? destinationId,
				status,
				destinationType: isRtmp ? "rtmp" : "platform",
				appId: leadSession?.appId ?? null,
				sessionId: leadSession?.sessionId ?? null,
				scene: leadSession
					? `${leadSession.displayName} Watch`
					: "Idle Watch Scene",
				outputLabel: leadSession
					? `${leadSession.displayName} · ${leadSession.persona}`
					: "Waiting for source",
				viewerCount:
					status === "live" ? 140 + sessions.length * 16 + index * 11 : 0,
			} satisfies StreamDestinationState;
		});
	}

	private buildAgents(
		sessions: GameSessionRecord[],
		streams: StreamDestinationState[],
	): AgentProfile[] {
		return BASE_AGENT_SEEDS.map((seed) => {
			const liveSession = seed.homeAppId
				? latestSessionByAppId(sessions, seed.homeAppId)
				: null;
			const stream = streams.find(
				(destination) =>
					destination.appId === seed.homeAppId && destination.status === "live",
			);

			let status: AgentStatus = "ready";
			if (seed.homeAppId === "coding" && liveSession) {
				status = "building";
			} else if (stream) {
				status = "streaming";
			} else if (liveSession && PRIMARY_GAME_APPS.some((app) => app.appId === seed.homeAppId)) {
				status = "in-game";
			} else if (liveSession) {
				status = "watching";
			} else if (seed.homeAppId === "companion") {
				status = "watching";
			}

			const threadId = this.getPreferredThreadId(seed.homeAppId);

			return {
				agentId: seed.agentId,
				displayName: seed.displayName,
				persona: seed.persona,
				role: seed.role,
				status,
				homeAppId: seed.homeAppId,
				currentAppId: liveSession?.appId ?? seed.homeAppId,
				activeSessionId: liveSession?.sessionId ?? null,
				streamDestination: stream?.label ?? null,
				summary: liveSession
					? `${seed.displayName} is routing ${liveSession.displayName} for ${liveSession.persona}.`
					: seed.idleSummary,
				capabilities: [...seed.capabilities],
				threadIds: [threadId],
			} satisfies AgentProfile;
		});
	}

	private buildPiPScreens(
		sessions: GameSessionRecord[],
		agents: AgentProfile[],
		streams: StreamDestinationState[],
		chatThreads: ChatThread[],
	): PiPScreen[] {
		const screens: PiPScreen[] = PRIMARY_GAME_APPS.map((app) => {
			const session = latestSessionByAppId(sessions, app.appId);
			const agent = agents.find((entry) => entry.homeAppId === app.appId);
			const thread = chatThreads.find((entry) => entry.appId === app.appId);
			const liveStream = streams.find(
				(destination) =>
					destination.appId === app.appId && destination.status === "live",
			);

			return {
				screenId: `${app.appId}-pip`,
				title: app.displayName,
				subtitle: session
					? `${session.persona} · ${session.status} · ${agent?.displayName ?? "No pilot"}`
					: `Waiting for ${app.displayName} launch`,
				state: session ? (liveStream ? "live" : "watching") : "idle",
				sourceType: "game-session",
				appId: app.appId,
				sessionId: session?.sessionId ?? null,
				focus: agent?.displayName ?? app.displayName,
				metrics: session
					? [
							latestSessionMetric(session, 0, "Status", session.status),
							latestSessionMetric(
								session,
								1,
								"Queue",
								`${session.commandQueue.filter((command) => command.status === "queued").length} queued`,
							),
							{
								label: "Chat",
								value: thread ? `${thread.messages.length} msgs` : "Bridge ready",
							},
						]
					: [
							{ label: "Mode", value: app.session.mode },
							{ label: "Viewer", value: app.launchType },
							{
								label: "Bridge",
								value: thread ? thread.title : "Ready",
							},
						],
			};
		});

		const liveStream = streams.find((stream) => stream.status === "live") ?? streams[0];
		if (liveStream) {
			screens.push({
				screenId: "stream-orbit",
				title: "Stream Orbit",
				subtitle:
					liveStream.status === "live"
						? `${liveStream.label} is carrying ${liveStream.outputLabel}`
						: "Streaming is on standby",
				state: liveStream.status === "live" ? "live" : "idle",
				sourceType: "stream",
				appId: liveStream.appId,
				sessionId: liveStream.sessionId,
				focus: liveStream.label,
				metrics: [
					{ label: "Scene", value: liveStream.scene },
					{ label: "Output", value: liveStream.outputLabel },
					{ label: "Viewers", value: `${liveStream.viewerCount}` },
				],
			});
		}

		const codingSession = latestSessionByAppId(sessions, "coding");
		if (codingSession) {
			screens.push({
				screenId: "coding-swarm-pip",
				title: "Coding Swarm",
				subtitle: `${codingSession.persona} · ${codingSession.status} · reconnect-safe PTY`,
				state: codingSession.status === "active" ? "watching" : "idle",
				sourceType: "support-session",
				appId: "coding",
				sessionId: codingSession.sessionId,
				focus: "Swarm Forge",
				metrics: [
					latestSessionMetric(codingSession, 0, "Tasks", "Routing"),
					{
						label: "Notes",
						value: `${codingSession.notes.length} retained`,
					},
					{
						label: "Artifacts",
						value: `${codingSession.commandQueue.length} commands`,
					},
				],
			});
		}

		return screens.map((screen) => clone(screen));
	}

	private buildKnowledgeIndex(
		sessions: GameSessionRecord[],
		agents: AgentProfile[],
	): KnowledgeDocument[] {
		const now = isoNow();
		const base: KnowledgeDocument[] =
			this.remoteKnowledge && this.remoteKnowledge.length > 0
				? this.remoteKnowledge.map((doc) => clone(doc))
				: [
						{
							docId: "cartridge-platform-manifest",
							title: "Cartridge platform manifest",
							source: "cartridge-memory",
							scope: "platform",
							excerpt:
								"Unified operator console: gaming surfaces, Cartridge memory scopes, and data-plane routing. Headers map to Eliza-compatible aliases for agent plugins.",
							tokensApprox: 2400,
							lastIndexedAt: now,
							embeddingModel: "milady-text-embed-v3",
						},
						{
							docId: "cartridge-operator-playbook",
							title: "Operator playbook — sessions & PiP",
							source: "catalog",
							scope: "ops",
							excerpt:
								"How Cartridge launches native workspaces, routes chat into per-app bridges, and mirrors stream state into monitors.",
							tokensApprox: 1800,
							lastIndexedAt: now,
							embeddingModel: "milady-text-embed-v3",
						},
					];

		const sessionDocs: KnowledgeDocument[] = sessions
			.filter((session) => session.status !== "ended")
			.map((session) => ({
				docId: `session-${session.sessionId}`,
				title: `${session.displayName} — live context`,
				source: "session" as const,
				scope: session.appId,
				excerpt: `Session ${session.sessionId.slice(0, 8)}… · ${session.persona} · ${session.notes.length} notes · telemetry panels: ${session.telemetry.length}`,
				tokensApprox: 400 + session.notes.length * 32,
				lastIndexedAt: session.updatedAt,
				embeddingModel: "milady-text-embed-v3",
			}));

		const agentDocs: KnowledgeDocument[] = agents.slice(0, 4).map((agent) => ({
			docId: `agent-${agent.agentId}`,
			title: `${agent.displayName} — capability graph`,
			source: "agent" as const,
			scope: agent.homeAppId ?? "platform",
			excerpt: `${agent.role}. ${agent.summary}`,
			tokensApprox: 320,
			lastIndexedAt: now,
			embeddingModel: "milady-text-embed-v3",
		}));

		return [...base, ...sessionDocs, ...agentDocs].map((doc) => clone(doc));
	}

	private buildDataStores(): DataStoreRecord[] {
		if (this.remoteDataStores && this.remoteDataStores.length > 0) {
			return this.remoteDataStores.map((row) => clone(row));
		}

		const cloud = this.config.featureFlags.cloud;
		const sessions = this.sessions.listSessions().filter((s) => s.status !== "ended");
		const approx = 9000 + sessions.length * 420;

		const rows: DataStoreRecord[] = [
			{
				storeId: "cartridge-vector-memory",
				label: "Vector memory (Cartridge scope)",
				kind: "vector",
				status: "ready",
				region: this.config.runtimeLocation === "cloud" ? "us-east" : "local",
				recordsApprox: approx,
				syncedWithCartridge: true,
			},
			{
				storeId: "cartridge-graph-links",
				label: "Graph — agents ↔ surfaces",
				kind: "graph",
				status: "ready",
				region: "local",
				recordsApprox: 2100 + this.registry.listApps().length * 40,
				syncedWithCartridge: true,
			},
			{
				storeId: "cartridge-relational-state",
				label: "Relational — sessions & commands",
				kind: "relational",
				status: cloud ? "ready" : "readonly",
				region: cloud ? "cloud-replica" : "local",
				recordsApprox: 560 + sessions.length * 18,
				syncedWithCartridge: cloud,
			},
			{
				storeId: "cartridge-kv-cache",
				label: "KV — connector & stream cache",
				kind: "kv",
				status: this.config.featureFlags.connectors ? "ready" : "degraded",
				region: "local",
				recordsApprox: 1200,
				syncedWithCartridge: false,
			},
		];

		return rows.map((row) => clone(row));
	}

	private handlePlatformEvent<K extends keyof PlatformEventMap>(
		event: PlatformEventEnvelope<K>,
	): void {
		const emitPlatformEvent = this.bus.emit.bind(this.bus) as <
			T extends keyof PlatformEventMap,
		>(
			type: T,
			payload: PlatformEventMap[T],
		) => void;

		emitPlatformEvent(event.type, event.payload);
	}
}
