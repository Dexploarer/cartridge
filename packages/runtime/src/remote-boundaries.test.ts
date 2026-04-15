import { describe, expect, test } from "bun:test";

import { probeOpenAiCompatibleModels } from "./ai-plane-probe";
import { fetchRemoteDataPlane } from "./data-plane-remote";
import { readJsonResponse } from "./json";

function withEnvOverrides(
	overrides: Record<string, string | undefined>,
	run: () => Promise<void> | void,
): Promise<void> | void {
	const previousValues = new Map<string, string | undefined>();

	for (const [key, value] of Object.entries(overrides)) {
		previousValues.set(key, process.env[key]);
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}

	const restore = () => {
		for (const [key, value] of previousValues) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	};

	try {
		const result = run();
		if (result instanceof Promise) {
			return result.finally(restore);
		}
		restore();
	} catch (error) {
		restore();
		throw error;
	}
}

describe("runtime remote parsing boundaries", () => {
	test("readJsonResponse rejects malformed JSON with a clear error", async () => {
		await expect(readJsonResponse(new Response("not json"))).rejects.toThrow(
			"Invalid JSON response",
		);
	});

	test("probeOpenAiCompatibleModels surfaces malformed JSON errors", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () => new Response("not json", { status: 200 })) as unknown as typeof fetch;

		try {
			const result = await probeOpenAiCompatibleModels("https://example.test", "token");
			expect(result.modelIds).toEqual([]);
			expect(result.error).toContain("Invalid JSON response");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("fetchRemoteDataPlane surfaces malformed JSON errors", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () => new Response("not json", { status: 200 })) as unknown as typeof fetch;

		try {
			await withEnvOverrides(
				{
					CARTRIDGE_KNOWLEDGE_API_URL: "https://example.test/knowledge",
					CARTRIDGE_DATA_PLANE_API_URL: undefined,
				},
				async () => {
					const result = await fetchRemoteDataPlane();
					expect(result.knowledge).toBeNull();
					expect(result.dataStores).toBeNull();
					expect(result.error).toContain("knowledge: Invalid JSON response");
				},
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
