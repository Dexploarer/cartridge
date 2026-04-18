import { describe, expect, test } from "bun:test";

import type {
	StewardAgentCreationInput,
	StewardApprovalActionInput,
} from "../shared/runtime-shell-state";
import {
	createStewardAgent,
	getStewardWorkbenchSnapshot,
	resolveStewardApprovalAction,
} from "./steward-workbench";

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

describe("getStewardWorkbenchSnapshot", () => {
	test("loads direct Steward dashboard, approvals, and token state", async () => {
		await withEnv(
			{
				STEWARD_API_URL: "https://api.steward.fi",
				STEWARD_API_KEY: "stwd_tenant_key",
				STEWARD_AGENT_TOKEN: "stwd_agent_jwt",
				STEWARD_AGENT_ID: "cartridge-agent",
				STEWARD_TENANT_ID: "cartridge",
			},
			async () => {
				const snapshot = await getStewardWorkbenchSnapshot({
					fetchImpl: createFetchMock(async (input) => {
						const url = String(input);
						if (url.endsWith("/dashboard/cartridge-agent")) {
							return Response.json({
								ok: true,
								data: {
									agent: {
										id: "cartridge-agent",
										tenantId: "cartridge",
										name: "Cartridge Steward Agent",
										walletAddress: "0xabc123",
										createdAt: "2026-04-17T12:00:00.000Z",
									},
									balances: {
										evm: {
											native: "1500000000000000000",
											nativeFormatted: "1.500000",
											chainId: 8453,
											symbol: "ETH",
										},
									},
									spend: {
										todayFormatted: "0.050000",
										thisWeekFormatted: "0.250000",
										thisMonthFormatted: "1.250000",
									},
									policies: [
										{
											id: "spend-cap",
											type: "spending-limit",
											enabled: true,
											config: {
												maxPerTx: "100000000000000000",
												maxPerDay: "500000000000000000",
											},
										},
									],
									pendingApprovals: 1,
									recentTransactions: [
										{
											id: "tx-1",
											status: "signed",
											toAddress: "0xrouter",
											value: "10000000000000000",
											chainId: 8453,
											txHash: "0xhash",
											createdAt: "2026-04-17T12:10:00.000Z",
										},
									],
								},
							});
						}
						if (url.endsWith("/agents/cartridge-agent")) {
							return Response.json({
								ok: true,
								data: {
									id: "cartridge-agent",
									tenantId: "cartridge",
									name: "Cartridge Steward Agent",
									walletAddresses: {
										evm: "0xabc123",
										solana: "So11111111111111111111111111111111111111112",
									},
									createdAt: "2026-04-17T12:00:00.000Z",
								},
							});
						}
						if (url.includes("/agents/cartridge-agent/tokens")) {
							return Response.json({
								ok: true,
								data: {
									native: {
										balance: "1500000000000000000",
										formatted: "1.500000",
										symbol: "ETH",
										chainId: 8453,
									},
									tokens: [
										{
											address: "0xusdc",
											symbol: "USDC",
											name: "USD Coin",
											balance: "1000000",
											formatted: "1.0",
											valueUsd: "1.00",
										},
									],
								},
							});
						}
						if (url.includes("/approvals?status=pending")) {
							return Response.json({
								ok: true,
								data: [
									{
										id: "appr-1",
										txId: "tx-1",
										agentId: "cartridge-agent",
										agentName: "Cartridge Steward Agent",
										status: "pending",
										requestedAt: "2026-04-17T12:11:00.000Z",
										toAddress: "0xrouter",
										value: "10000000000000000",
										chainId: 8453,
										txStatus: "pending_approval",
									},
								],
							});
						}
						if (url.endsWith("/approvals/stats")) {
							return Response.json({
								ok: true,
								data: {
									pending: 1,
									approved: 8,
									rejected: 2,
									total: 11,
									avgWaitSeconds: 240,
								},
							});
						}
						throw new Error(`Unexpected Steward URL: ${url}`);
					}),
				});

				expect(snapshot.status).toBe("ready");
				expect(snapshot.mode).toBe("cloud-api");
				expect(snapshot.context.authMode).toBe("hybrid");
				expect(snapshot.agent.id).toBe("cartridge-agent");
				expect(snapshot.agent.walletSolana).toContain("So1111");
				expect(snapshot.balances.nativeFormatted).toBe("1.500000");
				expect(snapshot.policies).toHaveLength(1);
				expect(snapshot.approvals).toHaveLength(1);
				expect(snapshot.approvalStats.pending).toBe(1);
				expect(snapshot.tokens[0]?.symbol).toBe("USDC");
				expect(snapshot.creation.supported).toBe(true);
			},
		);
	});

	test("merges compat bridge data when the direct API is unavailable", async () => {
		await withEnv(
			{
				STEWARD_API_KEY: "stwd_tenant_key",
				CARTRIDGE_STEWARD_COMPAT_BASE_URL: "http://127.0.0.1:3000",
			},
			async () => {
				const snapshot = await getStewardWorkbenchSnapshot({
					fetchImpl: createFetchMock(async (input) => {
						const url = String(input);
						if (url.startsWith("https://api.steward.fi/")) {
							return Response.json(
								{ ok: false, error: "disabled" },
								{ status: 503 },
							);
						}
						if (url.endsWith("/api/wallet/steward-status")) {
							return Response.json({
								configured: true,
								available: true,
								connected: true,
								agentId: "compat-agent",
								agentName: "Compat Agent",
								walletAddresses: {
									evm: "0xcompat",
									solana: "CompatSolana1111111111111111111111111111111",
								},
							});
						}
						if (url.endsWith("/api/wallet/steward-policies")) {
							return Response.json([
								{
									id: "allowed",
									type: "approved-addresses",
									enabled: true,
									config: { addresses: ["0xrouter", "0xtreasury"] },
								},
							]);
						}
						if (url.includes("/api/wallet/steward-tx-records")) {
							return Response.json({
								records: [
									{
										id: "tx-compat",
										status: "confirmed",
										request: {
											to: "0xrouter",
											value: "25000000000000000",
											chainId: 8453,
										},
										createdAt: "2026-04-17T12:15:00.000Z",
									},
								],
							});
						}
						if (url.endsWith("/api/wallet/steward-pending-approvals")) {
							return Response.json([
								{
									queueId: "queue-1",
									status: "pending",
									requestedAt: "2026-04-17T12:16:00.000Z",
									transaction: {
										id: "tx-compat-pending",
										agentId: "compat-agent",
										status: "pending_approval",
										request: {
											to: "0xtreasury",
											value: "50000000000000000",
											chainId: 8453,
										},
										createdAt: "2026-04-17T12:16:00.000Z",
									},
								},
							]);
						}
						if (url.includes("/api/wallet/steward-balances")) {
							return Response.json({
								balance: "1000000000000000000",
								formatted: "1.000000",
								symbol: "ETH",
								chainId: 8453,
							});
						}
						if (url.includes("/api/wallet/steward-tokens")) {
							return Response.json({
								native: {
									balance: "1000000000000000000",
									formatted: "1.000000",
									symbol: "ETH",
									chainId: 8453,
								},
								tokens: [
									{
										address: "0xgame",
										symbol: "GAME",
										name: "Game Token",
										balance: "42000000000000000000",
										formatted: "42.0",
									},
								],
							});
						}
						if (url.includes("/api/wallet/steward-webhook-events")) {
							return Response.json({
								events: [
									{
										event: "tx.pending",
										data: { txId: "tx-compat-pending", value: "50000000000000000" },
										timestamp: "2026-04-17T12:16:05.000Z",
									},
								],
								nextIndex: 1,
							});
						}
						throw new Error(`Unexpected compat Steward URL: ${url}`);
					}),
				});

				expect(snapshot.status).toBe("ready");
				expect(snapshot.mode).toBe("hybrid");
				expect(snapshot.agent.id).toBe("compat-agent");
				expect(snapshot.approvals).toHaveLength(1);
				expect(snapshot.recentTransactions).toHaveLength(1);
				expect(snapshot.webhooks[0]?.event).toBe("tx.pending");
				expect(snapshot.tokens[0]?.symbol).toBe("GAME");
			},
		);
	});
});

