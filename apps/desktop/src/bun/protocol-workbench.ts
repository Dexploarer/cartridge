import type {
	ProtocolA2ARequestInput,
	ProtocolA2ARequestResult,
	ProtocolWorkbenchA2AInterface,
	ProtocolWorkbenchA2ASkill,
	ProtocolWorkbenchA2ASnapshot,
	ProtocolWorkbenchIdentitySnapshot,
	ProtocolWorkbenchSnapshot,
	ProtocolWorkbenchX402Offer,
	ProtocolWorkbenchX402Snapshot,
	ProtocolX402ProbeInput,
} from "../shared/runtime-shell-state";

type FetchLike = typeof fetch;

const BABYLON_AGENT_CARD_URL = "https://babylon.market/.well-known/agent-card.json";
const A2A_DOCS_URL = "https://a2a-protocol.org/latest/";
const X402_DOCS_URL = "https://docs.x402.org/";
const ERC8004_DOCS_URL = "https://eips.ethereum.org/EIPS/eip-8004";

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

function asStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value
				.map((item) => asStringValue(item))
				.filter((item): item is string => item !== null)
		: [];
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
		return url.toString();
	} catch {
		return null;
	}
}

function prettyJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

function trimPreview(value: string, max = 1200): string {
	const normalized = value.trim();
	if (!normalized) {
		return "";
	}
	return normalized.length > max
		? `${normalized.slice(0, max - 1)}…`
		: normalized;
}

function createEmptyA2ASnapshot(
	overrides: Partial<ProtocolWorkbenchA2ASnapshot> = {},
): ProtocolWorkbenchA2ASnapshot {
	return {
		status: "unavailable",
		detail: "A2A agent-card discovery is not configured yet.",
		checkedAt: new Date().toISOString(),
		cardUrl: BABYLON_AGENT_CARD_URL,
		endpointUrl: null,
		provider: null,
		protocolVersion: null,
		preferredTransport: null,
		interfaces: [],
		securitySchemes: [],
		skills: [],
		...overrides,
	};
}

function createEmptyX402Snapshot(
	overrides: Partial<ProtocolWorkbenchX402Snapshot> = {},
): ProtocolWorkbenchX402Snapshot {
	return {
		status: "idle",
		detail:
			"Provide an x402 endpoint URL to probe HTTP 402 payment requirements from Cartridge.",
		checkedAt: null,
		url: null,
		method: "GET",
		httpStatus: null,
		offers: [],
		paymentRequiredJson: null,
		paymentResponseJson: null,
		bodyPreview: null,
		...overrides,
	};
}

function parseSecuritySchemes(
	value: unknown,
): ProtocolWorkbenchA2ASnapshot["securitySchemes"] {
	const record = asRecord(value);
	if (!record) {
		return [];
	}
	return Object.entries(record).map(([name, entry]) => {
		const schemeRecord = asRecord(entry);
		if (!schemeRecord) {
			return name;
		}
		if (typeof schemeRecord["type"] === "string") {
			const location = asStringValue(schemeRecord["in"]);
			const headerName = asStringValue(schemeRecord["name"]);
			return [name, schemeRecord["type"], location, headerName]
				.filter(Boolean)
				.join(" · ");
		}
		for (const [nestedKey, nestedValue] of Object.entries(schemeRecord)) {
			const nestedRecord = asRecord(nestedValue);
			if (!nestedRecord) {
				continue;
			}
			const location = asStringValue(nestedRecord["location"]);
			const headerName = asStringValue(nestedRecord["name"]);
			const authScheme = asStringValue(nestedRecord["scheme"]);
			return [name, nestedKey, location, headerName, authScheme]
				.filter(Boolean)
				.join(" · ");
		}
		return name;
	});
}

