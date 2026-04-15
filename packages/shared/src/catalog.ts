import type {
	BrandingProfile,
	GameAppManifest,
	OperatorSurfaceSpec,
} from "./contracts";

export const BRANDING_PROFILE: BrandingProfile = {
	brandId: "cartridge",
	appName: "Cartridge",
	orgName: "Cartridge",
	packageScope: "@cartridge",
	docsUrl: "https://docs.cartridge.gg",
	appUrl: "https://app.cartridge.gg",
	cloudUrl: "https://cloud.cartridge.gg",
	elizaCloudDashboardUrl: "https://www.elizacloud.ai",
	elizaCloudApiBaseUrl: "https://elizacloud.ai/api/v1",
	bugReportUrl: "https://github.com/cartridge/platform/issues",
	hashtags: ["#Cartridge", "#MiladyPlatform", "#ElizaWhiteLabel", "#AgentGaming"],
	assetPack: {
		iconSet: "cartridge-core",
		avatarSet: "milady-companions",
		splashTheme: "cartridge-obsidian",
		overlayTheme: "arena-stream",
	},
	headers: {
		authHeader: "x-cartridge-token",
		clientIdHeader: "x-cartridge-client-id",
		cloudTokenHeader: "x-cartridge-cloud-token",
		aliases: {
			"x-cartridge-token": "x-eliza-token",
			"x-cartridge-client-id": "x-eliza-client-id",
			"x-cartridge-cloud-token": "x-eliza-cloud-token",
		},
	},
};

export const PRIMARY_GAME_APPS: GameAppManifest[] = [
	{
		appId: "babylon",
		packageName: "@elizaos/app-babylon",
		displayName: "Babylon",
		category: "game",
		launchType: "url",
		launchUrl: "http://localhost:3000",
		runtimePlugin: "@elizaos/app-babylon",
		summary:
			"Prediction-market game surface for creator events, wagers, and audience participation.",
		capabilities: ["prediction-market", "social-play", "wallet-aware"],
		personas: ["user-gamer", "agent-gamer", "dev-gamer"],
		session: {
			mode: "spectate-and-steer",
			features: ["commands", "telemetry", "suggestions"],
		},
	},
	{
		appId: "clawville",
		packageName: "@clawville/app-clawville",
		displayName: "ClawVille",
		category: "game",
		launchType: "connect",
		launchUrl: "https://clawville.world/game",
		runtimePlugin: "@clawville/app-clawville",
		summary:
			"Sea-themed multi-agent 3D world with skill learning, Solana-aware identity, and social play.",
		capabilities: ["skill-learning", "multi-agent", "solana-wallet"],
		personas: ["agent-gamer", "user-gamer", "dev-gamer"],
		session: {
			mode: "spectate-and-steer",
			features: ["commands", "telemetry", "suggestions"],
		},
	},
	{
		appId: "defense-of-the-agents",
		packageName: "@elizaos/app-defense-of-the-agents",
		displayName: "Defense of the Agents",
		category: "game",
		launchType: "connect",
		launchUrl: "https://www.defenseoftheagents.com/",
		runtimePlugin: "@elizaos/app-defense-of-the-agents",
		summary:
			"Strategy-first operator game with lane control, command queues, and streamable telemetry.",
		capabilities: ["strategy", "lane-control", "operator-telemetry"],
		personas: ["agent-gamer", "dev-gamer", "user-gamer"],
		session: {
			mode: "spectate-and-steer",
			features: ["commands", "telemetry", "suggestions"],
		},
	},
	{
		appId: "scape",
		packageName: "@elizaos/app-scape",
		displayName: "'scape",
		category: "game",
		launchType: "connect",
		launchUrl: "https://scape-client-2sqyc.kinsta.page",
		runtimePlugin: "@elizaos/app-scape",
		summary:
			"Autonomous RuneScape-like world with journal continuity and operator steering.",
		capabilities: ["autonomous-loop", "journal", "operator-steering"],
		personas: ["agent-gamer", "dev-gamer", "user-gamer"],
		session: {
			mode: "spectate-and-steer",
			features: ["commands", "telemetry", "suggestions", "pause", "resume"],
		},
	},
];

