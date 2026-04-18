import type { RuntimeState } from "@cartridge/runtime";
import type {
	GameAppManifest,
	GameSessionRecord,
	LaunchType,
	Persona,
} from "@cartridge/shared";

import type { HostDiagnostics } from "./host-diagnostics";

export type WorkspaceWindowInfo = {
	id: number;
	title: string;
	appId: string;
	sessionId: string;
	persona: Persona;
	status: GameSessionRecord["status"];
};

export type SurfaceConnectionStatus =
	| "checking"
	| "ready"
	| "launchable"
	| "starting"
	| "offline"
	| "error";

export type SurfaceConnectionMode =
	| "local-managed"
	| "local-url"
	| "remote-url"
	| "missing";

export type SurfaceConnectionState = {
	appId: string;
	displayName: string;
	launchType: LaunchType;
	launchUrl: string | null;
	mode: SurfaceConnectionMode;
	status: SurfaceConnectionStatus;
	detail: string;
	checkedAt: string | null;
	localRepoDir: string | null;
};

export type RuntimeShellState = RuntimeState & {
	workspaces: WorkspaceWindowInfo[];
	host: HostDiagnostics;
	surfaceConnections: SurfaceConnectionState[];
};

export function coerceSurfaceConnectionState(
	surface: GameAppManifest,
	overrides: Partial<SurfaceConnectionState> = {},
): SurfaceConnectionState {
	return {
		appId: surface.appId,
		displayName: surface.displayName,
		launchType: surface.launchType,
		launchUrl: surface.launchUrl,
		mode: "missing",
		status: "checking",
		detail: "Checking surface reachability.",
	checkedAt: null,
		localRepoDir: null,
		...overrides,
	};
}

export type BabylonOperatorChartPoint = {
	label: string;
	value: number;
};

export type BabylonOperatorMarket = {
	id: string;
	title: string;
	status: string;
	yesPrice: number | null;
	noPrice: number | null;
	volume: number | null;
	liquidity: number | null;
	category: string | null;
	endDate: string | null;
};

export type BabylonOperatorTrade = {
	id: string;
	summary: string;
	timestamp: string;
	pnl: number | null;
};

export type BabylonOperatorTransaction = {
	id: string;
	type: string;
	amount: number;
	timestamp: string;
};

export type BabylonAgentCreationInput = {
	externalId: string;
	name: string;
	description: string;
};

export type BabylonAgentCreationResult = {
	agentId: string;
	apiKey: string | null;
	secret: string | null;
	walletAddress: string | null;
	mode: "external-register" | "onboard";
	detail: string;
};

export type BabylonOperatorSnapshot = {
	status: "ready" | "needs-auth" | "unavailable" | "error";
	source: "route" | "direct" | "none";
	detail: string;
	checkedAt: string;
	agent: {
		id: string | null;
		name: string | null;
		state: string | null;
		walletAddress: string | null;
		totalTrades: number | null;
		winRate: number | null;
		reputationScore: number | null;
	};
	balances: {
		wallet: number | null;
		trading: number | null;
		deposited: number | null;
		withdrawn: number | null;
		lifetimePnl: number | null;
	};
	positions: {
		predictions: number;
		perpetuals: number;
		totalValue: number | null;
		totalUnrealizedPnl: number | null;
	};
	markets: BabylonOperatorMarket[];
	chart: {
		marketId: string | null;
		label: string | null;
		points: BabylonOperatorChartPoint[];
	};
	recentTrades: BabylonOperatorTrade[];
	transactions: BabylonOperatorTransaction[];
	creation: {
		supported: boolean;
		authEnvKey: string | null;
		detail: string;
	};
};

export type ProtocolWorkbenchA2AInterface = {
	url: string;
	transport: string;
	protocolVersion: string | null;
};

export type ProtocolWorkbenchA2ASkill = {
	id: string;
	name: string;
	description: string;
	tags: string[];
};

export type ProtocolWorkbenchA2ASnapshot = {
	status: "ready" | "needs-auth" | "unavailable" | "error";
	detail: string;
	checkedAt: string;
	cardUrl: string;
	endpointUrl: string | null;
	provider: string | null;
	protocolVersion: string | null;
	preferredTransport: string | null;
	interfaces: ProtocolWorkbenchA2AInterface[];
	securitySchemes: string[];
	skills: ProtocolWorkbenchA2ASkill[];
};

export type ProtocolWorkbenchIdentitySnapshot = {
	status: "onchain" | "external" | "needs-config";
	detail: string;
	agentId: string | null;
	walletAddress: string | null;
	chainId: string | null;
	tokenId: string | null;
	registrationMode: "onchain" | "external" | "unknown";
	authMode: "wallet" | "api-key" | "hybrid" | "none";
	headers: string[];
};