function normalizeA2AInterfaces(card: Record<string, unknown>): ProtocolWorkbenchA2AInterface[] {
	const supported = Array.isArray(card["supportedInterfaces"])
		? (card["supportedInterfaces"] as unknown[])
		: Array.isArray(card["additionalInterfaces"])
			? (card["additionalInterfaces"] as unknown[])
			: [];
	const interfaces = supported
		.map((entry) => {
			const record = asRecord(entry);
			const url = asStringValue(record?.["url"]);
			if (!url) {
				return null;
			}
			return {
				url,
				transport:
					asStringValue(record?.["protocolBinding"]) ??
					asStringValue(record?.["transport"]) ??
					"unknown",
				protocolVersion:
					asStringValue(record?.["protocolVersion"]) ??
					asStringValue(record?.["version"]),
			} satisfies ProtocolWorkbenchA2AInterface;
		})
		.filter((entry): entry is ProtocolWorkbenchA2AInterface => entry !== null);

	const endpointUrl = asStringValue(card["url"]);
	if (endpointUrl && interfaces.every((entry) => entry.url !== endpointUrl)) {
		interfaces.unshift({
			url: endpointUrl,
			transport: asStringValue(card["preferredTransport"]) ?? "unknown",
			protocolVersion: asStringValue(card["protocolVersion"]),
		});
	}
	return interfaces;
}

function normalizeA2ASkills(card: Record<string, unknown>): ProtocolWorkbenchA2ASkill[] {
	return (Array.isArray(card["skills"]) ? (card["skills"] as unknown[]) : [])
		.map((entry, index) => {
			const record = asRecord(entry);
			if (!record) {
				return null;
			}
			const name = asStringValue(record["name"]);
			if (!name) {
				return null;
			}
			return {
				id: asStringValue(record["id"]) ?? `skill-${index + 1}`,
				name,
				description: asStringValue(record["description"]) ?? "",
				tags: asStringArray(record["tags"]),
			} satisfies ProtocolWorkbenchA2ASkill;
		})
		.filter((entry): entry is ProtocolWorkbenchA2ASkill => entry !== null);
}

function extractBabylonIdentity(): ProtocolWorkbenchIdentitySnapshot {
	const agentId = readEnv("BABYLON_AGENT_ID");
	const walletAddress = readEnv("BABYLON_AGENT_ADDRESS", "BABYLON_WALLET_ADDRESS");
	const tokenIdFromEnv = readEnv("BABYLON_AGENT_TOKEN_ID", "TOKEN_ID");
	const apiKey = readEnv("BABYLON_A2A_API_KEY", "BABYLON_API_KEY");
	const onChainMatch = agentId?.match(/^(\d+):(\d+)$/) ?? null;
	const chainId = onChainMatch?.[1] ?? null;
	const tokenId = tokenIdFromEnv ?? onChainMatch?.[2] ?? null;
	const registrationMode = chainId && tokenId ? "onchain" : agentId ? "external" : "unknown";
	const authMode: ProtocolWorkbenchIdentitySnapshot["authMode"] =
		walletAddress && apiKey
			? "hybrid"
			: walletAddress
				? "wallet"
				: apiKey
					? "api-key"
					: "none";
	const headers = [
		agentId ? `x-agent-id: ${agentId}` : null,
		walletAddress ? `x-agent-address: ${walletAddress}` : null,
		tokenId ? `x-agent-token-id: ${tokenId}` : null,
		apiKey ? `x-babylon-api-key: ${apiKey}` : null,
	].filter((entry): entry is string => entry !== null);

	if (registrationMode === "onchain") {
		return {
			status: "onchain",
			detail:
				"ERC-8004 identity appears configured through Babylon's chainId:tokenId header contract.",
			agentId,
			walletAddress,
			chainId,
			tokenId,
			registrationMode,
			authMode,
			headers,
		};
	}
	if (registrationMode === "external") {
		return {
			status: "external",
			detail:
				"External Babylon agent identity is configured. Add a chainId:tokenId agent id to switch this profile to ERC-8004 mode.",
			agentId,
			walletAddress,
			chainId: null,
			tokenId,
			registrationMode,
			authMode,
			headers,
		};
	}
	return {
		status: "needs-config",
		detail:
			"Set BABYLON_AGENT_ID, BABYLON_AGENT_ADDRESS, and optional BABYLON_A2A_API_KEY or BABYLON_AGENT_TOKEN_ID to connect Cartridge to Babylon A2A and ERC-8004 identity flows.",
		agentId: null,
		walletAddress,
		chainId: null,
		tokenId: tokenIdFromEnv,
		registrationMode,
		authMode,
		headers,
	};
}