export const SUPPORT_SURFACES: GameAppManifest[] = [
	{
		appId: "companion",
		packageName: "@elizaos/app-companion",
		displayName: "Companion",
		category: "support",
		launchType: "url",
		launchUrl: BRANDING_PROFILE.elizaCloudDashboardUrl,
		runtimePlugin: "@elizaos/app-companion",
		summary:
			"Immersive avatar shell for agent presence, overlays, and in-game companion experiences.",
		capabilities: ["avatar", "presence", "overlay-control"],
		personas: ["agent-gamer", "user-gamer", "dev-gamer"],
		session: {
			mode: "view-only",
			features: ["telemetry", "suggestions"],
		},
	},
	{
		appId: "coding",
		packageName: "@elizaos/app-coding",
		displayName: "Coding Swarm",
		category: "support",
		launchType: "url",
		launchUrl: BRANDING_PROFILE.elizaCloudDashboardUrl,
		runtimePlugin: "@elizaos/app-coding",
		summary:
			"Multi-agent coding surface with terminal persistence, orchestration, and structured summaries.",
		capabilities: ["swarm", "pty", "artifact-retention"],
		personas: ["dev-gamer", "agent-gamer"],
		session: {
			mode: "operator-dashboard",
			features: ["commands", "telemetry", "suggestions"],
		},
	},
	{
		appId: "steward",
		packageName: "@elizaos/app-steward",
		displayName: "Steward",
		category: "support",
		launchType: "url",
		launchUrl: BRANDING_PROFILE.elizaCloudDashboardUrl,
		runtimePlugin: "@elizaos/app-steward",
		summary:
			"Wallet action and approval surface for transfers, trades, and game-linked identity actions.",
		capabilities: ["wallet-approval", "transaction-review", "identity-state"],
		personas: ["user-gamer", "agent-gamer", "dev-gamer"],
		session: {
			mode: "operator-dashboard",
			features: ["commands", "telemetry"],
		},
	},
	{
		appId: "browser",
		packageName: "@elizaos/app-browser",
		displayName: "Browser",
		category: "support",
		launchType: "url",
		launchUrl: BRANDING_PROFILE.elizaCloudDashboardUrl,
		runtimePlugin: "@elizaos/app-browser",
		summary:
			"Controlled workspace for external auth, web tools, and game or creator bridge flows.",
		capabilities: ["web-workspace", "external-auth", "bridge"],
		personas: ["dev-gamer", "user-gamer", "agent-gamer"],
		session: {
			mode: "operator-dashboard",
			features: ["commands", "telemetry"],
		},
	},
];

export const OPERATOR_SURFACES: OperatorSurfaceSpec[] = [
	{
		surfaceId: "babylon-operator-dashboard",
		targetAppId: "babylon",
		controls: ["open-market", "place-prediction", "freeze-market", "settle-market"],
		telemetryPanels: ["market-state", "positions", "event-feed"],
		suggestionsMode: "co-pilot",
		supportsPauseResume: false,
		supportsCommandQueue: true,
		supportsNativeWindowOpen: true,
		detailPanelBehavior: "split-pane",
	},
	{
		surfaceId: "clawville-operator-dashboard",
		targetAppId: "clawville",
		controls: ["assign-goal", "suggest-action", "move-agent", "pause-steering"],
		telemetryPanels: ["world-state", "skill-state", "identity-state"],
		suggestionsMode: "co-pilot",
		supportsPauseResume: true,
		supportsCommandQueue: true,
		supportsNativeWindowOpen: true,
		detailPanelBehavior: "split-pane",
	},
	{
		surfaceId: "defense-agent-control",
		targetAppId: "defense-of-the-agents",
		controls: ["set-priority", "issue-tactical-command", "pause", "resume"],
		telemetryPanels: ["lane-state", "team-state", "command-history"],
		suggestionsMode: "co-pilot",
		supportsPauseResume: true,
		supportsCommandQueue: true,
		supportsNativeWindowOpen: true,
		detailPanelBehavior: "split-pane",
	},
	{
		surfaceId: "scape-operator-dashboard",
		targetAppId: "scape",
		controls: ["inject-directive", "pause-loop", "resume-loop", "redirect-objective"],
		telemetryPanels: ["world-state", "journal-state", "loop-state"],
		suggestionsMode: "co-pilot",
		supportsPauseResume: true,
		supportsCommandQueue: true,
		supportsNativeWindowOpen: true,
		detailPanelBehavior: "split-pane",
	},
	{
		surfaceId: "coding-swarm-surface",
		targetAppId: "coding",
		controls: ["dispatch-task", "pause-agent", "resume-agent", "promote-worktree"],
		telemetryPanels: ["swarm-state", "task-state", "pty-state"],
		suggestionsMode: "assist",
		supportsPauseResume: true,
		supportsCommandQueue: true,
		supportsNativeWindowOpen: false,
		detailPanelBehavior: "split-pane",
	},
];

export const ACTIVE_SURFACES = [...PRIMARY_GAME_APPS, ...SUPPORT_SURFACES];
