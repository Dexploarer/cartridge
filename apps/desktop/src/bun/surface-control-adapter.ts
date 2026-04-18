import type {
	AppendTelemetryInput,
	GameAppManifest,
	GameSessionRecord,
	OperatorCommand,
	OperatorCommandPayload,
	Persona,
	SurfaceTakeoverState,
	WorkspaceViewControlMode,
	WorkspaceViewDescriptor,
} from "@cartridge/shared";
import type {
	BabylonAgentCreationInput,
	BabylonAgentCreationResult,
	BabylonOperatorChartPoint,
	BabylonOperatorMarket,
	BabylonOperatorSnapshot,
	BabylonOperatorTrade,
	BabylonOperatorTransaction,
} from "../shared/runtime-shell-state";

import { resolveLocalSurfaceLaunch } from "./local-surface-config";

type FetchLike = typeof fetch;

export type ResolvedSurfaceWorkspace = {
	agentView: WorkspaceViewDescriptor;
	userView: WorkspaceViewDescriptor | null;
	takeoverState: SurfaceTakeoverState;
	sessionNote: string | null;
	launchUrlOverride: string | null;
	dispatchMode: "child-window" | "http" | "unsupported";
};

export type SurfaceDispatchResult = {
	status: "executed" | "failed";
	result: string;
	frames?: AppendTelemetryInput;
	sessionNote?: string | null;
	takeoverState?: SurfaceTakeoverState;
};

type SurfaceRouteContext = {
	baseUrl: string | null;
	agentId: string | null;
	agentSecret: string | null;
	characterId: string | null;
};

type BabylonRouteContext = SurfaceRouteContext & {
	routeBase: string | null;
	apiOrigin: string | null;
	agentApiKey: string | null;
	agentAddress: string | null;
	userAuthToken: string | null;
};

type BabylonToken = {
	cacheKey: string;
	token: string;
	expiresAt: number;
};

let cachedBabylonToken: BabylonToken | null = null;

function readEnv(...keys: string[]): string | null {
	for (const key of keys) {
		const value = process.env[key]?.trim();
		if (value) {
			return value;
		}
	}
	return null;
}

function normalizeBaseUrl(
	raw: string | null | undefined,
	pathname: string,
): string | null {
	if (!raw) {
		return null;
	}
	try {
		const url = new URL(raw);
		if (!url.pathname.startsWith(pathname)) {
			url.pathname = pathname;
		}
		url.search = "";
		url.hash = "";
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
		url.pathname = "";
		url.search = "";
		url.hash = "";
		return url.origin;
	} catch {
		return null;
	}
}

function withSearchParam(
	rawUrl: string,
	key: string,
	value: string,
): string {
	try {
		const url = new URL(rawUrl);
		url.searchParams.set(key, value);
		return url.toString();
	} catch {
		return rawUrl;
	}
}

function trimText(raw: string | null | undefined, max = 120): string {
	const value = (raw ?? "").replace(/\s+/g, " ").trim();
	if (!value) {
		return "No live telemetry yet.";
	}
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function createView(
	role: WorkspaceViewDescriptor["role"],
	label: string,
	url: string,
	controlMode: WorkspaceViewControlMode,
): WorkspaceViewDescriptor {
	return {
		role,
		label,
		url,
		controlMode,
		capturePriority: role === "agent" ? "primary" : "secondary",
	};
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: null;
}

function asFiniteNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: typeof value === "string" && value.trim().length > 0
			? Number.isFinite(Number(value))
				? Number(value)
				: null
			: null;
}

