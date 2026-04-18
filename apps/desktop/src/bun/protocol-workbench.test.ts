import { describe, expect, test } from "bun:test";

import type {
	ProtocolA2ARequestInput,
	ProtocolX402ProbeInput,
} from "../shared/runtime-shell-state";
import {
	callA2AEndpoint,
	getProtocolWorkbenchSnapshot,
	probeX402Endpoint,
} from "./protocol-workbench";

function createFetchMock(
	handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
	return Object.assign(handler, {
		preconnect: async () => {},
	}) as typeof fetch;
}

function withEnv(
	overrides: Record<string, string | undefined>,
	run: () => Promise<void> | void,
): Promise<void> | void {
	const previous = new Map<string, string | undefined>();
	for (const [key, value] of Object.entries(overrides)) {
		previous.set(key, process.env[key]);
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	const restore = () => {
		for (const [key, value] of previous) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	};
	try {
		const result = run();
		if (result && typeof (result as Promise<void>).finally === "function") {
			return (result as Promise<void>).finally(restore);
		}
		restore();
		return result;
	} catch (error) {
		restore();
		throw error;
	}
}

describe("getProtocolWorkbenchSnapshot", () => {
	test("loads Babylon's A2A card and infers the current identity mode", async () => {
		await withEnv(
			{
				BABYLON_AGENT_ID: "1:4242",
				BABYLON_AGENT_ADDRESS: "0xabc123",
				BABYLON_A2A_API_KEY: "bab_live_123",
			},
			async () => {
				const snapshot = await getProtocolWorkbenchSnapshot({
					fetchImpl: createFetchMock(async (input) => {
						const url = String(input);
						expect(url).toContain(".well-known/agent-card.json");
						return Response.json({
							name: "Babylon",
							description: "Social conspiracy game",
							url: "https://babylon.market/api/a2a",
							protocolVersion: "0.3.0",
							preferredTransport: "JSONRPC",
							provider: {
								organization: "Babylon",
							},
							securitySchemes: {
								babylonApiKey: {
									type: "apiKey",
									in: "header",
									name: "X-Babylon-Api-Key",
								},
							},
							skills: [
								{
									id: "payments",
									name: "Payments (x402)",
									description: "Request and verify on-chain payments.",
									tags: ["payments", "x402"],
								},
							],
						});
					}),
				});

				expect(snapshot.a2a.status).toBe("needs-auth");
				expect(snapshot.a2a.endpointUrl).toBe("https://babylon.market/api/a2a");
				expect(snapshot.a2a.securitySchemes[0]).toContain("X-Babylon-Api-Key");
				expect(snapshot.a2a.skills[0]?.name).toContain("x402");
				expect(snapshot.identity.status).toBe("onchain");
				expect(snapshot.identity.tokenId).toBe("4242");
				expect(snapshot.identity.authMode).toBe("hybrid");
			},
		);
	});
});

describe("callA2AEndpoint", () => {
	test("posts JSON-RPC to the resolved A2A endpoint with Babylon auth headers", async () => {
		await withEnv(
			{
				BABYLON_AGENT_ID: "1:4242",
				BABYLON_AGENT_ADDRESS: "0xabc123",
				BABYLON_A2A_API_KEY: "bab_live_123",
			},
			async () => {
				const result = await callA2AEndpoint({
					request: {
						cardUrl: "https://babylon.market/.well-known/agent-card.json",
						method: "a2a.getBalance",
						paramsJson: "{}",
					} satisfies ProtocolA2ARequestInput,
					fetchImpl: createFetchMock(async (input, init) => {
						const url = String(input);
						if (url.endsWith(".well-known/agent-card.json")) {
							return Response.json({
								url: "https://babylon.market/api/a2a",
							});
						}
						expect(url).toBe("https://babylon.market/api/a2a");
						const headers = new Headers(init?.headers);
						expect(headers.get("x-agent-id")).toBe("1:4242");
						expect(headers.get("x-agent-address")).toBe("0xabc123");
						expect(headers.get("x-agent-token-id")).toBe("4242");
						expect(headers.get("x-babylon-api-key")).toBe("bab_live_123");
						return Response.json({
							jsonrpc: "2.0",
							id: "cartridge-1",
							result: { balance: 88.2 },
						});
					}),
				});

				expect(result.status).toBe("ok");
				expect(result.responseJson).toContain("\"balance\": 88.2");
			},
		);
	});
});

describe("probeX402Endpoint", () => {
	test("decodes PAYMENT-REQUIRED headers from an x402 challenge", async () => {
		const required = Buffer.from(
			JSON.stringify({
				accepts: [
					{
						scheme: "exact",
						price: "$0.001",
						network: "eip155:8453",
						payTo: "0xfeedface",
					},
				],
				description: "Premium endpoint",
			}),
			"utf8",
		).toString("base64");

		const result = await probeX402Endpoint(
			{
				url: "https://payments.example/weather",
				method: "GET",
			} satisfies ProtocolX402ProbeInput,
			createFetchMock(async () => {
				return new Response(JSON.stringify({ error: "payment required" }), {
					status: 402,
					headers: {
						"PAYMENT-REQUIRED": required,
					},
				});
			}),
		);

		expect(result.status).toBe("payment-required");
		expect(result.offers[0]?.network).toBe("eip155:8453");
		expect(result.paymentRequiredJson).toContain("\"Premium endpoint\"");
	});
});
