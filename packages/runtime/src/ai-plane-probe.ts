import type { BrandingProfile } from "@cartridge/shared";

import { readEnvVar } from "./env";
import { isJsonObject, readJsonResponse, type JsonValue } from "./json";

type ModelProbeResult = {
	modelIds: string[];
	error: string | null;
};

type ElizaModelProbeResult = ModelProbeResult & {
	status: number;
};

function collectModelIds(items: ReadonlyArray<JsonValue> | undefined): string[] {
	if (!Array.isArray(items)) {
		return [];
	}
	const modelIds: string[] = [];
	for (const item of items) {
		if (isJsonObject(item) && typeof item["id"] === "string") {
			modelIds.push(item["id"]);
		}
	}
	return modelIds;
}

function collectModelNames(items: ReadonlyArray<JsonValue> | undefined): string[] {
	if (!Array.isArray(items)) {
		return [];
	}
	const modelIds: string[] = [];
	for (const item of items) {
		if (isJsonObject(item) && typeof item["name"] === "string") {
			modelIds.push(item["name"]);
		}
	}
	return modelIds;
}

/** Probe ElizaOS Cloud OpenAI-compatible model list (Bearer API key). */
export async function probeElizaCloudModels(
	apiBaseUrl: string,
	token: string | undefined,
): Promise<ElizaModelProbeResult> {
	const base = apiBaseUrl.replace(/\/$/, "");
	const url = `${base}/models`;
	try {
		const headers = new Headers({ Accept: "application/json" });
		if (token) {
			headers.set("Authorization", `Bearer ${token}`);
		}
		const res = await fetch(url, { headers, method: "GET" });
		if (res.status === 401 || res.status === 403) {
			return { modelIds: [], error: `HTTP ${res.status} — add API key or sign in`, status: res.status };
		}
		if (!res.ok) {
			return { modelIds: [], error: `HTTP ${res.status}`, status: res.status };
		}
		const json = await readJsonResponse(res);
		const data = isJsonObject(json) ? json["data"] : undefined;
		if (!Array.isArray(data)) {
			return { modelIds: [], error: "Unexpected /models response", status: res.status };
		}
		const modelIds = collectModelIds(data);
		return { modelIds, error: null, status: res.status };
	} catch (e) {
		return {
			modelIds: [],
			error: e instanceof Error ? e.message : String(e),
			status: 0,
		};
	}
}

/** Ollama tags — local models. */
export async function probeOllama(baseUrl: string): Promise<ModelProbeResult> {
	const u = baseUrl.replace(/\/$/, "");
	const url = `${u}/api/tags`;
	try {
		const res = await fetch(url, { method: "GET" });
		if (!res.ok) {
			return { modelIds: [], error: `HTTP ${res.status}` };
		}
		const json = await readJsonResponse(res);
		const models = isJsonObject(json) ? json["models"] : undefined;
		if (!Array.isArray(models)) {
			return { modelIds: [], error: "Unexpected Ollama response" };
		}
		const modelIds = collectModelNames(models);
		return { modelIds, error: null };
	} catch (e) {
		return { modelIds: [], error: e instanceof Error ? e.message : String(e) };
	}
}

/** OpenAI-compatible /v1/models (OpenAI, LM Studio, custom base). */
export async function probeOpenAiCompatibleModels(
	baseUrl: string,
	apiKey: string | undefined,
): Promise<ModelProbeResult> {
	const u = baseUrl.replace(/\/$/, "");
	const path = u.endsWith("/v1") ? `${u}/models` : `${u}/v1/models`;
	try {
		const headers = new Headers({ Accept: "application/json" });
		if (apiKey) {
			headers.set("Authorization", `Bearer ${apiKey}`);
		}
		const res = await fetch(path, { headers, method: "GET" });
		if (res.status === 401 || res.status === 403) {
			return { modelIds: [], error: `HTTP ${res.status}` };
		}
		if (!res.ok) {
			return { modelIds: [], error: `HTTP ${res.status}` };
		}
		const json = await readJsonResponse(res);
		const data = isJsonObject(json) ? json["data"] : undefined;
		if (!Array.isArray(data)) {
			return { modelIds: [], error: "Unexpected OpenAI-compatible /models" };
		}
		const modelIds = collectModelIds(data);
		return { modelIds, error: null };
	} catch (e) {
		return { modelIds: [], error: e instanceof Error ? e.message : String(e) };
	}
}

export type AiProbeBundle = {
	eliza: ElizaModelProbeResult;
	openai: ModelProbeResult;
	anthropicListed: boolean;
	ollama: ModelProbeResult;
	lmStudio: ModelProbeResult;
	custom: ModelProbeResult;
};

/** Run all probes in parallel; keys never logged. */
export async function runAllAiProbes(branding: BrandingProfile, elizaToken: string | undefined): Promise<AiProbeBundle> {
	const openaiKey = readEnvVar("OPENAI_API_KEY") ?? readEnvVar("CARTRIDGE_OPENAI_API_KEY");
	const openaiBase = readEnvVar("CARTRIDGE_OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
	const anthropicKey = readEnvVar("ANTHROPIC_API_KEY") ?? readEnvVar("CARTRIDGE_ANTHROPIC_API_KEY");
	const ollamaBase = readEnvVar("CARTRIDGE_OLLAMA_BASE_URL") ?? "http://127.0.0.1:11434";
	const lmStudioBase = readEnvVar("CARTRIDGE_LM_STUDIO_URL") ?? "http://127.0.0.1:1234/v1";
	const customBase = readEnvVar("CARTRIDGE_CUSTOM_OPENAI_BASE_URL");
	const customKey = readEnvVar("CARTRIDGE_CUSTOM_OPENAI_API_KEY");

	const emptyProbeResult = (): ModelProbeResult => ({ modelIds: [], error: null });

	const [eliza, openai, ollama, lmStudio, custom] = await Promise.all([
		probeElizaCloudModels(branding.elizaCloudApiBaseUrl, elizaToken),
		openaiKey ? probeOpenAiCompatibleModels(openaiBase, openaiKey) : Promise.resolve(emptyProbeResult()),
		probeOllama(ollamaBase),
		probeOpenAiCompatibleModels(lmStudioBase, undefined),
		customBase ? probeOpenAiCompatibleModels(customBase, customKey) : Promise.resolve(emptyProbeResult()),
	]);

	return {
		eliza,
		openai: { modelIds: openai.modelIds, error: openai.error },
		anthropicListed: Boolean(anthropicKey),
		ollama: { modelIds: ollama.modelIds, error: ollama.error },
		lmStudio: { modelIds: lmStudio.modelIds, error: lmStudio.error },
		custom: { modelIds: custom.modelIds, error: custom.error },
	};
}
