import {
	GameSessionManager,
	createDefaultAppRegistry,
} from "@cartridge/app-platform";
import {
	BRANDING_PROFILE,
	PRIMARY_GAME_APPS,
	type AppCatalogSummary,
	type BrandingProfile,
	type GameAppManifest,
	type Persona,
	type SessionLaunchInput,
	type SurfaceTakeoverState,
	type WorkspaceViewDescriptor,
	type WorkspaceViewRole,
} from "@cartridge/shared";
import {
	appendTrimmedHistory,
	clone,
	cloneItems,
	createId,
	isoNow,
	type AiPlaneState,
	type DataStoreRecord,
	type GameSessionRecord,
	type KnowledgeDocument,
	type EnqueueCommandInput,
	type PlatformEventEnvelope,
	type PlatformEventMap,
	type ResolveCommandInput,
} from "@cartridge/shared";

import { buildAiPlaneState, getEffectiveElizaToken } from "./ai-plane";
import { type AiProbeBundle, runAllAiProbes } from "./ai-plane-probe";
import { mergeBrandingFromEnv } from "./branding-env";
import { fetchRemoteDataPlane } from "./data-plane-remote";
import { TypedEventBus, type TypedEventEnvelope } from "./events";

type RuntimeLocation = "local" | "cloud" | "hybrid";
type ChatChannel = "ops" | "game" | "support" | "stream" | "system";
export type ChatThreadKind = "ops" | "game" | "support" | "stream";
type ConnectorMode = "community" | "audience" | "ops";
type ConnectorStatus = "connected" | "degraded" | "planned";
type AgentStatus =
	| "ready"
	| "in-game"
	| "streaming"
	| "building"
	| "watching";
type StreamStatus = "live" | "standby" | "offline";
type PiPScreenState = "live" | "watching" | "idle";
export type BroadcastStatus =
	| "idle"
	| "permissions_required"
	| "starting"
	| "live"
	| "reconnecting"
	| "degraded"
	| "error"
	| "stopping";
export type BroadcastPermissionGate =
	| "required"
	| "granted"
	| "denied"
	| "unavailable";
export type BroadcastAudioBus = "app" | "system" | "mic";
export type BroadcastRole = "none" | "source" | "preview";