function collectOffers(value: unknown): ProtocolWorkbenchX402Offer[] {
	const record = asRecord(value);
	const accepts = Array.isArray(record?.["accepts"])
		? (record["accepts"] as unknown[])
		: Array.isArray(value)
			? (value as unknown[])
			: record
				? [record]
				: [];
	return accepts
		.map((entry) => {
			const offer = asRecord(entry);
			if (!offer) {
				return null;
			}
			return {
				scheme: asStringValue(offer["scheme"]),
				network: asStringValue(offer["network"]),
				price:
					asStringValue(offer["price"]) ??
					(typeof offer["price"] === "number" ? String(offer["price"]) : null),
				payTo: asStringValue(offer["payTo"]) ?? asStringValue(offer["recipient"]),
				description:
					asStringValue(offer["description"]) ??
					asStringValue(record?.["description"]),
			} satisfies ProtocolWorkbenchX402Offer;
		})
		.filter((entry): entry is ProtocolWorkbenchX402Offer => entry !== null);
}

function decodeBase64JsonHeader(value: string | null): { json: unknown | null; raw: string | null } {
	if (!value) {
		return { json: null, raw: null };
	}
	try {
		const decoded = Buffer.from(value, "base64").toString("utf8");
		return {
			json: JSON.parse(decoded),
			raw: decoded,
		};
	} catch {
		return {
			json: null,
			raw: null,
		};
	}
}

function isBabylonEndpoint(url: string | null): boolean {
	if (!url) {
		return false;
	}
	try {
		return new URL(url).hostname.endsWith("babylon.market");
	} catch {
		return false;
	}
}

function appendBabylonA2AHeaders(headers: Headers): void {
	const identity = extractBabylonIdentity();
	if (identity.agentId) {
		headers.set("x-agent-id", identity.agentId);
	}
	if (identity.walletAddress) {
		headers.set("x-agent-address", identity.walletAddress);
	}
	if (identity.tokenId) {
		headers.set("x-agent-token-id", identity.tokenId);
	}
	const apiKey = readEnv("BABYLON_A2A_API_KEY", "BABYLON_API_KEY");
	if (apiKey) {
		headers.set("x-babylon-api-key", apiKey);
	}
}

async function fetchJson(
	fetchImpl: FetchLike,
	url: string,
	init?: RequestInit,
): Promise<unknown> {
	const response = await fetchImpl(url, {
		...init,
		signal: AbortSignal.timeout(12_000),
	});
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(text || `${response.status} ${response.statusText}`);
	}
	return response.json();
}

async function resolveA2ACard(
	fetchImpl: FetchLike,
	cardUrl: string,
): Promise<ProtocolWorkbenchA2ASnapshot> {
	const normalizedCardUrl = normalizeHttpUrl(cardUrl);
	if (!normalizedCardUrl) {
		return createEmptyA2ASnapshot({
			status: "error",
			cardUrl,
			detail: "A2A card URLs must use http or https.",
		});
	}
	const raw = await fetchJson(fetchImpl, normalizedCardUrl);
	const card = asRecord(raw);
	if (!card) {
		return createEmptyA2ASnapshot({
			status: "error",
			cardUrl: normalizedCardUrl,
			detail: "A2A agent card did not return a JSON object.",
		});
	}
	const interfaces = normalizeA2AInterfaces(card);
	const endpointUrl =
		asStringValue(card["url"]) ??
		interfaces[0]?.url ??
		null;
	const skills = normalizeA2ASkills(card);
	const securitySchemes = parseSecuritySchemes(card["securitySchemes"]);
	const requiresAuth = securitySchemes.length > 0;
	const paymentSkill = skills.find(
		(skill) =>
			skill.tags.some((tag) => tag.toLowerCase() === "x402") ||
			skill.name.toLowerCase().includes("x402") ||
			skill.description.toLowerCase().includes("x402"),
	);
	return createEmptyA2ASnapshot({
		status: requiresAuth ? "needs-auth" : "ready",
		detail: paymentSkill
			? `A2A card loaded. ${skills.length} skills advertised, including x402 payments.`
			: `A2A card loaded with ${skills.length} advertised skills.`,
		cardUrl: normalizedCardUrl,
		endpointUrl,
		provider:
			asStringValue(asRecord(card["provider"])?.["organization"]) ??
			asStringValue(asRecord(card["provider"])?.["name"]) ??
			asStringValue(asRecord(card["provider"])?.["url"]),
		protocolVersion:
			asStringValue(card["protocolVersion"]) ??
			interfaces[0]?.protocolVersion ??
			null,
		preferredTransport:
			asStringValue(card["preferredTransport"]) ??
			interfaces[0]?.transport ??
			null,
		interfaces,
		securitySchemes,
		skills,
	});
}

