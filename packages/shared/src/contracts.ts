export type SurfaceCategory = "game" | "support";

export type Persona = "agent-gamer" | "dev-gamer" | "user-gamer";

export type LaunchType = "connect" | "url" | "native-window";

export type SessionViewer = "embedded" | "native-window" | "external";

export type SessionMode =
	| "spectate-and-steer"
	| "operator-dashboard"
	| "view-only";

export type SurfaceControlTransport =
	| "session-route"
	| "browser-bridge"
	| "local-bridge"
	| "hybrid";

export type SurfaceUserInputMode = "supported" | "watch-only" | "takeover";

export type WorkspaceViewRole = "agent" | "user";

export type WorkspaceViewControlMode =
	| "agent-controlled"
	| "user-controlled"
	| "watch-only";

export type WorkspaceCapturePriority = "primary" | "secondary";

export type SurfaceTakeoverState =
	| "agent-active"
	| "user-observing"
	| "user-takeover"
	| "handoff-pending";

export type SurfaceWorkspaceCapabilities = {
	controlTransport: SurfaceControlTransport;
	supportsDualView: boolean;
	supportsTakeover: boolean;
	userInput: SurfaceUserInputMode;
};

export type WorkspaceViewDescriptor = {
	role: WorkspaceViewRole;
	label: string;
	url: string;
	controlMode: WorkspaceViewControlMode;
	capturePriority: WorkspaceCapturePriority;
};

export type BrandingProfile = {
	brandId: string;
	appName: string;
	orgName: string;
	packageScope: string;
	docsUrl: string;
	appUrl: string;
	cloudUrl: string;
	elizaCloudDashboardUrl: string;
	elizaCloudApiBaseUrl: string;
	bugReportUrl: string;
	hashtags: string[];
	assetPack: {
		iconSet: string;
		avatarSet: string;
		splashTheme: string;
		overlayTheme: string;
	};
	headers: {
		authHeader: string;
		clientIdHeader: string;
		cloudTokenHeader: string;
		aliases: Record<string, string>;
	};
};

export type GameAppManifest = {
	appId: string;
	packageName: string;
	displayName: string;
	category: SurfaceCategory;
	launchType: LaunchType;
	launchUrl: string | null;
	runtimePlugin: string | null;
	summary: string;
	capabilities: string[];
	personas: Persona[];
	workspace?: SurfaceWorkspaceCapabilities;
	session: {
		mode: SessionMode;
		features: string[];
	};
};

export type GameSessionManifest = Pick<
	GameAppManifest,
	"launchType" | "launchUrl" | "capabilities" | "packageName"
>;

export type AppCatalogSummary = {
	totalApps: number;
	games: number;
	support: number;
	operatorSurfaces: number;
	personaCoverage: Record<Persona, number>;
};

export type SessionStatus = "launching" | "active" | "paused" | "ended" | "error";

export type TelemetrySeverity = "info" | "warning" | "critical";

export type OperatorCommandStatus = "queued" | "executed" | "failed";

export type OperatorCommandPayload = Record<string, string | number | boolean | null>;

export type TelemetryFrame = {
	frameId: string;
	panel: string;
	label: string;
	value: string;
	severity: TelemetrySeverity;
	source: string;
	recordedAt: string;
};

export type OperatorCommand = {
	commandId: string;
	control: string;
	payload: OperatorCommandPayload;
	status: OperatorCommandStatus;
	enqueuedAt: string;
	resolvedAt: string | null;
	result: string | null;
};

export type GameSessionRecord = {
	sessionId: string;
	appId: string;
	displayName: string;
	persona: Persona;
	status: SessionStatus;
	mode: SessionMode;
	viewer: SessionViewer;
	launchedFrom: string;
	startedAt: string;
	updatedAt: string;
	commandQueue: OperatorCommand[];
	telemetry: TelemetryFrame[];
	suggestions: string[];
	notes: string[];
	manifest: GameSessionManifest;
};

export type AppendTelemetryInput = Array<Omit<TelemetryFrame, "frameId" | "recordedAt">>;

export type EnqueueCommandInput = {
	control: string;
	payload?: OperatorCommandPayload;
	note?: string;
};

export type ResolveCommandInput = {
	commandId: string;
	status: Exclude<OperatorCommandStatus, "queued">;
	result?: string;
};

export type PlatformEventMap = {
	"app.session.started": GameSessionRecord;
	"app.session.updated": GameSessionRecord;
	"app.session.ended": GameSessionRecord;
	"operator.command.enqueued": {
		sessionId: string;
		appId: string;
		command: OperatorCommand;
	};
	"operator.command.executed": {
		sessionId: string;
		appId: string;
		command: OperatorCommand;
	};
	"telemetry.frame.received": {
		sessionId: string;
		appId: string;
		frame: TelemetryFrame;
	};
};

export type PlatformEventEnvelope<
	K extends keyof PlatformEventMap = keyof PlatformEventMap,
> = {
	type: K;
	payload: PlatformEventMap[K];
};

export type PlatformEventSink = <K extends keyof PlatformEventMap>(
	event: PlatformEventEnvelope<K>,
) => void;

export type SessionLaunchInput = {
	appId: string;
	persona: Persona;
	launchedFrom: string;
	viewer?: SessionViewer;
	suggestionSeed?: string[];
	launchUrlOverride?: string | null;
};

export type KnowledgeDocument = {
	docId: string;
	title: string;
	source: "cartridge-memory" | "session" | "agent" | "catalog";
	scope: string;
	excerpt: string;
	tokensApprox: number;
	lastIndexedAt: string;
	embeddingModel: string;
};

export type DataStoreRecord = {
	storeId: string;
	label: string;
	kind: "vector" | "graph" | "relational" | "kv";
	status: "ready" | "migrating" | "readonly" | "degraded";
	region: string;
	recordsApprox: number;
	syncedWithCartridge: boolean;
};

export type AiLinkStatus =
	| "unconfigured"
	| "configured"
	| "ok"
	| "auth_required"
	| "error"
	| "offline";

export type ElizaCloudSlice = {
	kind: "eliza-cloud";
	dashboardUrl: string;
	apiBaseUrl: string;
	authenticated: boolean;
	authSource: "env" | "session" | "none";
	status: AiLinkStatus;
	modelIds: string[];
	lastError: string | null;
	scopeNote: "gaming-surfaces-only";
};

export type ExternalApiSlice = {
	kind: "external";
	id: "openai" | "anthropic" | "custom-openai";
	label: string;
	configured: boolean;
	baseUrl: string;
	status: AiLinkStatus;
	modelIds: string[];
	lastError: string | null;
};

export type LocalModelSlice = {
	kind: "local";
	id: "ollama" | "lm-studio";
	label: string;
	baseUrl: string;
	status: AiLinkStatus;
	modelIds: string[];
	lastError: string | null;
};

export type AiPlaneState = {
	elizaCloud: ElizaCloudSlice;
	external: ExternalApiSlice[];
	local: LocalModelSlice[];
	activeProviderId: string | null;
	activeModelId: string | null;
	lastProbeAt: string | null;
	aggregateProbeError: string | null;
};

export type OperatorSurfaceSpec = {
	surfaceId: string;
	targetAppId: string;
	controls: string[];
	telemetryPanels: string[];
	suggestionsMode: "none" | "assist" | "co-pilot";
	supportsPauseResume: boolean;
	supportsCommandQueue: boolean;
	supportsNativeWindowOpen: boolean;
	detailPanelBehavior: "inline" | "drawer" | "split-pane";
};