function asStringValue(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

function unwrapDataEnvelope(value: unknown): Record<string, unknown> | null {
	const record = asRecord(value);
	if (!record) {
		return null;
	}
	return asRecord(record["data"]) ?? record;
}

function asItemsArray(value: unknown): unknown[] {
	if (Array.isArray(value)) {
		return value;
	}
	const record = asRecord(value);
	if (!record) {
		return [];
	}
	for (const key of [
		"items",
		"markets",
		"transactions",
		"history",
		"points",
		"prices",
		"data",
	]) {
		if (Array.isArray(record[key])) {
			return record[key] as unknown[];
		}
	}
	return [];
}

function resolveSurfaceBaseLaunch(
	appId: string,
	persona: Persona,
	launchUrl: string | null | undefined,
): { url: string | null; sessionNote: string | null } {
	const resolved = resolveLocalSurfaceLaunch(appId, persona, launchUrl);
	return {
		url: resolved.embedUrl ?? launchUrl?.trim() ?? null,
		sessionNote: resolved.sessionNote,
	};
}

function resolveBabylonContext(launchUrl: string | null): BabylonRouteContext {
	const routeBase = normalizeBaseUrl(
		readEnv("CARTRIDGE_ROUTE_BASE_URL_BABYLON"),
		"/api/apps/babylon",
	);
	const apiOrigin =
		normalizeOriginUrl(
			readEnv(
				"BABYLON_API_URL",
				"BABYLON_APP_URL",
				"BABYLON_CLIENT_URL",
			),
		) ?? normalizeOriginUrl(launchUrl);
	return {
		baseUrl: routeBase ?? apiOrigin,
		routeBase,
		apiOrigin,
		agentId: readEnv("BABYLON_AGENT_ID"),
		agentSecret: readEnv("BABYLON_AGENT_SECRET"),
		agentApiKey: readEnv("BABYLON_A2A_API_KEY", "BABYLON_API_KEY"),
		agentAddress: readEnv("BABYLON_AGENT_ADDRESS", "BABYLON_WALLET_ADDRESS"),
		userAuthToken: readEnv(
			"CARTRIDGE_BABYLON_AUTH_TOKEN",
			"BABYLON_USER_AUTH_TOKEN",
			"BABYLON_PRIVY_TOKEN",
		),
		characterId: null,
	};
}

function resolveScapeContext(launchUrl: string | null): SurfaceRouteContext {
	const routeBase =
		normalizeBaseUrl(
			readEnv(
				"CARTRIDGE_ROUTE_BASE_URL_SCAPE",
				"SCAPE_ROUTE_BASE_URL",
				"SCAPE_APP_URL",
			),
			"/api/apps/scape",
		) ?? normalizeBaseUrl(launchUrl, "/api/apps/scape");
	return {
		baseUrl: routeBase,
		agentId: readEnv("SCAPE_AGENT_ID"),
		agentSecret: null,
		characterId: null,
	};
}

function resolveHyperscapeContext(launchUrl: string | null): SurfaceRouteContext {
	const baseUrl =
		normalizeOriginUrl(
			readEnv(
				"CARTRIDGE_ROUTE_BASE_URL_HYPERSCAPE",
				"HYPERSCAPE_API_URL",
				"HYPERSCAPE_CLIENT_URL",
			),
		) ?? normalizeOriginUrl(launchUrl);
	return {
		baseUrl,
		agentId: readEnv("CARTRIDGE_AGENT_ID_HYPERSCAPE", "HYPERSCAPE_AGENT_ID"),
		agentSecret: null,
		characterId: readEnv("HYPERSCAPE_CHARACTER_ID"),
	};
}

function canDriveHostedSurface(
	appId: string,
	launchUrl: string | null,
): boolean {
	switch (appId) {
		case "babylon": {
			const context = resolveBabylonContext(launchUrl);
			return Boolean(
				context.routeBase ||
					(context.apiOrigin &&
						context.agentId &&
						(context.agentSecret || context.agentApiKey)),
			);
		}
		case "scape": {
			const context = resolveScapeContext(launchUrl);
			return Boolean(context.baseUrl && context.agentId);
		}
		case "hyperscape":
			return false;
		default:
			return true;
	}
}

export function resolveSurfaceWorkspace(input: {
	surface: GameAppManifest;
	persona: Persona;
	splitPlay: boolean;
	launchUrl: string | null | undefined;
}): ResolvedSurfaceWorkspace {
	const resolved = resolveSurfaceBaseLaunch(
		input.surface.appId,
		input.persona,
		input.launchUrl,
	);
	const baseUrl = resolved.url?.trim() || "about:blank";
	const splitPlay = input.splitPlay === true;
	const supportedUserInput = input.surface.workspace?.userInput ?? "watch-only";
	const intendedDispatchMode =
		input.surface.appId === "kinema"
			? "child-window"
			: input.surface.workspace?.controlTransport
				? "http"
				: "unsupported";
	const controlReady = canDriveHostedSurface(input.surface.appId, baseUrl);
	const agentControlMode: WorkspaceViewControlMode =
		controlReady || input.surface.appId === "kinema"
			? input.persona === "user-gamer"
				? "user-controlled"
				: "agent-controlled"
			: "watch-only";

	let userView: WorkspaceViewDescriptor | null = null;
	if (splitPlay) {
		const userMode: WorkspaceViewControlMode =
			supportedUserInput === "watch-only" ? "watch-only" : "user-controlled";
		const userUrl =
			input.surface.appId === "kinema"
				? resolveSurfaceBaseLaunch(input.surface.appId, "user-gamer", input.launchUrl)
						.url ?? baseUrl
				: withSearchParam(baseUrl, "cartridgePane", "user");
		userView = createView("user", "User pane", userUrl, userMode);
	}

	const agentUrl =
		input.surface.appId === "kinema"
			? baseUrl
			: withSearchParam(baseUrl, "cartridgePane", "agent");
	let sessionNote = resolved.sessionNote;

	if (input.surface.appId === "hyperscape" && splitPlay) {
		sessionNote =
			"User pane is watch-only for Hyperscape until safe takeover hooks are exposed upstream.";
	} else if (!controlReady && input.surface.appId !== "kinema") {
		sessionNote = `${
			input.surface.displayName
		} launched in watch mode. Agent control is unavailable until ${
			input.surface.appId === "scape"
				? "CARTRIDGE_ROUTE_BASE_URL_SCAPE and SCAPE_AGENT_ID"
				: input.surface.appId === "babylon"
					? "CARTRIDGE_ROUTE_BASE_URL_BABYLON or Babylon agent credentials"
					: "an upstream control route is available"
		} are configured.`;
	}

	return {
		agentView: createView("agent", "Agent pane", agentUrl, agentControlMode),
		userView,
		takeoverState:
			input.persona === "user-gamer"
				? "user-takeover"
				: splitPlay
					? "user-observing"
					: "agent-active",
		sessionNote,
		launchUrlOverride: agentUrl,
		dispatchMode:
			controlReady || input.surface.appId === "kinema"
				? intendedDispatchMode
				: "unsupported",
	};
}

async function readResponseJsonOrText(
	response: Response,
): Promise<{ json: unknown | null; text: string }> {
	const text = await response.text();
	if (!text.trim()) {
		return { json: null, text: "" };
	}
	try {
		return { json: JSON.parse(text), text };
	} catch {
		return { json: null, text };
	}
}

async function fetchJson(
	fetchImpl: FetchLike,
	url: string,
	init?: RequestInit,
): Promise<unknown> {
	const response = await fetchImpl(url, {
		...init,
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(text || `${response.status} ${response.statusText}`);
	}
	return response.json();
}

async function fetchOptionalJson(
	fetchImpl: FetchLike,
	url: string | URL,
	init?: RequestInit,
): Promise<unknown | null> {
	try {
		const response = await fetchImpl(url, {
			...init,
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) {
			return null;
		}
		const parsed = await readResponseJsonOrText(response);
		return parsed.json ?? null;
	} catch {
		return null;
	}
}

function extractMarketArray(value: unknown): BabylonOperatorMarket[] {
	return asItemsArray(unwrapDataEnvelope(value) ?? value)
		.map((item) => {
			const record = asRecord(item);
			const id = asStringValue(record?.["id"]);
			const title =
				asStringValue(record?.["title"]) ??
				asStringValue(record?.["question"]) ??
				asStringValue(record?.["name"]);
			if (!record || !id || !title) {
				return null;
			}
			return {
				id,
				title,
				status: asStringValue(record["status"]) ?? "unknown",
				yesPrice: asFiniteNumber(record["yesPrice"]),
				noPrice: asFiniteNumber(record["noPrice"]),
				volume: asFiniteNumber(record["volume"]),
				liquidity: asFiniteNumber(record["liquidity"]),
				category: asStringValue(record["category"]),
				endDate:
					asStringValue(record["endDate"]) ??
					asStringValue(record["closesAt"]) ??
					asStringValue(record["expiresAt"]),
			} satisfies BabylonOperatorMarket;
		})
		.filter((item): item is BabylonOperatorMarket => item !== null);
}

function extractTradeArray(value: unknown): BabylonOperatorTrade[] {
	return asItemsArray(unwrapDataEnvelope(value) ?? value)
		.map((item, index) => {
			const record = asRecord(item);
			if (!record) {
				return null;
			}
			const summary =
				asStringValue(record["summary"]) ??
				[
					asStringValue(record["action"]) ?? asStringValue(record["side"]),
					asStringValue(record["ticker"]) ?? asStringValue(record["marketId"]),
					asFiniteNumber(record["amount"]) != null
						? `$${asFiniteNumber(record["amount"])!.toFixed(2)}`
						: null,
				]
					.filter(Boolean)
					.join(" ");
			return {
				id: asStringValue(record["id"]) ?? `trade-${index}`,
				summary: summary || "Trade activity",
				timestamp:
					asStringValue(record["timestamp"]) ??
					asStringValue(record["createdAt"]) ??
					new Date(0).toISOString(),
				pnl: asFiniteNumber(record["pnl"]),
			} satisfies BabylonOperatorTrade;
		})
		.filter((item): item is BabylonOperatorTrade => item !== null);
}

function extractTransactionArray(value: unknown): BabylonOperatorTransaction[] {
	return asItemsArray(unwrapDataEnvelope(value) ?? value)
		.map((item, index) => {
			const record = asRecord(item);
			const amount = asFiniteNumber(record?.["amount"]);
			if (!record || amount == null) {
				return null;
			}
			return {
				id: asStringValue(record["id"]) ?? `tx-${index}`,
				type: asStringValue(record["type"]) ?? "transaction",
				amount,
				timestamp:
					asStringValue(record["timestamp"]) ??
					asStringValue(record["createdAt"]) ??
					new Date(0).toISOString(),
			} satisfies BabylonOperatorTransaction;
		})
		.filter((item): item is BabylonOperatorTransaction => item !== null);
}

function extractPositionsSummary(value: unknown): BabylonOperatorSnapshot["positions"] {
	const record = unwrapDataEnvelope(value);
	const predictionPositions = asItemsArray(
		asRecord(asRecord(record?.["predictions"])?.["positions"])?.["items"] ??
			asRecord(record?.["predictions"])?.["positions"] ??
			record?.["predictions"],
	);
	const perpetualPositions = asItemsArray(
		asRecord(asRecord(record?.["perpetuals"])?.["positions"])?.["items"] ??
			asRecord(record?.["perpetuals"])?.["positions"] ??
			record?.["perpetuals"],
	);
	return {
		predictions: predictionPositions.length,
		perpetuals: perpetualPositions.length,
		totalValue: asFiniteNumber(record?.["totalValue"]),
		totalUnrealizedPnl: asFiniteNumber(record?.["totalUnrealizedPnL"]),
	};
}

function extractChartPoints(value: unknown): BabylonOperatorChartPoint[] {
	const seen = new Set<unknown>();
	const walk = (input: unknown): BabylonOperatorChartPoint[] => {
		if (!input || seen.has(input)) {
			return [];
		}
		if (typeof input === "object") {
			seen.add(input);
		}
		if (Array.isArray(input)) {
			const direct = input
				.map((item, index) => {
					if (typeof item === "number" && Number.isFinite(item)) {
						return { label: String(index + 1), value: item };
					}
					const record = asRecord(item);
					if (!record) {
						return null;
					}
					const valueCandidate =
						asFiniteNumber(record["yesPrice"]) ??
						asFiniteNumber(record["price"]) ??
						asFiniteNumber(record["value"]) ??
						asFiniteNumber(record["probability"]) ??
						asFiniteNumber(record["markPrice"]) ??
						asFiniteNumber(record["close"]);
					if (valueCandidate == null) {
						return null;
					}
					return {
						label:
							asStringValue(record["timestamp"]) ??
							asStringValue(record["time"]) ??
							asStringValue(record["createdAt"]) ??
							asStringValue(record["bucket"]) ??
							String(index + 1),
						value: valueCandidate,
					} satisfies BabylonOperatorChartPoint;
				})
				.filter((item): item is BabylonOperatorChartPoint => item !== null);
			if (direct.length > 0) {
				return direct;
			}
			for (const item of input) {
				const nested = walk(item);
				if (nested.length > 0) {
					return nested;
				}
			}
			return [];
		}
		const record = asRecord(input);
		if (!record) {
			return [];
		}
		for (const value of Object.values(record)) {
			const nested = walk(value);
			if (nested.length > 0) {
				return nested;
			}
		}
		return [];
	};
	return walk(unwrapDataEnvelope(value) ?? value).slice(-24);
}

async function getBabylonToken(
	fetchImpl: FetchLike,
	context: BabylonRouteContext,
): Promise<string | null> {
	if (!context.apiOrigin || !context.agentId || !context.agentSecret) {
		return null;
	}
	const cacheKey = `${context.apiOrigin}:${context.agentId}`;
	if (
		cachedBabylonToken &&
		cachedBabylonToken.cacheKey === cacheKey &&
		cachedBabylonToken.expiresAt > Date.now() + 30_000
	) {
		return cachedBabylonToken.token;
	}
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (context.agentApiKey) {
		headers["X-Babylon-Api-Key"] = context.agentApiKey;
	}
	if (context.agentAddress) {
		headers["x-agent-address"] = context.agentAddress;
	}
	headers["x-agent-id"] = context.agentId;
	const response = await fetchImpl(new URL("/api/agents/auth", context.apiOrigin), {
		method: "POST",
		headers,
		body: JSON.stringify({
			agentId: context.agentId,
			agentSecret: context.agentSecret,
			secret: context.agentSecret,
		}),
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(text || `Babylon auth failed (${response.status})`);
	}
	const data = (await response.json()) as {
		token?: string;
		sessionToken?: string;
		expiresIn?: number;
	};
	const token = data.token ?? data.sessionToken ?? null;
	if (!token) {
		throw new Error("Babylon auth response did not include a session token.");
	}
	cachedBabylonToken = {
		cacheKey,
		token,
		expiresAt: Date.now() + (data.expiresIn ?? 14 * 60) * 1000,
	};
	return token;
}

async function getBabylonRequestHeaders(
	fetchImpl: FetchLike,
	context: BabylonRouteContext,
): Promise<Record<string, string>> {
	const headers: Record<string, string> = {};
	const token = await getBabylonToken(fetchImpl, context).catch(() => null);
	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
		headers["Cookie"] = `babylon_session=${token}`;
	}
	if (context.agentApiKey) {
		headers["X-Babylon-Api-Key"] = context.agentApiKey;
	}
	if (context.agentId) {
		headers["x-agent-id"] = context.agentId;
	}
	if (context.agentAddress) {
		headers["x-agent-address"] = context.agentAddress;
	}
	return headers;
}

function createEmptyBabylonSnapshot(
	input: Pick<BabylonOperatorSnapshot, "status" | "source" | "detail">,
): BabylonOperatorSnapshot {
	return {
		status: input.status,
		source: input.source,
		detail: input.detail,
		checkedAt: new Date().toISOString(),
		agent: {
			id: null,
			name: null,
			state: null,
			walletAddress: null,
			totalTrades: null,
			winRate: null,
			reputationScore: null,
		},
		balances: {
			wallet: null,
			trading: null,
			deposited: null,
			withdrawn: null,
			lifetimePnl: null,
		},
		positions: {
			predictions: 0,
			perpetuals: 0,
			totalValue: null,
			totalUnrealizedPnl: null,
		},
		markets: [],
		chart: {
			marketId: null,
			label: null,
			points: [],
		},
		recentTrades: [],
		transactions: [],
		creation: {
			supported: false,
			authEnvKey: null,
			detail: "Set CARTRIDGE_BABYLON_AUTH_TOKEN to enable Babylon agent creation from Cartridge.",
		},
	};
}

export async function getBabylonOperatorSnapshot(input?: {
	launchUrl?: string | null;
	fetchImpl?: FetchLike;
}): Promise<BabylonOperatorSnapshot> {
	const fetchImpl = input?.fetchImpl ?? fetch;
	const context = resolveBabylonContext(input?.launchUrl ?? null);
	const creationDetail = context.userAuthToken
		? "Babylon agent creation is enabled through authenticated external registration."
		: "Set CARTRIDGE_BABYLON_AUTH_TOKEN to enable Babylon agent creation from Cartridge.";

	if (!context.routeBase && !context.apiOrigin) {
		const snapshot = createEmptyBabylonSnapshot({
			status: "unavailable",
			source: "none",
			detail: "Babylon API origin is not configured.",
		});
		snapshot.creation = {
			supported: Boolean(context.userAuthToken),
			authEnvKey: "CARTRIDGE_BABYLON_AUTH_TOKEN",
			detail: creationDetail,
		};
		return snapshot;
	}

	const snapshot = createEmptyBabylonSnapshot({
		status: context.agentId ? "ready" : "needs-auth",
		source: context.routeBase ? "route" : "direct",
		detail: context.agentId
			? `Babylon ${context.routeBase ? "route proxy" : "direct API"} connected for ${context.agentId}.`
			: "Configure BABYLON_AGENT_ID to unlock wallet, trades, and direct control.",
	});
	snapshot.creation = {
		supported: Boolean(context.userAuthToken),
		authEnvKey: "CARTRIDGE_BABYLON_AUTH_TOKEN",
		detail: creationDetail,
	};

	const directHeaders = context.apiOrigin
		? await getBabylonRequestHeaders(fetchImpl, context)
		: {};
	const directInit = Object.keys(directHeaders).length > 0 ? { headers: directHeaders } : undefined;
	const baseRoute = context.routeBase;
	const agentId = context.agentId;

	const marketsPromise =
		baseRoute != null
			? fetchOptionalJson(
					fetchImpl,
					`${baseRoute}/markets/predictions?pageSize=5&status=active`,
				)
			: context.apiOrigin
				? fetchOptionalJson(
						fetchImpl,
						new URL("/api/markets/predictions?pageSize=5&status=active", context.apiOrigin),
						directInit,
					)
				: Promise.resolve(null);

	const statusPromise =
		agentId && baseRoute
			? fetchOptionalJson(fetchImpl, `${baseRoute}/agent/status`)
			: agentId && context.apiOrigin
				? fetchOptionalJson(
						fetchImpl,
						new URL(`/api/agents/${encodeURIComponent(agentId)}`, context.apiOrigin),
						directInit,
					)
				: Promise.resolve(null);
	const summaryPromise =
		agentId && baseRoute
			? fetchOptionalJson(fetchImpl, `${baseRoute}/agent/summary`)
			: agentId && context.apiOrigin
				? fetchOptionalJson(
						fetchImpl,
						new URL(`/api/agents/${encodeURIComponent(agentId)}/summary`, context.apiOrigin),
						directInit,
					)
				: Promise.resolve(null);
	const walletPromise =
		agentId && baseRoute
			? fetchOptionalJson(fetchImpl, `${baseRoute}/agent/wallet`)
			: agentId && context.apiOrigin
				? fetchOptionalJson(
						fetchImpl,
						new URL(`/api/agents/${encodeURIComponent(agentId)}/wallet`, context.apiOrigin),
						directInit,
					)
				: Promise.resolve(null);
	const tradingBalancePromise =
		agentId && baseRoute
			? fetchOptionalJson(fetchImpl, `${baseRoute}/agent/trading-balance`)
			: agentId && context.apiOrigin
				? fetchOptionalJson(
						fetchImpl,
						new URL(
							`/api/agents/${encodeURIComponent(agentId)}/trading-balance`,
							context.apiOrigin,
						),
						directInit,
					)
				: Promise.resolve(null);
	const recentTradesPromise =
		agentId && baseRoute
			? fetchOptionalJson(fetchImpl, `${baseRoute}/agent/recent-trades`)
			: agentId && context.apiOrigin
				? fetchOptionalJson(
						fetchImpl,
						new URL(`/api/agents/${encodeURIComponent(agentId)}/recent-trades`, context.apiOrigin),
						directInit,
					)
				: Promise.resolve(null);
	const positionsPromise =
		agentId && context.apiOrigin
			? fetchOptionalJson(
					fetchImpl,
					new URL(`/api/markets/positions/${encodeURIComponent(agentId)}`, context.apiOrigin),
					directInit,
				)
			: Promise.resolve(null);

	const [
		statusValue,
		summaryValue,
		walletValue,
		tradingBalanceValue,
		recentTradesValue,
		marketsValue,
		positionsValue,
	] = await Promise.all([
		statusPromise,
		summaryPromise,
		walletPromise,
		tradingBalancePromise,
		recentTradesPromise,
		marketsPromise,
		positionsPromise,
	]);

	const statusRecord = unwrapDataEnvelope(statusValue);
	const summaryRecord = unwrapDataEnvelope(summaryValue);
	const agentRecord =
		asRecord(summaryRecord?.["agent"]) ?? statusRecord ?? asRecord(summaryValue) ?? null;
	const portfolioRecord = asRecord(summaryRecord?.["portfolio"]);
	const walletRecord = unwrapDataEnvelope(walletValue);
	const tradingBalanceRecord = unwrapDataEnvelope(tradingBalanceValue);
	const markets = extractMarketArray(marketsValue);
	const recentTrades = extractTradeArray(recentTradesValue);
	const transactions = extractTransactionArray(walletRecord?.["transactions"] ?? walletValue);
	const positions = extractPositionsSummary(
		positionsValue ?? summaryRecord?.["positions"] ?? summaryValue,
	);

	snapshot.agent = {
		id: asStringValue(agentRecord?.["id"]) ?? agentId,
		name:
			asStringValue(agentRecord?.["displayName"]) ??
			asStringValue(agentRecord?.["name"]) ??
			agentId,
		state:
			asStringValue(agentRecord?.["agentStatus"]) ??
			asStringValue(agentRecord?.["state"]) ??
			(typeof agentRecord?.["autonomous"] === "boolean"
				? (agentRecord["autonomous"] as boolean)
					? "autonomous"
					: "paused"
				: null),
		walletAddress:
			asStringValue(agentRecord?.["walletAddress"]) ?? context.agentAddress,
		totalTrades: asFiniteNumber(agentRecord?.["totalTrades"]),
		winRate: asFiniteNumber(agentRecord?.["winRate"]),
		reputationScore: asFiniteNumber(agentRecord?.["reputationScore"]),
	};
	snapshot.balances = {
		wallet:
			asFiniteNumber(walletRecord?.["balance"]) ??
			asFiniteNumber(portfolioRecord?.["wallet"]) ??
			asFiniteNumber(agentRecord?.["balance"]),
		trading:
			asFiniteNumber(tradingBalanceRecord?.["balance"]) ??
			asFiniteNumber(portfolioRecord?.["available"]),
		deposited:
			asFiniteNumber(agentRecord?.["totalDeposited"]) ??
			asFiniteNumber(statusRecord?.["totalDeposited"]),
		withdrawn:
			asFiniteNumber(agentRecord?.["totalWithdrawn"]) ??
			asFiniteNumber(statusRecord?.["totalWithdrawn"]),
		lifetimePnl:
			asFiniteNumber(agentRecord?.["lifetimePnL"]) ??
			asFiniteNumber(statusRecord?.["lifetimePnL"]) ??
			asFiniteNumber(portfolioRecord?.["totalPnL"]),
	};
	snapshot.positions = {
		predictions:
			positions.predictions ||
			asFiniteNumber(portfolioRecord?.["positions"]) ||
			0,
		perpetuals: positions.perpetuals,
		totalValue:
			positions.totalValue ?? asFiniteNumber(portfolioRecord?.["totalAssets"]),
		totalUnrealizedPnl:
			positions.totalUnrealizedPnl ?? asFiniteNumber(portfolioRecord?.["totalPnL"]),
	};
	snapshot.markets = markets;
	snapshot.recentTrades = recentTrades.slice(0, 6);
	snapshot.transactions = transactions.slice(0, 8);

	const leadMarket = markets[0] ?? null;
	if (leadMarket) {
		const historyValue =
			baseRoute != null
				? await fetchOptionalJson(
						fetchImpl,
						`${baseRoute}/markets/predictions/${encodeURIComponent(leadMarket.id)}/history`,
					)
				: context.apiOrigin
					? await fetchOptionalJson(
							fetchImpl,
							new URL(
								`/api/markets/predictions/${encodeURIComponent(leadMarket.id)}/history`,
								context.apiOrigin,
							),
							directInit,
						)
					: null;
		snapshot.chart = {
			marketId: leadMarket.id,
			label: leadMarket.title,
			points: extractChartPoints(historyValue),
		};
	}

	if (!snapshot.agent.name && snapshot.markets.length === 0) {
		snapshot.status = "error";
		snapshot.detail = "Babylon responded without usable operator data.";
	} else if (!agentId) {
		snapshot.status = "needs-auth";
	}

	return snapshot;
}

export async function createBabylonAgent(input: {
	request: BabylonAgentCreationInput;
	launchUrl?: string | null;
	fetchImpl?: FetchLike;
}): Promise<BabylonAgentCreationResult> {
	const fetchImpl = input.fetchImpl ?? fetch;
	const context = resolveBabylonContext(input.launchUrl ?? null);
	if (!context.apiOrigin) {
		throw new Error("Babylon API origin is not configured.");
	}
	if (!context.userAuthToken) {
		throw new Error(
			"Babylon agent creation requires CARTRIDGE_BABYLON_AUTH_TOKEN.",
		);
	}
	const externalId = input.request.externalId.trim();
	const name = input.request.name.trim();
	const description = input.request.description.trim();
	if (!externalId || !name || !description) {
		throw new Error("Babylon agent creation requires id, name, and description.");
	}
	const response = await fetchImpl(
		new URL("/api/agents/external/register", context.apiOrigin),
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${context.userAuthToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				externalId,
				name,
				description,
				protocol: "a2a",
				capabilities: {
					strategies: ["trading", "monitoring"],
					markets: ["prediction", "perps"],
					surfaces: ["cartridge"],
				},
			}),
			signal: AbortSignal.timeout(12_000),
		},
	);
	const parsed = await readResponseJsonOrText(response);
	const record = unwrapDataEnvelope(parsed.json);
	if (!response.ok) {
		throw new Error(
			parsed.text ||
				asStringValue(record?.["message"]) ||
				`Babylon registration failed (${response.status}).`,
		);
	}
	const apiKey = asStringValue(record?.["apiKey"]);
	return {
		agentId:
			asStringValue(record?.["agentId"]) ??
			asStringValue(record?.["externalId"]) ??
			externalId,
		apiKey,
		secret: asStringValue(record?.["secret"]),
		walletAddress: asStringValue(record?.["walletAddress"]),
		mode: "external-register",
		detail: apiKey
			? "External Babylon agent created. Save the API key immediately; Babylon only shows it once."
			: "External Babylon agent created.",
	};
}

async function syncScapeTelemetry(
	fetchImpl: FetchLike,
	baseUrl: string,
	agentId: string,
): Promise<AppendTelemetryInput> {
	const sessionId = encodeURIComponent(`scape:${agentId}`);
	const [sessionResponse, journalResponse, goalsResponse] = await Promise.all([
		fetchImpl(`${baseUrl}/session/${sessionId}`, {
			signal: AbortSignal.timeout(10_000),
		}),
		fetchImpl(`${baseUrl}/journal`, {
			signal: AbortSignal.timeout(10_000),
		}),
		fetchImpl(`${baseUrl}/goals`, {
			signal: AbortSignal.timeout(10_000),
		}),
	]);
	const sessionText = await sessionResponse.text();
	const journalText = await journalResponse.text();
	const goalsText = await goalsResponse.text();
	const loopState = sessionText.toLowerCase().includes("paused")
		? "paused by operator"
		: sessionText.toLowerCase().includes("connecting")
			? "connecting"
			: trimText(sessionText);
	return [
		{
			panel: "world-state",
			label: "Session",
			value: trimText(sessionText),
			severity: sessionResponse.ok ? "info" : "warning",
			source: "scape-route",
		},
		{
			panel: "journal-state",
			label: "Journal",
			value: trimText(journalText),
			severity: journalResponse.ok ? "info" : "warning",
			source: "scape-route",
		},
		{
			panel: "loop-state",
			label: "Loop",
			value: loopState,
			severity: sessionResponse.ok ? "info" : "warning",
			source: "scape-route",
		},
		{
			panel: "journal-state",
			label: "Goal",
			value: trimText(goalsText),
			severity: goalsResponse.ok ? "info" : "warning",
			source: "scape-route",
		},
	];
}

async function syncBabylonTelemetry(
	fetchImpl: FetchLike,
	baseLaunchUrl: string | null,
): Promise<AppendTelemetryInput> {
	const snapshot = await getBabylonOperatorSnapshot({
		launchUrl: baseLaunchUrl,
		fetchImpl,
	});
	if (snapshot.status === "unavailable") {
		return [
			{
				panel: "market-state",
				label: "Market",
				value: snapshot.detail,
				severity: "warning",
				source: "babylon-adapter",
			},
		];
	}
	const leadTrade = snapshot.recentTrades[0] ?? null;
	const leadPoint = snapshot.chart.points[snapshot.chart.points.length - 1] ?? null;
	return [
		{
			panel: "market-state",
			label: "Agent",
			value: trimText(
				`${snapshot.agent.name ?? "Babylon Agent"} · ${snapshot.agent.state ?? snapshot.status}`,
			),
			severity: snapshot.status === "error" ? "warning" : "info",
			source: "babylon-route",
		},
		{
			panel: "wallet-state",
			label: "Wallet",
			value: trimText(
				`Wallet $${snapshot.balances.wallet ?? 0} · Trading $${snapshot.balances.trading ?? 0} · PnL ${snapshot.balances.lifetimePnl ?? 0}`,
			),
			severity: "info",
			source: "babylon-route",
		},
		{
			panel: "positions",
			label: "Positions",
			value: trimText(
				`Predictions ${snapshot.positions.predictions} · Perps ${snapshot.positions.perpetuals} · Assets ${snapshot.positions.totalValue ?? "n/a"}`,
			),
			severity: "info",
			source: "babylon-route",
		},
		{
			panel: "market-chart",
			label: "Chart",
			value: trimText(
				snapshot.chart.label && leadPoint
					? `${snapshot.chart.label} · ${leadPoint.value.toFixed(2)}`
					: "Market history is not available yet.",
			),
			severity: "info",
			source: "babylon-route",
		},
		{
			panel: "recent-trades",
			label: "Recent trade",
			value: trimText(leadTrade?.summary ?? "No recent Babylon trades yet."),
			severity: "info",
			source: "babylon-route",
		},
	];
}

async function syncHyperscapeTelemetry(
	fetchImpl: FetchLike,
	baseLaunchUrl: string | null,
): Promise<AppendTelemetryInput> {
	const context = resolveHyperscapeContext(baseLaunchUrl);
	if (!context.baseUrl || !context.agentId) {
		return [
			{
				panel: "auth-state",
				label: "Auth",
				value: "Hyperscape session metadata is unavailable until agent identity is configured.",
				severity: "warning",
				source: "hyperscape-api",
			},
		];
	}
	const agentId = encodeURIComponent(context.agentId);
	const [agents, goal, quickActions, thoughts] = await Promise.all([
		fetchJson(fetchImpl, `${context.baseUrl}/api/embedded-agents`).catch(() => null),
		fetchJson(fetchImpl, `${context.baseUrl}/api/agents/${agentId}/goal`).catch(
			() => null,
		),
		fetchJson(
			fetchImpl,
			`${context.baseUrl}/api/agents/${agentId}/quick-actions`,
		).catch(() => null),
		fetchJson(
			fetchImpl,
			`${context.baseUrl}/api/agents/${agentId}/thoughts?limit=5`,
		).catch(() => null),
	]);
	const agentRecord =
		agents &&
		typeof agents === "object" &&
		Array.isArray((agents as { agents?: unknown[] }).agents)
			? ((agents as { agents?: Array<Record<string, unknown>> }).agents ?? []).find(
					(entry) => entry["agentId"] === context.agentId,
				) ?? null
			: null;
	const goalDescription =
		goal &&
		typeof goal === "object" &&
		goal !== null &&
		typeof (goal as { goal?: { description?: unknown } }).goal?.description ===
			"string"
			? ((goal as { goal?: { description?: string } }).goal?.description ?? null)
			: null;
	const quickCommandCount =
		quickActions &&
		typeof quickActions === "object" &&
		Array.isArray((quickActions as { quickCommands?: unknown[] }).quickCommands)
			? (quickActions as { quickCommands?: unknown[] }).quickCommands?.length ?? 0
			: 0;
	const recentThought =
		thoughts &&
		typeof thoughts === "object" &&
		Array.isArray((thoughts as { thoughts?: Array<{ content?: string }> }).thoughts)
			? (
					thoughts as { thoughts?: Array<{ content?: string }> }
				).thoughts?.[0]?.content ?? null
			: null;

	return [
		{
			panel: "auth-state",
			label: "Agent",
			value: trimText(
				`${context.agentId} · ${String(agentRecord?.["state"] ?? "connecting")}`,
			),
			severity: agentRecord ? "info" : "warning",
			source: "hyperscape-api",
		},
		{
			panel: "follow-target",
			label: "Follow",
			value: trimText(
				context.characterId
					? `following ${context.characterId}`
					: `${quickCommandCount} quick commands available`,
			),
			severity: "info",
			source: "hyperscape-api",
		},
		{
			panel: "recent-activity",
			label: "Activity",
			value: trimText(recentThought ?? goalDescription ?? "No recent activity yet."),
			severity: "info",
			source: "hyperscape-api",
		},
	];
}

export async function refreshSurfaceSessionTelemetry(input: {
	surface: GameAppManifest;
	session: GameSessionRecord;
	fetchImpl?: FetchLike;
}): Promise<AppendTelemetryInput> {
	const fetchImpl = input.fetchImpl ?? fetch;
	switch (input.surface.appId) {
		case "scape": {
			const context = resolveScapeContext(input.session.manifest.launchUrl);
			if (!context.baseUrl || !context.agentId) {
				return [
					{
						panel: "loop-state",
						label: "Route",
						value: "Scape route control is unavailable until route base and agent id are configured.",
						severity: "warning",
						source: "scape-route",
					},
				];
			}
			return syncScapeTelemetry(fetchImpl, context.baseUrl, context.agentId);
		}
		case "babylon":
			return syncBabylonTelemetry(fetchImpl, input.session.manifest.launchUrl);
		case "hyperscape":
			return syncHyperscapeTelemetry(fetchImpl, input.session.manifest.launchUrl);
		default:
			return [];
	}
}

function getDirectiveText(
	control: string,
	payload: OperatorCommandPayload,
): string | null {
	for (const key of ["directive", "message", "content", "objective", "goal", "text"]) {
		const value = payload[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	if (control === "redirect-objective") {
		return "Redirect objective";
	}
	return null;
}

async function dispatchScapeCommand(
	fetchImpl: FetchLike,
	session: GameSessionRecord,
	command: OperatorCommand,
): Promise<SurfaceDispatchResult> {
	const context = resolveScapeContext(session.manifest.launchUrl);
	if (!context.baseUrl || !context.agentId) {
		return {
			status: "failed",
			result:
				"Scape route control requires CARTRIDGE_ROUTE_BASE_URL_SCAPE and SCAPE_AGENT_ID.",
		};
	}
	const sessionId = encodeURIComponent(`scape:${context.agentId}`);
	if (command.control === "pause-loop" || command.control === "resume-loop") {
		const action = command.control === "pause-loop" ? "pause" : "resume";
		const response = await fetchImpl(
			`${context.baseUrl}/session/${sessionId}/control`,
			{
				method: "POST",
				headers: { "Content-Type": "text/plain" },
				body: action,
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			return {
				status: "failed",
				result: text || `Scape control failed (${response.status}).`,
			};
		}
		return {
			status: "executed",
			result: `${action} accepted`,
			frames: await syncScapeTelemetry(fetchImpl, context.baseUrl, context.agentId),
		};
	}
	if (
		command.control === "inject-directive" ||
		command.control === "redirect-objective"
	) {
		const directive = getDirectiveText(command.control, command.payload);
		if (!directive) {
			return {
				status: "failed",
				result: `Scape ${command.control} requires a directive payload.`,
			};
		}
		const response = await fetchImpl(
			`${context.baseUrl}/session/${sessionId}/message`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: directive }),
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			return {
				status: "failed",
				result: text || `Scape directive failed (${response.status}).`,
			};
		}
		return {
			status: "executed",
			result: `Directive accepted: ${directive}`,
			frames: await syncScapeTelemetry(fetchImpl, context.baseUrl, context.agentId),
		};
	}
	return {
		status: "failed",
		result: `Scape control "${command.control}" is not mapped yet.`,
	};
}

async function dispatchBabylonCommand(
	fetchImpl: FetchLike,
	session: GameSessionRecord,
	command: OperatorCommand,
): Promise<SurfaceDispatchResult> {
	const context = resolveBabylonContext(session.manifest.launchUrl);
	if ((!context.routeBase && !context.apiOrigin) || !context.agentId) {
		return {
			status: "failed",
			result: "Babylon control requires an agent id and either a route base or API base.",
		};
	}
	const routeBase = context.routeBase;

	if (routeBase && (command.control === "pause-agent" || command.control === "resume-agent")) {
		const action = command.control === "pause-agent" ? "pause" : "resume";
		const response = await fetchImpl(
			`${routeBase}/session/${encodeURIComponent(context.agentId)}/control`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action }),
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			return {
				status: "failed",
				result: text || `Babylon control failed (${response.status}).`,
			};
		}
		return {
			status: "executed",
			result: `${action} accepted`,
			frames: await syncBabylonTelemetry(fetchImpl, session.manifest.launchUrl),
		};
	}

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(await getBabylonRequestHeaders(fetchImpl, context)),
	};
	if (!context.apiOrigin) {
		return {
			status: "failed",
			result: "Babylon direct API origin is unavailable.",
		};
	}

	if (command.control === "pause-agent" || command.control === "resume-agent") {
		const action = command.control === "pause-agent" ? "pause" : "resume";
		const response = await fetchImpl(
			new URL(
				`/api/admin/agents/${encodeURIComponent(context.agentId)}/toggle`,
				context.apiOrigin,
			),
			{
				method: "POST",
				headers,
				body: JSON.stringify({ action }),
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			return {
				status: "failed",
				result: text || `Babylon toggle failed (${response.status}).`,
			};
		}
		return {
			status: "executed",
			result: `${action} accepted`,
			frames: await syncBabylonTelemetry(fetchImpl, session.manifest.launchUrl),
		};
	}

	if (command.control === "place-prediction") {
		const marketId = command.payload["marketId"];
		const side =
			typeof command.payload["side"] === "string" &&
			command.payload["side"] === "sell"
				? "sell"
				: "buy";
		if (typeof marketId !== "string" || !marketId.trim()) {
			return {
				status: "failed",
				result: "place-prediction requires payload.marketId.",
			};
		}
		const response = await fetchImpl(
			new URL(
				`/api/markets/predictions/${encodeURIComponent(marketId)}/${side}`,
				context.apiOrigin,
			),
			{
				method: "POST",
				headers,
				body: JSON.stringify(command.payload),
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			return {
				status: "failed",
				result: text || `Babylon prediction failed (${response.status}).`,
			};
		}
		return {
			status: "executed",
			result: `${side} submitted for ${marketId}`,
			frames: await syncBabylonTelemetry(fetchImpl, session.manifest.launchUrl),
		};
	}

	return {
		status: "failed",
		result: `Babylon control "${command.control}" is not mapped yet.`,
	};
}

export async function dispatchSurfaceControlCommand(input: {
	surface: GameAppManifest;
	session: GameSessionRecord;
	command: OperatorCommand;
	fetchImpl?: FetchLike;
}): Promise<SurfaceDispatchResult> {
	const fetchImpl = input.fetchImpl ?? fetch;
	switch (input.surface.appId) {
		case "scape":
			return dispatchScapeCommand(fetchImpl, input.session, input.command);
		case "babylon":
			return dispatchBabylonCommand(fetchImpl, input.session, input.command);
		case "hyperscape":
			return {
				status: "failed",
				result:
					"Hyperscape is connected for session monitoring, but Cartridge control is watch-only until upstream control routes are available.",
			};
		default:
			return {
				status: "failed",
				result: `No hosted control adapter is registered for ${input.surface.displayName}.`,
			};
	}
}
