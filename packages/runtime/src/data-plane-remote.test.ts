import { afterEach, describe, expect, test } from "bun:test";

import { fetchRemoteDataPlane } from "./data-plane-remote";

const KEYS = ["CARTRIDGE_API_TOKEN", "CARTRIDGE_KNOWLEDGE_API_URL", "CARTRIDGE_DATA_PLANE_API_URL"] as const;

const originalValues = new Map<(typeof KEYS)[number], string | undefined>();
const originalFetch = globalThis.fetch;

function withRuntimeEnv(overrides: Record<(typeof KEYS)[number], string | undefined>): void {
	for (const key of KEYS) {
		if (!originalValues.has(key)) {
			originalValues.set(key, process.env[key]);
		}
	}

	for (const [key, value] of Object.entries(overrides) as Array<
		[(typeof KEYS)[number], string | undefined]
	>) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

function restoreRuntimeEnv(): void {
	for (const key of KEYS) {
		const value = originalValues.get(key);
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	originalValues.clear();
}

function withFetchMock(
	handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
): void {
	globalThis.fetch = handler as typeof fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
	restoreRuntimeEnv();
});

describe("fetchRemoteDataPlane", () => {
	test("normalizes raw array payloads", async () => {
		withRuntimeEnv({
			CARTRIDGE_KNOWLEDGE_API_URL: "https://example.invalid/knowledge",
			CARTRIDGE_DATA_PLANE_API_URL: "https://example.invalid/data",
			CARTRIDGE_API_TOKEN: undefined,
		});
		withFetchMock(async (input) => {
			const url = String(input);
			if (url.includes("/knowledge")) {
				return new Response(
					JSON.stringify([
						{
							docId: "doc-1",
							title: "Knowledge One",
							source: "session",
							scope: "ops",
							excerpt: "Alpha",
							tokensApprox: 12,
							lastIndexedAt: "2026-04-15T09:00:00.000Z",
							embeddingModel: "remote-model",
						},
					]),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}

			return new Response(
				JSON.stringify([
					{
						storeId: "store-1",
						label: "KV Cache",
						kind: "kv",
						status: "ready",
						region: "local",
						recordsApprox: 44,
						syncedWithCartridge: false,
					},
				]),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		});

		const result = await fetchRemoteDataPlane();

		expect(result.error).toBeNull();
		expect(result.knowledge).toEqual([
			{
				docId: "doc-1",
				title: "Knowledge One",
				source: "session",
				scope: "ops",
				excerpt: "Alpha",
				tokensApprox: 12,
				lastIndexedAt: "2026-04-15T09:00:00.000Z",
				embeddingModel: "remote-model",
			},
		]);
		expect(result.dataStores).toEqual([
			{
				storeId: "store-1",
				label: "KV Cache",
				kind: "kv",
				status: "ready",
				region: "local",
				recordsApprox: 44,
				syncedWithCartridge: false,
			},
		]);
	});

	test("normalizes documented wrapper objects", async () => {
		withRuntimeEnv({
			CARTRIDGE_KNOWLEDGE_API_URL: "https://example.invalid/knowledge",
			CARTRIDGE_DATA_PLANE_API_URL: "https://example.invalid/data",
			CARTRIDGE_API_TOKEN: undefined,
		});
		withFetchMock(async (input) => {
			const url = String(input);
			if (url.includes("/knowledge")) {
				return new Response(
					JSON.stringify({
						documents: [
							{
								docId: "doc-2",
								title: "Knowledge Two",
								source: "catalog",
								scope: "platform",
								excerpt: "Beta",
								tokensApprox: 24,
								lastIndexedAt: "2026-04-15T10:00:00.000Z",
								embeddingModel: "remote-model",
							},
						],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}

			return new Response(
				JSON.stringify({
					stores: [
						{
							storeId: "store-2",
							label: "Graph Links",
							kind: "graph",
							status: "readonly",
							region: "cloud",
							recordsApprox: "99",
							syncedWithCartridge: "true",
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		});

		const result = await fetchRemoteDataPlane();

		expect(result.error).toBeNull();
		expect(result.knowledge?.[0]?.docId).toBe("doc-2");
		expect(result.dataStores?.[0]?.storeId).toBe("store-2");
		expect(result.dataStores?.[0]?.recordsApprox).toBe(99);
		expect(result.dataStores?.[0]?.syncedWithCartridge).toBe(true);
	});

	test("normalizes legacy Milady wire fields into Cartridge names", async () => {
		withRuntimeEnv({
			CARTRIDGE_KNOWLEDGE_API_URL: "https://example.invalid/knowledge",
			CARTRIDGE_DATA_PLANE_API_URL: "https://example.invalid/data",
			CARTRIDGE_API_TOKEN: undefined,
		});
		withFetchMock(async (input) => {
			const url = String(input);
			if (url.includes("/knowledge")) {
				return new Response(
					JSON.stringify([
						{
							docId: "doc-legacy",
							title: "Legacy Knowledge",
							source: "milady-memory",
						},
					]),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}

			return new Response(
				JSON.stringify([
					{
						storeId: "store-legacy",
						label: "Legacy Sync",
						syncedWithMilady: "true",
					},
				]),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		});

		const result = await fetchRemoteDataPlane();

		expect(result.knowledge?.[0]?.source).toBe("cartridge-memory");
		expect(result.dataStores?.[0]?.syncedWithCartridge).toBe(true);
	});

	test("ignores undocumented legacy wrapper objects", async () => {
		withRuntimeEnv({
			CARTRIDGE_KNOWLEDGE_API_URL: "https://example.invalid/knowledge",
			CARTRIDGE_DATA_PLANE_API_URL: "https://example.invalid/data",
			CARTRIDGE_API_TOKEN: undefined,
		});
		withFetchMock(async (input) => {
			const url = String(input);
			if (url.includes("/knowledge")) {
				return new Response(
					JSON.stringify({
						data: {
							documents: [{ docId: "legacy-doc", title: "Legacy Wrapper" }],
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}

			return new Response(
				JSON.stringify({
					dataStores: [{ storeId: "legacy-store", label: "Legacy Store" }],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		});

		const result = await fetchRemoteDataPlane();

		expect(result.error).toBeNull();
		expect(result.knowledge).toBeNull();
		expect(result.dataStores).toBeNull();
	});
});