export async function getProtocolWorkbenchSnapshot(input?: {
	fetchImpl?: FetchLike;
}): Promise<ProtocolWorkbenchSnapshot> {
	const fetchImpl = input?.fetchImpl ?? fetch;
	const cardUrl = readEnv("CARTRIDGE_A2A_CARD_URL") ?? BABYLON_AGENT_CARD_URL;
	const x402Url = readEnv("CARTRIDGE_X402_PROBE_URL");
	let a2a = createEmptyA2ASnapshot({ cardUrl });
	try {
		a2a = await resolveA2ACard(fetchImpl, cardUrl);
	} catch (error) {
		a2a = createEmptyA2ASnapshot({
			status: "error",
			cardUrl,
			detail:
				error instanceof Error
					? error.message
					: "Failed to load the A2A agent card.",
		});
	}

	let x402 = createEmptyX402Snapshot({
		url: normalizeHttpUrl(x402Url),
	});
	if (x402.url) {
		try {
			x402 = await probeX402Endpoint(
				{
					url: x402.url,
					method: "GET",
				},
				fetchImpl,
			);
		} catch (error) {
			x402 = createEmptyX402Snapshot({
				status: "error",
				url: normalizeHttpUrl(x402Url),
				checkedAt: new Date().toISOString(),
				detail:
					error instanceof Error
						? error.message
						: "Failed to probe the x402 endpoint.",
			});
		}
	}

	return {
		a2a,
		identity: extractBabylonIdentity(),
		x402,
		docs: {
			a2a: A2A_DOCS_URL,
			x402: X402_DOCS_URL,
			erc8004: ERC8004_DOCS_URL,
		},
	};
}

export async function callA2AEndpoint(input: {
	request: ProtocolA2ARequestInput;
	fetchImpl?: FetchLike;
}): Promise<ProtocolA2ARequestResult> {
	const fetchImpl = input.fetchImpl ?? fetch;
	const cardUrl =
		normalizeHttpUrl(input.request.cardUrl) ??
		readEnv("CARTRIDGE_A2A_CARD_URL") ??
		BABYLON_AGENT_CARD_URL;
	let endpointUrl = normalizeHttpUrl(input.request.endpointUrl);
	if (!endpointUrl) {
		const a2aCard = await resolveA2ACard(fetchImpl, cardUrl);
		endpointUrl = normalizeHttpUrl(a2aCard.endpointUrl);
	}
	if (!endpointUrl) {
		return {
			status: "error",
			detail: "No A2A endpoint could be resolved from the card or request.",
			endpointUrl: null,
			httpStatus: null,
			responseJson: "",
		};
	}
	const method = input.request.method.trim();
	if (!method) {
		return {
			status: "error",
			detail: "A2A requests require a JSON-RPC method name.",
			endpointUrl,
			httpStatus: null,
			responseJson: "",
		};
	}
	let params: unknown = {};
	if ((input.request.paramsJson ?? "").trim()) {
		try {
			params = JSON.parse(input.request.paramsJson!);
		} catch (error) {
			return {
				status: "error",
				detail:
					error instanceof Error
						? `Invalid params JSON: ${error.message}`
						: "Invalid params JSON.",
				endpointUrl,
				httpStatus: null,
				responseJson: "",
			};
		}
	}
	const headers = new Headers({
		Accept: "application/json",
		"Content-Type": "application/json",
	});
	if (isBabylonEndpoint(endpointUrl) || isBabylonEndpoint(cardUrl)) {
		appendBabylonA2AHeaders(headers);
	}
	const response = await fetchImpl(endpointUrl, {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: `cartridge-${Date.now()}`,
			method,
			params,
		}),
		signal: AbortSignal.timeout(12_000),
	});
	const text = await response.text();
	let parsed: unknown = null;
	if (text.trim()) {
		try {
			parsed = JSON.parse(text);
		} catch {
			parsed = null;
		}
	}
	const errorRecord = asRecord(asRecord(parsed)?.["error"]);
	if (!response.ok || errorRecord) {
		return {
			status: "error",
			detail:
				asStringValue(errorRecord?.["message"]) ??
				`${response.status} ${response.statusText}`,
			endpointUrl,
			httpStatus: response.status,
			responseJson: parsed ? prettyJson(parsed) : trimPreview(text),
		};
	}
	return {
		status: "ok",
		detail: "A2A request completed.",
		endpointUrl,
		httpStatus: response.status,
		responseJson: parsed ? prettyJson(parsed) : trimPreview(text),
	};
}

