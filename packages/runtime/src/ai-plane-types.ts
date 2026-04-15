/** Probe state for the AI settings UI. */
export type AiLinkStatus = "unknown" | "ok" | "auth_required" | "error" | "offline";

export type ElizaCloudSlice = {
	kind: "eliza-cloud";
	dashboardUrl: string;
	apiBaseUrl: string;
	/** True when a token is available. */
	authenticated: boolean;
	authSource: "env" | "session" | "none";
	status: AiLinkStatus;
	modelIds: string[];
	lastError: string | null;
	/** Scope marker for the Eliza Cloud slice. */
	scopeNote: "gaming-surfaces-only";
};

export type ExternalApiSlice = {
	kind: "external";
	id: "openai" | "anthropic" | "custom-openai";
	label: string;
	/** True when an API key is configured. */
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
	/** Eliza Cloud provider state. */
	elizaCloud: ElizaCloudSlice;
	/** External provider state. */
	external: ExternalApiSlice[];
	/** Local model provider state. */
	local: LocalModelSlice[];
	activeProviderId: string | null;
	activeModelId: string | null;
	lastProbeAt: string | null;
	aggregateProbeError: string | null;
};
