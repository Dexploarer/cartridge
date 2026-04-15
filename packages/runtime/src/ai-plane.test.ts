import { describe, expect, test } from "bun:test";

import { BRANDING_PROFILE } from "@cartridge/shared";

import { buildAiPlaneState } from "./ai-plane";

function withEnvOverrides(
	overrides: Partial<
		Record<
			| "OPENAI_API_KEY"
			| "CARTRIDGE_OPENAI_API_KEY"
			| "ANTHROPIC_API_KEY"
			| "CARTRIDGE_ANTHROPIC_API_KEY",
			string | undefined
		>
	>,
	run: () => void,
): void {
	const previousValues = new Map<string, string | undefined>();

	for (const key of [
		"OPENAI_API_KEY",
		"CARTRIDGE_OPENAI_API_KEY",
		"ANTHROPIC_API_KEY",
		"CARTRIDGE_ANTHROPIC_API_KEY",
	] as const) {
		previousValues.set(key, process.env[key]);
		if (!Object.hasOwn(overrides, key)) {
			continue;
		}
		const value = overrides[key];
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}

	try {
		run();
	} finally {
		for (const [key, value] of previousValues) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

describe("buildAiPlaneState", () => {
	test("uses explicit configuration states", () => {
		withEnvOverrides(
			{
				OPENAI_API_KEY: undefined,
				CARTRIDGE_OPENAI_API_KEY: undefined,
				ANTHROPIC_API_KEY: undefined,
				CARTRIDGE_ANTHROPIC_API_KEY: undefined,
			},
			() => {
				const state = buildAiPlaneState(BRANDING_PROFILE, {
					elizaTokenOverride: null,
					activeProviderId: null,
					activeModelId: null,
					lastProbe: null,
					lastProbeAt: null,
					aggregateProbeError: null,
				});

				expect(state.external.map((slice) => [slice.id, slice.status])).toEqual([
					["openai", "unconfigured"],
					["anthropic", "unconfigured"],
				]);
			},
		);
	});

	test("marks Anthropic as configured when a key is present", () => {
		withEnvOverrides(
			{
				OPENAI_API_KEY: undefined,
				CARTRIDGE_OPENAI_API_KEY: undefined,
				ANTHROPIC_API_KEY: "anthropic-test-key",
				CARTRIDGE_ANTHROPIC_API_KEY: undefined,
			},
			() => {
				const state = buildAiPlaneState(BRANDING_PROFILE, {
					elizaTokenOverride: null,
					activeProviderId: null,
					activeModelId: null,
					lastProbe: null,
					lastProbeAt: null,
					aggregateProbeError: null,
				});

				expect(
					state.external.find((slice) => slice.id === "anthropic")?.status,
				).toBe("configured");
			},
		);
	});
});