export async function probeX402Endpoint(
	input: ProtocolX402ProbeInput,
	fetchImpl: FetchLike = fetch,
): Promise<ProtocolWorkbenchX402Snapshot> {
	const url = normalizeHttpUrl(input.url);
	if (!url) {
		return createEmptyX402Snapshot({
			status: "error",
			url: input.url,
			checkedAt: new Date().toISOString(),
			detail: "x402 probes require an http or https URL.",
			method: input.method,
		});
	}
	let requestHeaders: Record<string, string> = {};
	if ((input.headersJson ?? "").trim()) {
		try {
			const parsed = JSON.parse(input.headersJson!);
			const record = asRecord(parsed);
			if (!record) {
				throw new Error("headers must be a JSON object");
			}
			requestHeaders = Object.fromEntries(
				Object.entries(record)
					.map(([key, value]) => [key, asStringValue(value)])
					.filter((entry): entry is [string, string] => entry[1] !== null),
			);
		} catch (error) {
			return createEmptyX402Snapshot({
				status: "error",
				url,
				checkedAt: new Date().toISOString(),
				detail:
					error instanceof Error
						? `Invalid header JSON: ${error.message}`
						: "Invalid header JSON.",
				method: input.method,
			});
		}
	}
	let body: string | undefined;
	if ((input.bodyJson ?? "").trim()) {
		try {
			body = prettyJson(JSON.parse(input.bodyJson!));
			requestHeaders["Content-Type"] = "application/json";
		} catch (error) {
			return createEmptyX402Snapshot({
				status: "error",
				url,
				checkedAt: new Date().toISOString(),
				detail:
					error instanceof Error
						? `Invalid body JSON: ${error.message}`
						: "Invalid body JSON.",
				method: input.method,
			});
		}
	}
	const response = await fetchImpl(url, {
		method: input.method,
		headers: requestHeaders,
		body,
		signal: AbortSignal.timeout(12_000),
	});
	const responseText = await response.text().catch(() => "");
	const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
	const paymentResponseHeader = response.headers.get("PAYMENT-RESPONSE");
	const decodedRequired = decodeBase64JsonHeader(paymentRequiredHeader);
	const decodedResponse = decodeBase64JsonHeader(paymentResponseHeader);
	const offers = collectOffers(decodedRequired.json);
	const checkedAt = new Date().toISOString();

	if (response.status === 402 || paymentRequiredHeader) {
		return createEmptyX402Snapshot({
			status: "payment-required",
			detail:
				offers.length > 0
					? `x402 challenge received with ${offers.length} advertised payment option${offers.length === 1 ? "" : "s"}.`
					: "x402 challenge received.",
			checkedAt,
			url,
			method: input.method,
			httpStatus: response.status,
			offers,
			paymentRequiredJson: decodedRequired.json ? prettyJson(decodedRequired.json) : null,
			paymentResponseJson: decodedResponse.json ? prettyJson(decodedResponse.json) : null,
			bodyPreview: trimPreview(responseText) || null,
		});
	}

	if (response.ok) {
		return createEmptyX402Snapshot({
			status: "ready",
			detail:
				"Endpoint responded without a payment challenge. It may be public or require a different route for x402.",
			checkedAt,
			url,
			method: input.method,
			httpStatus: response.status,
			offers,
			paymentRequiredJson: decodedRequired.json ? prettyJson(decodedRequired.json) : null,
			paymentResponseJson: decodedResponse.json ? prettyJson(decodedResponse.json) : null,
			bodyPreview: trimPreview(responseText) || null,
		});
	}

	return createEmptyX402Snapshot({
		status: "error",
		detail: `${response.status} ${response.statusText}`,
		checkedAt,
		url,
		method: input.method,
		httpStatus: response.status,
		offers,
		paymentRequiredJson: decodedRequired.json ? prettyJson(decodedRequired.json) : null,
		paymentResponseJson: decodedResponse.json ? prettyJson(decodedResponse.json) : null,
		bodyPreview: trimPreview(responseText) || null,
	});
}
