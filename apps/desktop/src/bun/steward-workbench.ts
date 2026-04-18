import type {
	StewardAgentCreationInput,
	StewardAgentCreationResult,
	StewardApprovalActionInput,
	StewardApprovalActionResult,
	StewardWorkbenchApproval,
	StewardWorkbenchPolicy,
	StewardWorkbenchSnapshot,
	StewardWorkbenchToken,
	StewardWorkbenchTransaction,
	StewardWorkbenchWebhookEvent,
} from "../shared/runtime-shell-state";

type FetchLike = typeof fetch;

const STEWARD_OVERVIEW_URL = "https://docs.steward.fi/introduction";
const STEWARD_API_OVERVIEW_URL = "https://docs.steward.fi/api-reference/overview";
const STEWARD_LOCAL_MODE_URL = "https://docs.steward.fi/guides/local-mode";
const STEWARD_ELIZA_URL = "https://docs.steward.fi/guides/eliza-plugin";
const DEFAULT_STEWARD_API_BASE = "https://api.steward.fi";
const DEFAULT_CHAIN_ID = 8453;

type StewardContext = {
	apiBase: string | null;
	compatBase: string | null;
	proxyUrl: string | null;
	agentId: string | null;
	tenantId: string | null;
	agentToken: string | null;
	tenantKey: string | null;
	chainId: number;
	authMode: StewardWorkbenchSnapshot["context"]["authMode"];
	mode: StewardWorkbenchSnapshot["mode"];
};

type StewardLoadResult = {
	snapshot: StewardWorkbenchSnapshot;
	hasData: boolean;
};

class StewardRequestError extends Error {
	status: number;
	body: unknown;

	constructor(message: string, status: number, body: unknown) {
		super(message);
		this.name = "StewardRequestError";
		this.status = status;
		this.body = body;
	}
}

function readEnv(...keys: string[]): string | null {
	for (const key of keys) {
		const value = process.env[key]?.trim();
		if (value) {
			return value;
		}
	}
	return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: null;
}