type RuntimeConfig = {
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

type RuntimeSnapshot = {
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

type ChatMessage = {
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
	sourcePersona: Persona | null;
	sourceViewer: GameSessionRecord["viewer"] | null;
	sourceViewRole: WorkspaceViewRole | null;
	captureMode: "standard" | "immersive";
	takeoverState: SurfaceTakeoverState | null;
};

export type AudioBusConfig = {
	enabled: boolean;
	muted: boolean;
	gainPct: number;
};

export type BroadcastVideoProfile = {
	width: number;
	height: number;
	fps: number;
	videoBitrateKbps: number;
	audioBitrateKbps: number;
	videoCodec: "h264";
	audioCodec: "aac";
};

export type BroadcastConfig = {
	enabled: boolean;
	destinationUrl: string;
	streamKeyRef: string | null;
	videoProfile: BroadcastVideoProfile;
	audioBuses: Record<BroadcastAudioBus, AudioBusConfig>;
};

export type BroadcastPermissionState = {
	screen: BroadcastPermissionGate;
	systemAudio: BroadcastPermissionGate;
	microphone: BroadcastPermissionGate;
};

export type BroadcastSource = {
	appId: string | null;
	sessionId: string | null;
	displayName: string | null;
	persona: Persona | null;
	viewer: GameSessionRecord["viewer"] | null;
	viewRole: WorkspaceViewRole | null;
	captureMode: "standard" | "immersive";
	broadcastRole: BroadcastRole;
	takeoverState: SurfaceTakeoverState | null;
	scene: string;
	outputLabel: string;
};

export type BroadcastHealth = {
	fps: number;
	bitrateKbps: number;
	droppedFrames: number;
	reconnectCount: number;
	encoderLagMs: number;
	publishUptimeSec: number;
};

export type BroadcastState = {
	status: BroadcastStatus;
	config: BroadcastConfig;
	permissions: BroadcastPermissionState;
	source: BroadcastSource;
	health: BroadcastHealth;
	lastError: string | null;
	lastEventAt: string | null;
	recentLogs: string[];
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
	liveViewRole: WorkspaceViewRole | null;
	takeoverState: SurfaceTakeoverState | null;
	metrics: Array<{ label: string; value: string }>;
};

type ShellEmbedState = {
	sessionId: string;
	appId: string;
	displayName: string;
	persona: Persona;
	splitPlay: boolean;
	takeoverState: SurfaceTakeoverState;
	agentView: WorkspaceViewDescriptor;
	userView: WorkspaceViewDescriptor | null;
};

export type RuntimeState = {
	runtime: RuntimeSnapshot;
	catalog: AppCatalogSummary;
	surfaces: GameAppManifest[];
	sessions: GameSessionRecord[];
	agents: AgentProfile[];
	chatThreads: ChatThread[];
	connectors: ConnectorState[];
	streams: StreamDestinationState[];
	pipScreens: PiPScreen[];
	knowledge: KnowledgeDocument[];
	dataStores: DataStoreRecord[];
	aiPlane: AiPlaneState;
	broadcast: BroadcastState;
	shellEmbed: ShellEmbedState | null;
};

type CartridgeRuntimeEventMap = PlatformEventMap & {
	"runtime.booted": RuntimeSnapshot;
	"cloud.state.changed": {
		runtimeLocation: RuntimeLocation;
		cloudEnabled: boolean;
	};
};

type SendChatMessageInput = {
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
const DEFAULT_EMBEDDING_MODEL = "cartridge-text-embed-v3";
const MAX_BROADCAST_LOGS = 40;
const MAX_THREAD_MESSAGES = 32;
const OPS_THREAD_ID = "ops-bridge";
const STREAM_THREAD_ID = "stream-control";
const PRIMARY_GAME_APP_IDS = new Set(PRIMARY_GAME_APPS.map((app) => app.appId));

function createDefaultBroadcastVideoProfile(): BroadcastVideoProfile {
	return {
		width: 1920,
		height: 1080,
		fps: 60,
		videoBitrateKbps: 8000,
		audioBitrateKbps: 160,
		videoCodec: "h264",
		audioCodec: "aac",
	};
}

function createDefaultAudioBuses(): Record<BroadcastAudioBus, AudioBusConfig> {
	return {
		app: { enabled: true, muted: false, gainPct: 100 },
		system: { enabled: true, muted: false, gainPct: 100 },
		mic: { enabled: true, muted: false, gainPct: 100 },
	};
}

function createDefaultBroadcastPermissions(): BroadcastPermissionState {
	return {
		screen: "required",
		systemAudio: "required",
		microphone: "required",
	};
}

function createDefaultBroadcastHealth(): BroadcastHealth {
	return {
		fps: 0,
		bitrateKbps: 0,
		droppedFrames: 0,
		reconnectCount: 0,
		encoderLagMs: 0,
		publishUptimeSec: 0,
	};
}

function createDefaultBroadcastConfig(): BroadcastConfig {
	return {
		enabled: false,
		destinationUrl: "",
		streamKeyRef: null,
		videoProfile: createDefaultBroadcastVideoProfile(),
		audioBuses: createDefaultAudioBuses(),
	};
}

function createIdleBroadcastSource(): BroadcastSource {
	return {
		appId: null,
		sessionId: null,
		displayName: null,
		persona: null,
		viewer: null,
		viewRole: null,
		captureMode: "standard",
		broadcastRole: "none",
		takeoverState: null,
		scene: "Idle Watch Scene",
		outputLabel: "Waiting for source",
	};
}

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
		agentId: "hyperscape-host",
		displayName: "Hyperscape Host",
		persona: "agent-gamer",
		role: "Hyperscape live session host",
		homeAppId: "hyperscape",
		idleSummary:
			"Standing by to attach to a Hyperscape embedded agent and steer the live session.",
		capabilities: ["embedded-agents", "follow-target", "pause-resume"],
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
		agentId: "kinema-pilot",
		displayName: "Kinema Pilot",
		persona: "agent-gamer",
		role: "Kinema gameplay lab pilot",
		homeAppId: "kinema",
		idleSummary: "Standing by to drive Kinema sessions, stations, and editor play-tests.",
		capabilities: ["third-person", "editor-routing", "render-debug"],
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

function isPrimaryGameApp(appId: string | null): boolean {
	return appId !== null && PRIMARY_GAME_APP_IDS.has(appId);
}

function createAppThread(
	app: GameAppManifest,
	threadId: string,
	now: string,
	summary: string,
	participants: string[],
	messages: ChatMessage[],
): ChatThread {
	return {
		threadId,
		title: `${app.displayName} Bridge`,
		kind: app.category === "game" ? "game" : "support",
		appId: app.appId,
		summary,
		participants,
		lastActivityAt: now,
		messages,
	};
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
		return createAppThread(
			app,
			threadId,
			now,
			app.summary,
			["System", app.displayName],
			[
				{
					...seedMessage(
						threadId,
						`${app.displayName} is wired into chat, agent control, and monitoring.`,
					),
					appId: app.appId,
				},
			],
		);
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

function pickStreamLeadSession(
	sessions: GameSessionRecord[],
): GameSessionRecord | null {
	const activeSessions = sessions.filter((session) => session.status !== "ended");
	return (
		activeSessions.find(
			(session) => session.persona === "agent-gamer" && isPrimaryGameApp(session.appId),
		) ?? null
	);
}

function defaultTakeoverState(
	persona: Persona,
	splitPlay: boolean,
): SurfaceTakeoverState {
	if (persona === "user-gamer") {
		return "user-takeover";
	}
	if (splitPlay) {
		return "user-observing";
	}
	return "agent-active";
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

function resolveRuntimeConfig(
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
	private shellEmbedSessionId: string | null = null;
	private shellEmbedSplitPlay = false;
	private shellEmbedViews = new Map<
		string,
		{ agentView: WorkspaceViewDescriptor; userView: WorkspaceViewDescriptor | null }
	>();
	private sessionTakeoverStates = new Map<string, SurfaceTakeoverState>();
	private broadcastConfig: BroadcastConfig = createDefaultBroadcastConfig();
	private broadcastStatus: BroadcastStatus = "idle";
	private broadcastPermissions: BroadcastPermissionState =
		createDefaultBroadcastPermissions();
	private broadcastHealth: BroadcastHealth = createDefaultBroadcastHealth();
	private broadcastLastError: string | null = null;
	private broadcastLastEventAt: string | null = null;
	private broadcastLogs: string[] = [];

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

	async refreshDataPlaneFromApis(): Promise<void> {
		const result = await fetchRemoteDataPlane();
		this.remoteKnowledge = result.knowledge;
		this.remoteDataStores = result.dataStores;
		this.remoteDataPlaneError = result.error;
	}

	async refreshAiPlaneProbes(): Promise<void> {
		const token = getEffectiveElizaToken(this.elizaCloudTokenOverride);
		const bundle = await runAllAiProbes(this.config.brandingProfile, token);
		this.aiProbeCache = bundle;
		this.aiProbeAt = isoNow();
		this.aiProbeAggregateError = null;
	}

	setElizaCloudSessionToken(token: string | null): void {
		this.elizaCloudTokenOverride = token;
	}

	clearElizaCloudSession(): void {
		this.elizaCloudTokenOverride = null;
	}

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

	updateBroadcastConfig(input: {
		enabled?: boolean;
		destinationUrl?: string;
		streamKeyRef?: string | null;
		videoProfile?: Partial<BroadcastVideoProfile>;
	}): BroadcastConfig {
		this.broadcastConfig = {
			...this.broadcastConfig,
			enabled: input.enabled ?? this.broadcastConfig.enabled,
			destinationUrl:
				input.destinationUrl?.trim() ?? this.broadcastConfig.destinationUrl,
			streamKeyRef:
				input.streamKeyRef === undefined
					? this.broadcastConfig.streamKeyRef
					: input.streamKeyRef,
			videoProfile: {
				...this.broadcastConfig.videoProfile,
				...(input.videoProfile ?? {}),
			},
		};
		return clone(this.broadcastConfig);
	}

	setBroadcastAudioBus(
		bus: BroadcastAudioBus,
		input: Partial<AudioBusConfig>,
	): Record<BroadcastAudioBus, AudioBusConfig> {
		this.broadcastConfig = {
			...this.broadcastConfig,
			audioBuses: {
				...this.broadcastConfig.audioBuses,
				[bus]: {
					...this.broadcastConfig.audioBuses[bus],
					...input,
				},
			},
		};
		return clone(this.broadcastConfig.audioBuses);
	}

	setBroadcastPermissions(
		input: Partial<BroadcastPermissionState>,
	): BroadcastPermissionState {
		this.broadcastPermissions = {
			...this.broadcastPermissions,
			...input,
		};
		this.broadcastLastEventAt = isoNow();
		return clone(this.broadcastPermissions);
	}

	setBroadcastStatus(input: {
		status: BroadcastStatus;
		health?: Partial<BroadcastHealth>;
		lastError?: string | null;
		logs?: string[];
	}): BroadcastStatus {
		this.broadcastStatus = input.status;
		this.broadcastHealth = {
			...this.broadcastHealth,
			...(input.health ?? {}),
		};
		if (input.lastError !== undefined) {
			this.broadcastLastError = input.lastError;
		}
		if (input.logs && input.logs.length > 0) {
			this.broadcastLogs = appendTrimmedHistory(
				this.broadcastLogs,
				input.logs,
				MAX_BROADCAST_LOGS,
			);
		}
		this.broadcastLastEventAt = isoNow();
		return this.broadcastStatus;
	}

	getBroadcastLogs(): string[] {
		return [...this.broadcastLogs];
	}

	private buildBroadcastState(
		sessions: GameSessionRecord[],
	): BroadcastState {
		const sourceSession = pickStreamLeadSession(sessions);
		const source: BroadcastSource = sourceSession
			? {
					appId: sourceSession.appId,
					sessionId: sourceSession.sessionId,
					displayName: sourceSession.displayName,
					persona: sourceSession.persona,
					viewer: sourceSession.viewer,
					viewRole: "agent",
					captureMode:
						sourceSession.persona === "agent-gamer" &&
						isPrimaryGameApp(sourceSession.appId)
							? "immersive"
							: "standard",
					broadcastRole: "source",
					takeoverState: this.getSessionTakeoverState(
						sourceSession.sessionId,
						sourceSession.persona,
						false,
					),
					scene: `${sourceSession.displayName} Agent Screen`,
					outputLabel: `${sourceSession.displayName} · agent fullscreen`,
				}
			: createIdleBroadcastSource();

		return {
			status:
				sourceSession === null &&
				(this.broadcastStatus === "live" ||
					this.broadcastStatus === "starting" ||
					this.broadcastStatus === "reconnecting" ||
					this.broadcastStatus === "degraded")
					? "idle"
					: this.broadcastStatus,
			config: clone(this.broadcastConfig),
			permissions: clone(this.broadcastPermissions),
			source,
			health: clone(this.broadcastHealth),
			lastError: this.broadcastLastError,
			lastEventAt: this.broadcastLastEventAt,
			recentLogs: [...this.broadcastLogs],
		};
	}

	getRuntimeState(): RuntimeState {
		const sessions = this.sessions.listSessions();
		const connectors = this.buildConnectors();
		const streams = this.buildStreams(sessions);
		const agents = this.buildAgents(sessions, streams);
		const chatThreads = cloneItems(
			[...this.chatThreads.values()].sort((left, right) =>
				compareIsoDesc(left.lastActivityAt, right.lastActivityAt),
			),
		);

		return {
			runtime: this.getSnapshot(),
			catalog: this.registry.getCatalogSummary(),
			surfaces: this.listLaunchableSurfaces(),
			sessions,
			agents,
			chatThreads,
			connectors,
			streams,
			pipScreens: this.buildPiPScreens(sessions, agents, streams, chatThreads),
			knowledge: this.buildKnowledgeIndex(sessions, agents),
			dataStores: this.buildDataStores(),
			aiPlane: this.buildAiPlane(),
			broadcast: this.buildBroadcastState(sessions),
			shellEmbed: this.buildShellEmbed(sessions),
		};
	}

	private buildShellEmbed(sessions: GameSessionRecord[]): ShellEmbedState | null {
		if (!this.shellEmbedSessionId) {
			return null;
		}
		const session = sessions.find((s) => s.sessionId === this.shellEmbedSessionId);
		if (!session || session.status === "ended") {
			const staleId = this.shellEmbedSessionId;
			this.shellEmbedSessionId = null;
			this.shellEmbedSplitPlay = false;
			if (staleId) {
				this.shellEmbedViews.delete(staleId);
				this.sessionTakeoverStates.delete(staleId);
			}
			return null;
		}
		const embedUrl = session.manifest.launchUrl?.trim() || "about:blank";
		const views = this.shellEmbedViews.get(session.sessionId) ?? {
			agentView: {
				role: "agent",
				label: "Agent view",
				url: embedUrl,
				controlMode:
					session.persona === "user-gamer"
						? "user-controlled"
						: "agent-controlled",
				capturePriority: "primary",
			} satisfies WorkspaceViewDescriptor,
			userView:
				this.shellEmbedSplitPlay
					? ({
							role: "user",
							label: "User view",
							url: embedUrl,
							controlMode: "watch-only",
							capturePriority: "secondary",
						} satisfies WorkspaceViewDescriptor)
					: null,
		};
		return {
			sessionId: session.sessionId,
			appId: session.appId,
			displayName: session.displayName,
			persona: session.persona,
			splitPlay: this.shellEmbedSplitPlay,
			takeoverState: this.getSessionTakeoverState(
				session.sessionId,
				session.persona,
				this.shellEmbedSplitPlay,
			),
			agentView: clone(views.agentView),
			userView: views.userView ? clone(views.userView) : null,
		};
	}

	private getSessionTakeoverState(
		sessionId: string,
		persona: Persona,
		splitPlay: boolean,
	): SurfaceTakeoverState {
		return (
			this.sessionTakeoverStates.get(sessionId) ??
			defaultTakeoverState(persona, splitPlay)
		);
	}

	launchSurfaceInShell(input: {
		appId: string;
		persona: Persona;
		splitPlay?: boolean;
		launchUrlOverride?: string | null;
		views?: {
			agentView: WorkspaceViewDescriptor;
			userView: WorkspaceViewDescriptor | null;
		};
		takeoverState?: SurfaceTakeoverState;
	}): GameSessionRecord {
		this.boot();
		if (this.shellEmbedSessionId) {
			const prev = this.shellEmbedSessionId;
			this.shellEmbedSessionId = null;
			this.shellEmbedSplitPlay = false;
			this.shellEmbedViews.delete(prev);
			this.sessionTakeoverStates.delete(prev);
			this.endSession(prev, "Replaced by new shell embed");
		}
		const session = this.launchSurface({
			appId: input.appId,
			persona: input.persona,
			launchedFrom: "desktop-main",
			viewer: "embedded",
			launchUrlOverride: input.launchUrlOverride,
		});
		this.shellEmbedSessionId = session.sessionId;
		this.shellEmbedSplitPlay = input.splitPlay === true;
		if (input.views) {
			this.shellEmbedViews.set(session.sessionId, {
				agentView: clone(input.views.agentView),
				userView: input.views.userView ? clone(input.views.userView) : null,
			});
		}
		this.sessionTakeoverStates.set(
			session.sessionId,
			input.takeoverState ??
				defaultTakeoverState(session.persona, input.splitPlay === true),
		);
		return session;
	}

	clearShellEmbed(): void {
		if (!this.shellEmbedSessionId) {
			return;
		}
		const id = this.shellEmbedSessionId;
		this.shellEmbedSessionId = null;
		this.shellEmbedSplitPlay = false;
		this.shellEmbedViews.delete(id);
		this.sessionTakeoverStates.delete(id);
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

	setSessionTakeoverState(
		sessionId: string,
		takeoverState: SurfaceTakeoverState,
		note?: string,
	): GameSessionRecord {
		this.sessionTakeoverStates.set(sessionId, takeoverState);
		const session = this.sessions.getSession(sessionId);
		if (!session) {
			throw new Error(`Unknown session for takeover state: ${sessionId}`);
		}
		if (note) {
			this.addSessionNote(sessionId, note);
			this.sendChatMessage({
				appId: session.appId,
				sessionId,
				author: "System",
				body: note,
				channel: "ops",
			});
		}
		return this.sessions.getSession(sessionId) as GameSessionRecord;
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
			channel: this.getChannelForAppId(input.appId),
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
		this.sessionTakeoverStates.delete(sessionId);
		this.shellEmbedViews.delete(sessionId);
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

		thread.messages = appendTrimmedHistory(
			thread.messages,
			[message],
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
			channel: this.getChannelForAppId(session.appId),
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
		const thread: ChatThread = app
			? createAppThread(app, resolvedThreadId, now, app.summary, ["System"], [])
			: {
					threadId: resolvedThreadId,
					title: "Ops Bridge",
					kind: "ops",
					appId: null,
					summary: "Operator coordination thread.",
					participants: ["System"],
					lastActivityAt: now,
					messages: [],
				};
		this.chatThreads.set(thread.threadId, thread);
		return thread;
	}

	private getChannelForAppId(appId: string): ChatChannel {
		return this.getSurface(appId)?.category === "game" ? "game" : "support";
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

		return cloneItems(definitions);
	}

	private buildStreams(
		sessions: GameSessionRecord[],
	): StreamDestinationState[] {
		const leadSession = pickStreamLeadSession(sessions);

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
					? leadSession.persona === "agent-gamer"
						? `${leadSession.displayName} Agent Screen`
						: `${leadSession.displayName} Watch`
					: "Idle Watch Scene",
				outputLabel: leadSession
					? leadSession.persona === "agent-gamer"
						? `${leadSession.displayName} · agent fullscreen`
						: `${leadSession.displayName} · ${leadSession.persona}`
					: "Waiting for source",
				viewerCount:
					status === "live" ? 140 + sessions.length * 16 + index * 11 : 0,
				sourcePersona: leadSession?.persona ?? null,
				sourceViewer: leadSession?.viewer ?? null,
				sourceViewRole: leadSession ? "agent" : null,
				captureMode:
					leadSession?.persona === "agent-gamer" && isPrimaryGameApp(leadSession.appId)
						? "immersive"
						: "standard",
				takeoverState: leadSession
					? this.getSessionTakeoverState(
							leadSession.sessionId,
							leadSession.persona,
							false,
						)
					: null,
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
			} else if (liveSession && isPrimaryGameApp(seed.homeAppId)) {
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
				liveViewRole: session ? "agent" : null,
				takeoverState: session
					? this.getSessionTakeoverState(session.sessionId, session.persona, false)
					: null,
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
				liveViewRole: liveStream.sourceViewRole,
				takeoverState: liveStream.takeoverState,
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
				liveViewRole: null,
				takeoverState: null,
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

		return cloneItems(screens);
	}

	private buildKnowledgeIndex(
		sessions: GameSessionRecord[],
		agents: AgentProfile[],
	): KnowledgeDocument[] {
		const now = isoNow();
		const base: KnowledgeDocument[] =
			this.remoteKnowledge && this.remoteKnowledge.length > 0
				? cloneItems(this.remoteKnowledge)
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
							embeddingModel: DEFAULT_EMBEDDING_MODEL,
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
							embeddingModel: DEFAULT_EMBEDDING_MODEL,
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
				embeddingModel: DEFAULT_EMBEDDING_MODEL,
			}));

		const agentDocs: KnowledgeDocument[] = agents.slice(0, 4).map((agent) => ({
			docId: `agent-${agent.agentId}`,
			title: `${agent.displayName} — capability graph`,
			source: "agent" as const,
			scope: agent.homeAppId ?? "platform",
			excerpt: `${agent.role}. ${agent.summary}`,
			tokensApprox: 320,
			lastIndexedAt: now,
			embeddingModel: DEFAULT_EMBEDDING_MODEL,
		}));

		return cloneItems([...base, ...sessionDocs, ...agentDocs]);
	}

	private buildDataStores(): DataStoreRecord[] {
		if (this.remoteDataStores && this.remoteDataStores.length > 0) {
			return cloneItems(this.remoteDataStores);
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

		return cloneItems(rows);
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
