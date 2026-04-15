import type { BrandingProfile } from "@cartridge/shared";

import type {
	AiPlaneState,
	AiLinkStatus,
	ElizaCloudSlice,
	ExternalApiSlice,
	LocalModelSlice,
} from "@cartridge/shared";
import type { AiProbeBundle } from "./ai-plane-probe";
import { readEnvVar } from "./env";

export function getEffectiveElizaToken(runtimeOverride: string | null): string | undefined {
	if (runtimeOverride) {
		return runtimeOverride;
	}
	return (
		readEnvVar("CARTRIDGE_ELIZA_CLOUD_TOKEN") ??
		readEnvVar("ELIZA_CLOUD_API_KEY") ??
		readEnvVar("ELIZA_CLOUD_TOKEN")
	);
}

function linkStatusFromProbe(
	hasConfig: boolean,
	modelIds: string[],
	error: string | null,
	needsAuth: boolean,
): AiLinkStatus {
	if (!hasConfig && needsAuth) {
		return "auth_required";
	}
	if (error) {
		return error.includes("fetch") || error.includes("ECONNREFUSED") ? "offline" : "error";
	}
	if (modelIds.length > 0) {
		return "ok";
	}
	if (hasConfig) {
		return "ok";
	}
	return "unconfigured";
}

export function buildAiPlaneState(
	branding: BrandingProfile,
	opts: {
		elizaTokenOverride: string | null;
		activeProviderId: string | null;
		activeModelId: string | null;
		lastProbe: AiProbeBundle | null;
		lastProbeAt: string | null;
		aggregateProbeError: string | null;
	},
): AiPlaneState {
	const token = getEffectiveElizaToken(opts.elizaTokenOverride);
	const authSource: ElizaCloudSlice["authSource"] = opts.elizaTokenOverride
		? "session"
		: token
			? "env"
			: "none";

	const probe = opts.lastProbe;
	const elizaModels = probe?.eliza.modelIds ?? [];
	const elizaErr = probe?.eliza.error ?? null;
	const elizaLink: AiLinkStatus = !token
		? "auth_required"
		: elizaErr
			? elizaErr.includes("401") || elizaErr.includes("403")
				? "auth_required"
				: "error"
			: "ok";

	const openaiKey = readEnvVar("OPENAI_API_KEY") ?? readEnvVar("CARTRIDGE_OPENAI_API_KEY");
	const openaiBase = readEnvVar("CARTRIDGE_OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
	const anthropicKey = readEnvVar("ANTHROPIC_API_KEY") ?? readEnvVar("CARTRIDGE_ANTHROPIC_API_KEY");
	const customBase = readEnvVar("CARTRIDGE_CUSTOM_OPENAI_BASE_URL");

	const openaiModels = probe?.openai.modelIds ?? [];
	const ollamaModels = probe?.ollama.modelIds ?? [];
	const lmModels = probe?.lmStudio.modelIds ?? [];
	const customModels = probe?.custom.modelIds ?? [];

	const external: ExternalApiSlice[] = [
		{
			kind: "external",
			id: "openai",
			label: "OpenAI",
			configured: Boolean(openaiKey),
			baseUrl: openaiBase,
			status: linkStatusFromProbe(Boolean(openaiKey), openaiModels, probe?.openai.error ?? null, false),
			modelIds: openaiModels,
			lastError: probe?.openai.error ?? null,
		},
		{
			kind: "external",
			id: "anthropic",
			label: "Anthropic",
			configured: Boolean(anthropicKey),
			baseUrl: "https://api.anthropic.com",
			status: anthropicKey ? "configured" : "unconfigured",
			modelIds: [],
			lastError: null,
		},
	];

	if (customBase) {
		external.push({
			kind: "external",
			id: "custom-openai",
			label: "Custom OpenAI-compatible",
			configured: true,
			baseUrl: customBase,
			status: linkStatusFromProbe(true, customModels, probe?.custom.error ?? null, false),
			modelIds: customModels,
			lastError: probe?.custom.error ?? null,
		});
	}

	const ollamaBase = readEnvVar("CARTRIDGE_OLLAMA_BASE_URL") ?? "http://127.0.0.1:11434";
	const lmBase = readEnvVar("CARTRIDGE_LM_STUDIO_URL") ?? "http://127.0.0.1:1234/v1";

	const local: LocalModelSlice[] = [
		{
			kind: "local",
			id: "ollama",
			label: "Ollama",
			baseUrl: ollamaBase,
			status: linkStatusFromProbe(true, ollamaModels, probe?.ollama.error ?? null, false),
			modelIds: ollamaModels,
			lastError: probe?.ollama.error ?? null,
		},
		{
			kind: "local",
			id: "lm-studio",
			label: "LM Studio",
			baseUrl: lmBase,
			status: linkStatusFromProbe(true, lmModels, probe?.lmStudio.error ?? null, false),
			modelIds: lmModels,
			lastError: probe?.lmStudio.error ?? null,
		},
	];

	const elizaCloud: ElizaCloudSlice = {
		kind: "eliza-cloud",
		dashboardUrl: branding.elizaCloudDashboardUrl,
		apiBaseUrl: branding.elizaCloudApiBaseUrl,
		authenticated: Boolean(token),
		authSource,
		status: elizaLink,
		modelIds: elizaModels,
		lastError: elizaErr,
		scopeNote: "gaming-surfaces-only",
	};

	return {
		elizaCloud,
		external,
		local,
		activeProviderId: opts.activeProviderId,
		activeModelId: opts.activeModelId,
		lastProbeAt: opts.lastProbeAt,
		aggregateProbeError: opts.aggregateProbeError,
	};
}