function asStringValue(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

function asBooleanValue(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function normalizeHttpUrl(raw: string | null | undefined): string | null {
	if (!raw) {
		return null;
	}
	try {
		const url = new URL(raw);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return null;
		}
		return url.toString().replace(/\/+$/, "");
	} catch {
		return null;
	}
}

function normalizeOriginUrl(raw: string | null | undefined): string | null {
	if (!raw) {
		return null;
	}
	try {
		const url = new URL(raw);
		return url.origin;
	} catch {
		return null;
	}
}

function isLoopbackUrl(raw: string | null): boolean {
	if (!raw) {
		return false;
	}
	try {
		const url = new URL(raw);
		return ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
	} catch {
		return false;
	}
}

function trimPreview(raw: string, max = 180): string {
	const value = raw.replace(/\s+/g, " ").trim();
	if (!value) {
		return "";
	}
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function prettyJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

function unwrapStewardEnvelope<T>(value: unknown): T {
	const record = asRecord(value);
	if (record && "ok" in record) {
		return (record["data"] as T) ?? (null as T);
	}
	return value as T;
}

function extractStewardErrorMessage(value: unknown): string | null {
	const record = asRecord(value);
	if (!record) {
		return null;
	}
	return (
		asStringValue(record["error"]) ??
		asStringValue(record["message"]) ??
		asStringValue(asRecord(record["data"])?.["error"])
	);
}

async function requestJson<T>(
	url: string,
	init: RequestInit,
	fetchImpl: FetchLike,
): Promise<T> {
	const headers = new Headers(init.headers);
	headers.set("Accept", "application/json");
	const response = await fetchImpl(url, {
		...init,
		headers,
	});
	const text = await response.text();
	let body: unknown = null;
	if (text.trim().length > 0) {
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
	}
	if (!response.ok) {
		throw new StewardRequestError(
			extractStewardErrorMessage(body) ??
				`${response.status} ${response.statusText}`.trim(),
			response.status,
			body,
		);
	}
	return unwrapStewardEnvelope<T>(body);
}

function resolveStewardContext(): StewardContext {
	const agentToken = readEnv(
		"CARTRIDGE_STEWARD_AGENT_TOKEN",
		"STEWARD_AGENT_TOKEN",
	);
	const tenantKey = readEnv(
		"CARTRIDGE_STEWARD_API_KEY",
		"STEWARD_API_KEY",
	);
	const apiBase =
		normalizeHttpUrl(
			readEnv("CARTRIDGE_STEWARD_API_URL", "STEWARD_API_URL"),
		) ??
		(agentToken || tenantKey ? DEFAULT_STEWARD_API_BASE : null);
	const compatBase = normalizeOriginUrl(
		readEnv(
			"CARTRIDGE_STEWARD_COMPAT_BASE_URL",
			"CARTRIDGE_ROUTE_BASE_URL_STEWARD",
			"STEWARD_COMPAT_BASE_URL",
		),
	);
	const proxyUrl = normalizeHttpUrl(
		readEnv("CARTRIDGE_STEWARD_PROXY_URL", "STEWARD_PROXY_URL"),
	);
	const authMode: StewardWorkbenchSnapshot["context"]["authMode"] =
		agentToken && tenantKey
			? "hybrid"
			: agentToken
				? "agent-token"
				: tenantKey
					? "tenant-key"
					: "none";
	const mode: StewardWorkbenchSnapshot["mode"] = apiBase
		? compatBase
			? "hybrid"
			: isLoopbackUrl(apiBase)
				? "local-api"
				: "cloud-api"
		: compatBase
			? "compat-bridge"
			: "unconfigured";
	return {
		apiBase,
		compatBase,
		proxyUrl,
		agentId: readEnv("CARTRIDGE_STEWARD_AGENT_ID", "STEWARD_AGENT_ID"),
		tenantId: readEnv("CARTRIDGE_STEWARD_TENANT_ID", "STEWARD_TENANT_ID"),
		agentToken,
		tenantKey,
		chainId:
			asFiniteNumber(
				readEnv("CARTRIDGE_STEWARD_CHAIN_ID", "STEWARD_CHAIN_ID"),
			) ?? DEFAULT_CHAIN_ID,
		authMode,
		mode,
	};
}

function buildHeaders(
	context: StewardContext,
	scope: "agent" | "tenant" | "any",
	contentType?: string,
): Headers {
	const headers = new Headers();
	let hasAuth = false;
	if (contentType) {
		headers.set("Content-Type", contentType);
	}
	if (scope === "tenant") {
		if (!context.tenantKey) {
			throw new Error("STEWARD_API_KEY is required for tenant-level Steward calls.");
		}
		headers.set("X-Steward-Key", context.tenantKey);
		hasAuth = true;
		return headers;
	}
	if (scope === "agent") {
		if (context.agentToken) {
			headers.set("Authorization", `Bearer ${context.agentToken}`);
			hasAuth = true;
			return headers;
		}
		if (context.tenantKey) {
			headers.set("X-Steward-Key", context.tenantKey);
			hasAuth = true;
			return headers;
		}
		throw new Error(
			"Set STEWARD_AGENT_TOKEN or STEWARD_API_KEY to access Steward agent state.",
		);
	}
	if (context.agentToken) {
		headers.set("Authorization", `Bearer ${context.agentToken}`);
		hasAuth = true;
	}
	if (context.tenantKey) {
		headers.set("X-Steward-Key", context.tenantKey);
		hasAuth = true;
	}
	if (!hasAuth) {
		throw new Error(
			"Set STEWARD_AGENT_TOKEN or STEWARD_API_KEY to access Steward from Cartridge.",
		);
	}
	return headers;
}

function createEmptySnapshot(
	context: StewardContext,
	checkedAt: string,
): StewardWorkbenchSnapshot {
	return {
		status: "unavailable",
		mode: context.mode,
		detail:
			"Configure Steward API access or start Steward local mode to inspect wallet approvals from Cartridge.",
		checkedAt,
		context: {
			apiBase: context.apiBase,
			compatBase: context.compatBase,
			proxyUrl: context.proxyUrl,
			authMode: context.authMode,
			agentId: context.agentId,
			tenantId: context.tenantId,
			chainId: context.chainId,
		},
		agent: {
			id: null,
			name: null,
			tenantId: context.tenantId,
			createdAt: null,
			walletEvm: null,
			walletSolana: null,
		},
		balances: {
			nativeRaw: null,
			nativeFormatted: null,
			symbol: null,
			chainId: context.chainId,
			tokenCount: 0,
		},
		spend: {
			todayFormatted: null,
			thisWeekFormatted: null,
			thisMonthFormatted: null,
			pendingApprovals: 0,
			recentTransactions: 0,
		},
		approvalStats: {
			pending: 0,
			approved: 0,
			rejected: 0,
			total: 0,
			avgWaitSeconds: null,
		},
		policies: [],
		approvals: [],
		recentTransactions: [],
		tokens: [],
		webhooks: [],
		creation: {
			supported: Boolean(context.apiBase && context.tenantKey),
			authEnvKey: "STEWARD_API_KEY",
			detail: context.apiBase
				? context.tenantKey
					? "Create Steward agents and issue scoped agent tokens from Cartridge."
					: "Set STEWARD_API_KEY to create agents or resolve approvals from Cartridge."
				: "Point Cartridge at STEWARD_API_URL to create Steward agents from the desktop shell.",
		},
		docs: {
			overview: STEWARD_OVERVIEW_URL,
			api: STEWARD_API_OVERVIEW_URL,
			localMode: STEWARD_LOCAL_MODE_URL,
			eliza: STEWARD_ELIZA_URL,
		},
	};
}

function buildPolicySummary(
	type: string,
	config: Record<string, unknown>,
): string {
	switch (type) {
		case "spending-limit": {
			const maxPerTx =
				asStringValue(config["maxPerTransaction"]) ??
				asStringValue(config["maxPerTx"]);
			return [
				maxPerTx ? `Per tx ${maxPerTx}` : null,
				asStringValue(config["maxPerDay"])
					? `Day ${asStringValue(config["maxPerDay"])}`
					: null,
				asStringValue(config["maxPerWeek"])
					? `Week ${asStringValue(config["maxPerWeek"])}`
					: null,
			]
				.filter(Boolean)
				.join(" · ") || "Spend caps enforced.";
		}
		case "approved-addresses": {
			const addresses = asArray(config["addresses"])
				.map((entry) => asStringValue(entry))
				.filter((entry): entry is string => entry !== null);
			return addresses.length > 0
				? `${addresses.length} approved destination${addresses.length === 1 ? "" : "s"}`
				: "Destination whitelist.";
		}
		case "auto-approve-threshold":
			return (
				asStringValue(config["threshold"]) ??
				asStringValue(config["maxValue"]) ??
				"Manual approval required above the configured threshold."
			);
		case "allowed-chains": {
			const chains = asArray(config["chains"])
				.map((entry) => asStringValue(entry))
				.filter((entry): entry is string => entry !== null);
			return chains.length > 0 ? chains.join(", ") : "Chain allowlist.";
		}
		case "rate-limit":
			return [
				asStringValue(config["window"]),
				asFiniteNumber(config["maxRequests"]) != null
					? `${asFiniteNumber(config["maxRequests"])} req`
					: null,
			]
				.filter(Boolean)
				.join(" · ") || "Rate-limited.";
		case "time-window":
			return [
				asStringValue(config["startTime"]),
				asStringValue(config["endTime"]),
			]
				.filter(Boolean)
				.join(" - ") || "Active only during configured hours.";
		default:
			return trimPreview(prettyJson(config), 120) || "Custom Steward policy.";
	}
}

function buildConfigPreview(config: Record<string, unknown>): string {
	return trimPreview(prettyJson(config), 220) || "{}";
}

function parsePolicies(value: unknown): StewardWorkbenchPolicy[] {
	return asArray(value)
		.map((entry, index) => {
			const record = asRecord(entry);
			if (!record) {
				return null;
			}
			const type = asStringValue(record["type"]) ?? "policy";
			const config = asRecord(record["config"]) ?? {};
			return {
				id: asStringValue(record["id"]) ?? `${type}-${index + 1}`,
				type,
				enabled: asBooleanValue(record["enabled"]) ?? true,
				summary: buildPolicySummary(type, config),
				configPreview: buildConfigPreview(config),
			} satisfies StewardWorkbenchPolicy;
		})
		.filter((entry): entry is StewardWorkbenchPolicy => entry !== null);
}

function parseTransactionRecord(value: unknown): StewardWorkbenchTransaction | null {
	const record = asRecord(value);
	if (!record) {
		return null;
	}
	const request = asRecord(record["request"]);
	const toAddress =
		asStringValue(record["toAddress"]) ??
		asStringValue(record["to"]) ??
		asStringValue(request?.["to"]);
	const valueRaw =
		asStringValue(record["value"]) ?? asStringValue(request?.["value"]);
	const chainId =
		asFiniteNumber(record["chainId"]) ?? asFiniteNumber(request?.["chainId"]);
	const txHash =
		asStringValue(record["txHash"]) ?? asStringValue(record["hash"]);
	const policyResults = asArray(record["policyResults"]);
	const summary = [
		toAddress ? `To ${toAddress}` : null,
		valueRaw ? `Value ${valueRaw}` : null,
		policyResults.length > 0 ? `${policyResults.length} policy result${policyResults.length === 1 ? "" : "s"}` : null,
	]
		.filter(Boolean)
		.join(" · ");
	return {
		id: asStringValue(record["id"]) ?? asStringValue(record["txId"]) ?? "tx",
		status: asStringValue(record["status"]) ?? "unknown",
		summary: summary || "Steward transaction record.",
		toAddress,
		value: valueRaw,
		chainId,
		txHash,
		createdAt:
			asStringValue(record["createdAt"]) ??
			asStringValue(record["requestedAt"]) ??
			null,
	};
}

function parseTransactions(value: unknown): StewardWorkbenchTransaction[] {
	return asArray(value)
		.map((entry) => parseTransactionRecord(entry))
		.filter((entry): entry is StewardWorkbenchTransaction => entry !== null);
}

function parseApproval(value: unknown): StewardWorkbenchApproval | null {
	const record = asRecord(value);
	if (!record) {
		return null;
	}
	const transaction = asRecord(record["transaction"]);
	const parsedTx = transaction ? parseTransactionRecord(transaction) : null;
	const txId =
		asStringValue(record["txId"]) ??
		asStringValue(transaction?.["id"]) ??
		asStringValue(record["id"]);
	if (!txId) {
		return null;
	}
	return {
		id:
			asStringValue(record["id"]) ??
			asStringValue(record["queueId"]) ??
			txId,
		txId,
		agentId:
			asStringValue(record["agentId"]) ??
			asStringValue(transaction?.["agentId"]),
		agentName: asStringValue(record["agentName"]),
		status: asStringValue(record["status"]) ?? "pending",
		requestedAt:
			asStringValue(record["requestedAt"]) ??
			asStringValue(transaction?.["createdAt"]) ??
			null,
		toAddress:
			asStringValue(record["toAddress"]) ?? parsedTx?.toAddress ?? null,
		value: asStringValue(record["value"]) ?? parsedTx?.value ?? null,
		chainId: asFiniteNumber(record["chainId"]) ?? parsedTx?.chainId ?? null,
		txStatus:
			asStringValue(record["txStatus"]) ??
			asStringValue(transaction?.["status"]) ??
			null,
	};
}

function parseApprovals(value: unknown): StewardWorkbenchApproval[] {
	return asArray(value)
		.map((entry) => parseApproval(entry))
		.filter((entry): entry is StewardWorkbenchApproval => entry !== null);
}

function parseTokens(value: unknown): StewardWorkbenchToken[] {
	const record = asRecord(value);
	const tokens = asArray(record?.["tokens"]);
	return tokens
		.map((entry) => {
			const token = asRecord(entry);
			if (!token) {
				return null;
			}
			const symbol = asStringValue(token["symbol"]);
			const balance = asStringValue(token["balance"]);
			if (!symbol || !balance) {
				return null;
			}
			return {
				address:
					asStringValue(token["address"]) ??
					asStringValue(token["contractAddress"]) ??
					asStringValue(token["mint"]),
				symbol,
				name: asStringValue(token["name"]),
				balance,
				formatted: asStringValue(token["formatted"]),
				valueUsd: asStringValue(token["valueUsd"]),
			} satisfies StewardWorkbenchToken;
		})
		.filter((entry): entry is StewardWorkbenchToken => entry !== null);
}

function parseWebhookEvents(value: unknown): StewardWorkbenchWebhookEvent[] {
	const record = asRecord(value);
	const events = asArray(record?.["events"]);
	return events
		.map((entry, index) => {
			const event = asRecord(entry);
			if (!event) {
				return null;
			}
			const data = asRecord(event["data"]) ?? {};
			const summary = trimPreview(
				prettyJson(
					Object.keys(data).length > 0
						? data
						: { event: asStringValue(event["event"]) ?? "event" },
				),
				120,
			);
			return {
				index,
				event: asStringValue(event["event"]) ?? "event",
				timestamp: asStringValue(event["timestamp"]),
				summary,
			} satisfies StewardWorkbenchWebhookEvent;
		})
		.filter((entry): entry is StewardWorkbenchWebhookEvent => entry !== null);
}

function mergeSnapshot(
	base: StewardWorkbenchSnapshot,
	source: Partial<StewardWorkbenchSnapshot>,
): void {
	if (source.agent) {
		base.agent = {
			...base.agent,
			...Object.fromEntries(
				Object.entries(source.agent).filter(([, value]) => value != null),
			),
		};
	}
	if (source.balances) {
		base.balances = {
			...base.balances,
			...Object.fromEntries(
				Object.entries(source.balances).filter(([, value]) => value != null),
			),
		};
	}
	if (source.spend) {
		base.spend = {
			...base.spend,
			...Object.fromEntries(
				Object.entries(source.spend).filter(([, value]) => value != null),
			),
		};
	}
	if (source.approvalStats) {
		base.approvalStats = {
			...base.approvalStats,
			...Object.fromEntries(
				Object.entries(source.approvalStats).filter(([, value]) => value != null),
			),
		};
	}
	if (source.policies && base.policies.length === 0) {
		base.policies = source.policies;
	}
	if (source.approvals && base.approvals.length === 0) {
		base.approvals = source.approvals;
	}
	if (source.recentTransactions && base.recentTransactions.length === 0) {
		base.recentTransactions = source.recentTransactions;
	}
	if (source.tokens && base.tokens.length === 0) {
		base.tokens = source.tokens;
	}
	if (source.webhooks && base.webhooks.length === 0) {
		base.webhooks = source.webhooks;
	}
}

function buildReadyDetail(snapshot: StewardWorkbenchSnapshot): string {
	const pending = Math.max(
		snapshot.approvalStats.pending,
		snapshot.spend.pendingApprovals,
	);
	const scope = snapshot.agent.id
		? `Tracking ${snapshot.agent.id}`
		: snapshot.context.tenantId
			? `Tenant ${snapshot.context.tenantId} connected`
			: "Steward is reachable";
	const extras = [
		pending > 0 ? `${pending} pending approval${pending === 1 ? "" : "s"}` : null,
		snapshot.policies.length > 0
			? `${snapshot.policies.length} active polic${snapshot.policies.length === 1 ? "y" : "ies"}`
			: null,
		snapshot.balances.nativeFormatted
			? `${snapshot.balances.nativeFormatted} ${snapshot.balances.symbol ?? ""}`.trim()
			: null,
	]
		.filter(Boolean)
		.join(" · ");
	const location =
		snapshot.mode === "local-api"
			? "Steward local mode is live."
			: snapshot.mode === "compat-bridge"
				? "Steward compat bridge is live."
				: snapshot.mode === "hybrid"
					? "Steward API and compat bridge are live."
					: "Steward API is live.";
	return [location, scope, extras].filter(Boolean).join(" ");
}

function buildNeedsAuthDetail(context: StewardContext): string {
	const base = context.apiBase ?? context.compatBase ?? "Steward";
	if (!context.agentToken && !context.tenantKey) {
		return `${base} is configured, but Cartridge needs STEWARD_AGENT_TOKEN or STEWARD_API_KEY. Set STEWARD_AGENT_ID as well to load a specific agent.`;
	}
	if (!context.agentId && !context.tenantKey) {
		return "Steward agent access is present, but STEWARD_AGENT_ID is missing.";
	}
	return "Steward tenant actions such as approvals and agent creation require STEWARD_API_KEY.";
}

async function loadDirectSnapshot(
	context: StewardContext,
	fetchImpl: FetchLike,
	checkedAt: string,
): Promise<StewardLoadResult> {
	const snapshot = createEmptySnapshot(context, checkedAt);
	if (!context.apiBase) {
		return { snapshot, hasData: false };
	}

	const hasAgentAccess = Boolean(context.agentId && (context.agentToken || context.tenantKey));
	const hasTenantAccess = Boolean(context.tenantKey);

	const dashboardPromise = hasAgentAccess
		? requestJson<Record<string, unknown>>(
				`${context.apiBase}/dashboard/${encodeURIComponent(context.agentId!)}`,
				{ headers: buildHeaders(context, "agent") },
				fetchImpl,
			)
		: Promise.resolve(null);
	const agentPromise = hasAgentAccess
		? requestJson<Record<string, unknown>>(
				`${context.apiBase}/agents/${encodeURIComponent(context.agentId!)}`,
				{ headers: buildHeaders(context, "agent") },
				fetchImpl,
			).catch(() => null)
		: Promise.resolve(null);
	const tokensPromise = hasAgentAccess
		? requestJson<Record<string, unknown>>(
				`${context.apiBase}/agents/${encodeURIComponent(context.agentId!)}/tokens?chainId=${context.chainId}`,
				{ headers: buildHeaders(context, "agent") },
				fetchImpl,
			).catch(() => null)
		: Promise.resolve(null);
	const approvalsPromise = hasTenantAccess
		? requestJson<unknown[]>(
				`${context.apiBase}/approvals?status=pending&limit=8`,
				{ headers: buildHeaders(context, "tenant") },
				fetchImpl,
			).catch(async () => {
				if (!hasAgentAccess) {
					return [];
				}
				return requestJson<unknown[]>(
					`${context.apiBase}/vault/${encodeURIComponent(context.agentId!)}/pending`,
					{ headers: buildHeaders(context, "agent") },
					fetchImpl,
				).catch(() => []);
			})
		: hasAgentAccess
			? requestJson<unknown[]>(
					`${context.apiBase}/vault/${encodeURIComponent(context.agentId!)}/pending`,
					{ headers: buildHeaders(context, "agent") },
					fetchImpl,
				).catch(() => [])
			: Promise.resolve([]);
	const approvalStatsPromise = hasTenantAccess
		? requestJson<Record<string, unknown>>(
				`${context.apiBase}/approvals/stats`,
				{ headers: buildHeaders(context, "tenant") },
				fetchImpl,
			).catch(() => null)
		: Promise.resolve(null);

	const [dashboard, agent, tokensValue, approvalsValue, approvalStatsValue] =
		await Promise.all([
			dashboardPromise,
			agentPromise,
			tokensPromise,
			approvalsPromise,
			approvalStatsPromise,
		]);

	let hasData = false;
	const dashboardRecord = asRecord(dashboard);
	const dashboardAgent = asRecord(dashboardRecord?.["agent"]);
	if (dashboardAgent) {
		hasData = true;
		snapshot.agent = {
			id: asStringValue(dashboardAgent["id"]) ?? snapshot.agent.id,
			name: asStringValue(dashboardAgent["name"]),
			tenantId:
				asStringValue(dashboardAgent["tenantId"]) ?? snapshot.agent.tenantId,
			createdAt: asStringValue(dashboardAgent["createdAt"]),
			walletEvm:
				asStringValue(dashboardAgent["walletAddress"]) ??
				snapshot.agent.walletEvm,
			walletSolana: snapshot.agent.walletSolana,
		};
	}

	const balances = asRecord(dashboardRecord?.["balances"]);
	const evmBalance = asRecord(balances?.["evm"]);
	if (evmBalance) {
		hasData = true;
		snapshot.balances = {
			nativeRaw: asStringValue(evmBalance["native"]),
			nativeFormatted: asStringValue(evmBalance["nativeFormatted"]),
			symbol: asStringValue(evmBalance["symbol"]),
			chainId: asFiniteNumber(evmBalance["chainId"]) ?? context.chainId,
			tokenCount: snapshot.balances.tokenCount,
		};
	}

	const spend = asRecord(dashboardRecord?.["spend"]);
	if (spend) {
		hasData = true;
		snapshot.spend = {
			todayFormatted: asStringValue(spend["todayFormatted"]),
			thisWeekFormatted: asStringValue(spend["thisWeekFormatted"]),
			thisMonthFormatted: asStringValue(spend["thisMonthFormatted"]),
			pendingApprovals:
				asFiniteNumber(dashboardRecord?.["pendingApprovals"]) ?? 0,
			recentTransactions: asArray(dashboardRecord?.["recentTransactions"]).length,
		};
	}

	const agentRecord = asRecord(agent);
	if (agentRecord) {
		hasData = true;
		const walletAddresses = asRecord(agentRecord["walletAddresses"]);
		mergeSnapshot(snapshot, {
			agent: {
				id: asStringValue(agentRecord["id"]),
				name: asStringValue(agentRecord["name"]),
				tenantId: asStringValue(agentRecord["tenantId"]),
				createdAt: asStringValue(agentRecord["createdAt"]),
				walletEvm:
					asStringValue(walletAddresses?.["evm"]) ??
					snapshot.agent.walletEvm,
				walletSolana: asStringValue(walletAddresses?.["solana"]),
			},
		});
	}

	const policies = parsePolicies(dashboardRecord?.["policies"]);
	if (policies.length > 0) {
		hasData = true;
		snapshot.policies = policies;
	}

	const recentTransactions = parseTransactions(
		dashboardRecord?.["recentTransactions"],
	);
	if (recentTransactions.length > 0) {
		hasData = true;
		snapshot.recentTransactions = recentTransactions;
		snapshot.spend.recentTransactions = recentTransactions.length;
	}

	const approvals = parseApprovals(approvalsValue);
	if (approvals.length > 0) {
		hasData = true;
		snapshot.approvals = approvals;
		if (snapshot.spend.pendingApprovals === 0) {
			snapshot.spend.pendingApprovals = approvals.length;
		}
	}

	const approvalStats = asRecord(approvalStatsValue);
	if (approvalStats) {
		hasData = true;
		snapshot.approvalStats = {
			pending: asFiniteNumber(approvalStats["pending"]) ?? 0,
			approved: asFiniteNumber(approvalStats["approved"]) ?? 0,
			rejected: asFiniteNumber(approvalStats["rejected"]) ?? 0,
			total: asFiniteNumber(approvalStats["total"]) ?? 0,
			avgWaitSeconds: asFiniteNumber(approvalStats["avgWaitSeconds"]),
		};
	}

	const tokens = parseTokens(tokensValue);
	if (tokens.length > 0) {
		hasData = true;
		snapshot.tokens = tokens;
		snapshot.balances.tokenCount = tokens.length;
	}

	return { snapshot, hasData };
}

async function loadCompatSnapshot(
	context: StewardContext,
	fetchImpl: FetchLike,
	checkedAt: string,
): Promise<StewardLoadResult> {
	const snapshot = createEmptySnapshot(context, checkedAt);
	if (!context.compatBase) {
		return { snapshot, hasData: false };
	}

	const headers = buildHeaders(context, "any");
	const status = await requestJson<Record<string, unknown>>(
		`${context.compatBase}/api/wallet/steward-status`,
		{ headers },
		fetchImpl,
	);

	const configured = asBooleanValue(status["configured"]) ?? false;
	const available = asBooleanValue(status["available"]) ?? false;
	const connected = asBooleanValue(status["connected"]) ?? false;

	mergeSnapshot(snapshot, {
		agent: {
			id: asStringValue(status["agentId"]) ?? context.agentId,
			name: asStringValue(status["agentName"]),
			tenantId: context.tenantId,
			createdAt: null,
			walletEvm:
				asStringValue(status["evmAddress"]) ??
				asStringValue(asRecord(status["walletAddresses"])?.["evm"]),
			walletSolana: asStringValue(asRecord(status["walletAddresses"])?.["solana"]),
		},
	});

	if (!configured && !available) {
		snapshot.detail =
			"Steward compat bridge is reachable, but the upstream agent has not been configured yet.";
		return { snapshot, hasData: false };
	}

	const [
		policiesValue,
		historyValue,
		pendingValue,
		balanceValue,
		tokensValue,
		webhooksValue,
	] = await Promise.all([
		requestJson<unknown[]>(
			`${context.compatBase}/api/wallet/steward-policies`,
			{ headers },
			fetchImpl,
		).catch(() => []),
		requestJson<Record<string, unknown>>(
			`${context.compatBase}/api/wallet/steward-tx-records?limit=8`,
			{ headers },
			fetchImpl,
		).catch(() => ({ records: [] })),
		requestJson<unknown[]>(
			`${context.compatBase}/api/wallet/steward-pending-approvals`,
			{ headers },
			fetchImpl,
		).catch(() => []),
		requestJson<Record<string, unknown>>(
			`${context.compatBase}/api/wallet/steward-balances?chainId=${context.chainId}`,
			{ headers },
			fetchImpl,
		).catch(() => ({})),
		requestJson<Record<string, unknown>>(
			`${context.compatBase}/api/wallet/steward-tokens?chainId=${context.chainId}`,
			{ headers },
			fetchImpl,
		).catch(() => ({})),
		requestJson<Record<string, unknown>>(
			`${context.compatBase}/api/wallet/steward-webhook-events?since=0`,
			{ headers },
			fetchImpl,
		).catch(() => ({ events: [] })),
	]);

	const policies = parsePolicies(policiesValue);
	const recentTransactions = parseTransactions(
		asRecord(historyValue)?.["records"] ?? historyValue,
	);
	const approvals = parseApprovals(pendingValue);
	const balance = asRecord(balanceValue);
	const tokens = parseTokens(tokensValue);
	const webhooks = parseWebhookEvents(webhooksValue);

	if (balance) {
		snapshot.balances = {
			nativeRaw: asStringValue(balance["balance"]),
			nativeFormatted: asStringValue(balance["formatted"]),
			symbol: asStringValue(balance["symbol"]),
			chainId: asFiniteNumber(balance["chainId"]) ?? context.chainId,
			tokenCount: tokens.length,
		};
	}
	snapshot.policies = policies;
	snapshot.recentTransactions = recentTransactions;
	snapshot.approvals = approvals;
	snapshot.tokens = tokens;
	snapshot.webhooks = webhooks;
	snapshot.spend.pendingApprovals = approvals.length;
	snapshot.spend.recentTransactions = recentTransactions.length;
	snapshot.approvalStats.pending = approvals.length;
	snapshot.approvalStats.total = approvals.length;
	snapshot.detail = connected
		? "Steward compat bridge is connected."
		: "Steward compat bridge is available but not fully connected.";

	return {
		snapshot,
		hasData:
			connected ||
			policies.length > 0 ||
			recentTransactions.length > 0 ||
			approvals.length > 0 ||
			tokens.length > 0 ||
			snapshot.agent.id !== null,
	};
}

export async function getStewardWorkbenchSnapshot(options: {
	fetchImpl?: FetchLike;
} = {}): Promise<StewardWorkbenchSnapshot> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const context = resolveStewardContext();
	const checkedAt = new Date().toISOString();
	const snapshot = createEmptySnapshot(context, checkedAt);

	if (!context.apiBase && !context.compatBase) {
		snapshot.detail =
			"Steward is not configured. Set STEWARD_API_URL or start local mode at http://127.0.0.1:3200, then provide STEWARD_AGENT_TOKEN or STEWARD_API_KEY.";
		return snapshot;
	}

	const results = await Promise.allSettled([
		loadDirectSnapshot(context, fetchImpl, checkedAt),
		loadCompatSnapshot(context, fetchImpl, checkedAt),
	]);
	const directResult =
		results[0].status === "fulfilled" ? results[0].value : null;
	const compatResult =
		results[1].status === "fulfilled" ? results[1].value : null;
	const errors = results
		.filter((result): result is PromiseRejectedResult => result.status === "rejected")
		.map((result) => result.reason);

	if (directResult?.hasData) {
		mergeSnapshot(snapshot, directResult.snapshot);
	}
	if (compatResult?.hasData) {
		mergeSnapshot(snapshot, compatResult.snapshot);
	}

	const hasData =
		directResult?.hasData ||
		compatResult?.hasData ||
		snapshot.agent.id !== null;

	if (hasData) {
		snapshot.status = "ready";
		snapshot.detail = buildReadyDetail(snapshot);
		return snapshot;
	}

	const authError = errors.find(
		(error) =>
			error instanceof StewardRequestError &&
			(error.status === 401 || error.status === 403),
	);
	if (authError || context.authMode === "none" || (!context.agentId && !context.tenantKey)) {
		snapshot.status = "needs-auth";
		snapshot.detail = buildNeedsAuthDetail(context);
		return snapshot;
	}

	if (errors.length > 0) {
		snapshot.status = "error";
		snapshot.detail = errors[0] instanceof Error ? errors[0].message : "Failed to load Steward state.";
		return snapshot;
	}

	return snapshot;
}

export async function createStewardAgent(options: {
	request: StewardAgentCreationInput;
	fetchImpl?: FetchLike;
}): Promise<StewardAgentCreationResult> {
	const context = resolveStewardContext();
	if (!context.apiBase) {
		throw new Error(
			"Set STEWARD_API_URL before creating Steward agents from Cartridge.",
		);
	}
	const headers = buildHeaders(context, "tenant", "application/json");
	const agentId = options.request.agentId.trim();
	const name = options.request.name.trim();
	if (!agentId || !name) {
		throw new Error("Steward agent creation requires both agentId and name.");
	}
	const fetchImpl = options.fetchImpl ?? fetch;
	const created = await requestJson<Record<string, unknown>>(
		`${context.apiBase}/agents`,
		{
			method: "POST",
			headers,
			body: JSON.stringify({
				id: agentId,
				name,
				platformId: options.request.platformId?.trim() || undefined,
			}),
		},
		fetchImpl,
	);
	let token: string | null = null;
	const expiresIn = options.request.tokenExpiresIn?.trim();
	if (expiresIn) {
		const tokenResult = await requestJson<Record<string, unknown>>(
			`${context.apiBase}/agents/${encodeURIComponent(agentId)}/token`,
			{
				method: "POST",
				headers,
				body: JSON.stringify({ expiresIn }),
			},
			fetchImpl,
		).catch(() => null);
		token = asStringValue(asRecord(tokenResult)?.["token"]);
	}
	const walletAddresses = asRecord(created["walletAddresses"]);
	return {
		agentId: asStringValue(created["id"]) ?? agentId,
		tenantId:
			asStringValue(created["tenantId"]) ?? context.tenantId,
		evmAddress: asStringValue(walletAddresses?.["evm"]),
		solanaAddress: asStringValue(walletAddresses?.["solana"]),
		token,
		detail: token
			? `Created Steward agent ${agentId} and issued a scoped token.`
			: `Created Steward agent ${agentId}.`,
	};
}

export async function resolveStewardApprovalAction(options: {
	request: StewardApprovalActionInput;
	fetchImpl?: FetchLike;
}): Promise<StewardApprovalActionResult> {
	const context = resolveStewardContext();
	const fetchImpl = options.fetchImpl ?? fetch;
	const action = options.request.action;
	const txId =
		options.request.txId?.trim() || options.request.approvalId.trim();
	const approvalId = options.request.approvalId.trim() || txId;
	const agentId = options.request.agentId?.trim() || context.agentId;
	const denyReason =
		options.request.reason?.trim() || "Denied from Cartridge";

	if (!txId) {
		throw new Error("Steward approval actions require a txId or approvalId.");
	}

	if (context.apiBase && context.tenantKey) {
		const headers = buildHeaders(context, "tenant", "application/json");
		const primaryPath =
			action === "approve" ? "approve" : "deny";
		try {
			const result = await requestJson<Record<string, unknown>>(
				`${context.apiBase}/approvals/${encodeURIComponent(txId)}/${primaryPath}`,
				{
					method: "POST",
					headers,
					body:
						action === "deny"
							? JSON.stringify({ reason: denyReason })
							: JSON.stringify({ approvedBy: "cartridge" }),
				},
				fetchImpl,
			);
			return {
				status: "ok",
				approvalId,
				txId,
				resolvedStatus:
					asStringValue(result["status"]) ??
					(action === "approve" ? "approved" : "rejected"),
				txHash: asStringValue(result["txHash"]),
				detail:
					action === "approve"
						? `Approved Steward transaction ${txId}.`
						: `Denied Steward transaction ${txId}.`,
			};
		} catch (error) {
			if (!(error instanceof StewardRequestError) || error.status !== 404 || !agentId) {
				throw error;
			}
			const fallbackPath = action === "approve" ? "approve" : "reject";
			const result = await requestJson<Record<string, unknown>>(
				`${context.apiBase}/vault/${encodeURIComponent(agentId)}/${fallbackPath}/${encodeURIComponent(txId)}`,
				{
					method: "POST",
					headers,
					body:
						action === "deny"
							? JSON.stringify({ reason: denyReason })
							: JSON.stringify({}),
				},
				fetchImpl,
			);
			return {
				status: "ok",
				approvalId,
				txId,
				resolvedStatus:
					asStringValue(result["status"]) ??
					(action === "approve" ? "approved" : "rejected"),
				txHash: asStringValue(result["txHash"]),
				detail:
					action === "approve"
						? `Approved Steward transaction ${txId}.`
						: `Denied Steward transaction ${txId}.`,
			};
		}
	}

	if (context.compatBase) {
		const headers = buildHeaders(context, "any", "application/json");
		const result = await requestJson<Record<string, unknown>>(
			`${context.compatBase}/api/wallet/${
				action === "approve" ? "steward-approve-tx" : "steward-deny-tx"
			}`,
			{
				method: "POST",
				headers,
				body: JSON.stringify(
					action === "approve"
						? { txId }
						: { txId, reason: denyReason },
				),
			},
			fetchImpl,
		);
		return {
			status: "ok",
			approvalId,
			txId,
			resolvedStatus:
				asStringValue(result["status"]) ??
				(action === "approve" ? "approved" : "rejected"),
			txHash: asStringValue(result["txHash"]),
			detail:
				action === "approve"
					? `Approved Steward transaction ${txId}.`
					: `Denied Steward transaction ${txId}.`,
		};
	}

	throw new Error(
		"Steward approval actions require STEWARD_API_KEY or a compat bridge.",
	);
}