export type ProtocolWorkbenchX402Offer = {
	scheme: string | null;
	network: string | null;
	price: string | null;
	payTo: string | null;
	description: string | null;
};

export type ProtocolWorkbenchX402Snapshot = {
	status: "idle" | "payment-required" | "ready" | "error";
	detail: string;
	checkedAt: string | null;
	url: string | null;
	method: "GET" | "POST";
	httpStatus: number | null;
	offers: ProtocolWorkbenchX402Offer[];
	paymentRequiredJson: string | null;
	paymentResponseJson: string | null;
	bodyPreview: string | null;
};

export type ProtocolWorkbenchSnapshot = {
	a2a: ProtocolWorkbenchA2ASnapshot;
	identity: ProtocolWorkbenchIdentitySnapshot;
	x402: ProtocolWorkbenchX402Snapshot;
	docs: {
		a2a: string;
		x402: string;
		erc8004: string;
	};
};

export type ProtocolA2ARequestInput = {
	cardUrl?: string | null;
	endpointUrl?: string | null;
	method: string;
	paramsJson?: string;
};

export type ProtocolA2ARequestResult = {
	status: "ok" | "error";
	detail: string;
	endpointUrl: string | null;
	httpStatus: number | null;
	responseJson: string;
};

export type ProtocolX402ProbeInput = {
	url: string;
	method: "GET" | "POST";
	headersJson?: string;
	bodyJson?: string;
};

export type StewardWorkbenchPolicy = {
	id: string;
	type: string;
	enabled: boolean;
	summary: string;
	configPreview: string;
};

export type StewardWorkbenchApproval = {
	id: string;
	txId: string;
	agentId: string | null;
	agentName: string | null;
	status: string;
	requestedAt: string | null;
	toAddress: string | null;
	value: string | null;
	chainId: number | null;
	txStatus: string | null;
};

export type StewardWorkbenchTransaction = {
	id: string;
	status: string;
	summary: string;
	toAddress: string | null;
	value: string | null;
	chainId: number | null;
	txHash: string | null;
	createdAt: string | null;
};

export type StewardWorkbenchToken = {
	address: string | null;
	symbol: string;
	name: string | null;
	balance: string;
	formatted: string | null;
	valueUsd: string | null;
};

export type StewardWorkbenchWebhookEvent = {
	index: number;
	event: string;
	timestamp: string | null;
	summary: string;
};

export type StewardAgentCreationInput = {
	agentId: string;
	name: string;
	platformId?: string | null;
	tokenExpiresIn?: string | null;
};

export type StewardAgentCreationResult = {
	agentId: string;
	tenantId: string | null;
	evmAddress: string | null;
	solanaAddress: string | null;
	token: string | null;
	detail: string;
};

export type StewardApprovalActionInput = {
	action: "approve" | "deny";
	approvalId: string;
	txId?: string | null;
	agentId?: string | null;
	reason?: string | null;
};

export type StewardApprovalActionResult = {
	status: "ok" | "error";
	approvalId: string;
	txId: string;
	resolvedStatus: string | null;
	txHash: string | null;
	detail: string;
};

export type StewardWorkbenchSnapshot = {
	status: "ready" | "needs-auth" | "unavailable" | "error";
	mode: "cloud-api" | "local-api" | "compat-bridge" | "hybrid" | "unconfigured";
	detail: string;
	checkedAt: string;
	context: {
		apiBase: string | null;
		compatBase: string | null;
		proxyUrl: string | null;
		authMode: "agent-token" | "tenant-key" | "hybrid" | "none";
		agentId: string | null;
		tenantId: string | null;
		chainId: number | null;
	};
	agent: {
		id: string | null;
		name: string | null;
		tenantId: string | null;
		createdAt: string | null;
		walletEvm: string | null;
		walletSolana: string | null;
	};
	balances: {
		nativeRaw: string | null;
		nativeFormatted: string | null;
		symbol: string | null;
		chainId: number | null;
		tokenCount: number;
	};
	spend: {
		todayFormatted: string | null;
		thisWeekFormatted: string | null;
		thisMonthFormatted: string | null;
		pendingApprovals: number;
		recentTransactions: number;
	};
	approvalStats: {
		pending: number;
		approved: number;
		rejected: number;
		total: number;
		avgWaitSeconds: number | null;
	};
	policies: StewardWorkbenchPolicy[];
	approvals: StewardWorkbenchApproval[];
	recentTransactions: StewardWorkbenchTransaction[];
	tokens: StewardWorkbenchToken[];
	webhooks: StewardWorkbenchWebhookEvent[];
	creation: {
		supported: boolean;
		authEnvKey: string | null;
		detail: string;
	};
	docs: {
		overview: string;
		api: string;
		localMode: string;
		eliza: string;
	};
};