describe("createStewardAgent", () => {
	test("creates an agent wallet and issues a scoped token", async () => {
		await withEnv(
			{
				STEWARD_API_URL: "https://api.steward.fi",
				STEWARD_API_KEY: "stwd_tenant_key",
			},
			async () => {
				const result = await createStewardAgent({
					request: {
						agentId: "cartridge-new-agent",
						name: "Cartridge New Agent",
						platformId: "cartridge",
						tokenExpiresIn: "30d",
					} satisfies StewardAgentCreationInput,
					fetchImpl: createFetchMock(async (input, init) => {
						const url = String(input);
						if (url.endsWith("/agents")) {
							expect(init?.method).toBe("POST");
							const headers = new Headers(init?.headers);
							expect(headers.get("x-steward-key")).toBe("stwd_tenant_key");
							expect(await new Response(init?.body).text()).toContain(
								"cartridge-new-agent",
							);
							return Response.json({
								ok: true,
								data: {
									id: "cartridge-new-agent",
									tenantId: "cartridge",
									walletAddresses: {
										evm: "0xnew",
										solana: "NewSolana111111111111111111111111111111111",
									},
								},
							});
						}
						if (url.endsWith("/agents/cartridge-new-agent/token")) {
							expect(await new Response(init?.body).text()).toContain("30d");
							return Response.json({
								ok: true,
								data: {
									token: "stwd_agent_scoped",
								},
							});
						}
						throw new Error(`Unexpected create URL: ${url}`);
					}),
				});

				expect(result.agentId).toBe("cartridge-new-agent");
				expect(result.tenantId).toBe("cartridge");
				expect(result.evmAddress).toBe("0xnew");
				expect(result.token).toBe("stwd_agent_scoped");
			},
		);
	});
});

describe("resolveStewardApprovalAction", () => {
	test("approves a Steward transaction through the tenant approvals endpoint", async () => {
		await withEnv(
			{
				STEWARD_API_URL: "https://api.steward.fi",
				STEWARD_API_KEY: "stwd_tenant_key",
			},
			async () => {
				const result = await resolveStewardApprovalAction({
					request: {
						action: "approve",
						approvalId: "appr-1",
						txId: "tx-1",
					} satisfies StewardApprovalActionInput,
					fetchImpl: createFetchMock(async (input, init) => {
						const url = String(input);
						expect(url).toBe("https://api.steward.fi/approvals/tx-1/approve");
						expect(init?.method).toBe("POST");
						return Response.json({
							ok: true,
							data: {
								status: "approved",
								txHash: "0xapproved",
							},
						});
					}),
				});

				expect(result.status).toBe("ok");
				expect(result.txId).toBe("tx-1");
				expect(result.resolvedStatus).toBe("approved");
				expect(result.txHash).toBe("0xapproved");
			},
		);
	});
});
