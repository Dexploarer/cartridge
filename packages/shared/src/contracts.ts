export type SurfaceCategory = "game" | "support";

export type Persona = "agent-gamer" | "dev-gamer" | "user-gamer";

export type LaunchType = "connect" | "url" | "native-window";

export type SessionViewer = "embedded" | "native-window" | "external";

export type SessionMode =
	| "spectate-and-steer"
	| "operator-dashboard"
	| "view-only";

export type BrandingProfile = {
	brandId: string;
	appName: string;
	orgName: string;
	packageScope: string;
	docsUrl: string;
	appUrl: string;
	cloudUrl: string;
	/** Eliza Cloud dashboard URL. */
	elizaCloudDashboardUrl: string;
	/** Eliza Cloud API base URL. */
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
	whiteLabel: {
		allowEnvAliasSync: boolean;
		allowThemeOverrides: boolean;
		allowAssetOverrides: boolean;
		allowPackageRename: boolean;
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
	session: {
		mode: SessionMode;
		features: string[];
	};
};

export type SessionLaunchInput = {
	appId: string;
	persona: Persona;
	launchedFrom: string;
	viewer?: SessionViewer;
	suggestionSeed?: string[];
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

export type WalletProfileSpec = {
	profileId: Persona;
	supportedChains: Array<"solana" | "evm">;
	custodyMode: "custodial" | "non-custodial" | "hybrid";
	identityMode: "agent-native" | "linked-user" | "team-managed";
	approvalPolicy: {
		transfers: "manual-signature" | "policy-gated";
		trades: "manual-signature" | "policy-gated";
		gameActions: "auto" | "policy-gated";
	};
	appBindings: string[];
};
