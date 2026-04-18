import { describe, expect, test } from "bun:test";

import { PRIMARY_GAME_APPS, type OperatorCommand } from "@cartridge/shared";

import {
	createBabylonAgent,
	dispatchSurfaceControlCommand,
	getBabylonOperatorSnapshot,
	refreshSurfaceSessionTelemetry,
	resolveSurfaceWorkspace,
} from "./surface-control-adapter";

function createFetchMock(
	handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
	return Object.assign(handler, {
		preconnect: async () => {},
	}) as typeof fetch;
}

function getSurface(appId: string) {
	const surface = PRIMARY_GAME_APPS.find((entry) => entry.appId === appId);
	if (!surface) {
		throw new Error(`Missing surface ${appId}`);
	}
	return surface;
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

function makeSession(appId: string, launchUrl: string) {
	const surface = getSurface(appId);
	return {
		sessionId: `session-${appId}`,
		appId,
		displayName: surface.displayName,
		persona: "agent-gamer" as const,
		status: "active" as const,
		mode: surface.session.mode,
		viewer: "native-window" as const,
		launchedFrom: "bun-test",
		startedAt: "2026-04-17T00:00:00.000Z",
		updatedAt: "2026-04-17T00:00:00.000Z",
		commandQueue: [],
		telemetry: [],
		suggestions: [],
		notes: [],
		manifest: {
			launchType: surface.launchType,
			launchUrl,
			capabilities: surface.capabilities,
			packageName: surface.packageName,
		},
	};
}

function makeCommand(
	control: string,
	payload: Record<string, string | number | boolean | null> = {},
): OperatorCommand {
	return {
		commandId: `cmd-${control}`,
		control,
		payload,
		status: "queued",
		enqueuedAt: "2026-04-17T00:00:00.000Z",
		resolvedAt: null,
		result: null,
	};
}

describe("resolveSurfaceWorkspace", () => {
	test("creates coordinated agent and user views for split 'scape sessions", () => {
		withEnv(
			{
				CARTRIDGE_ROUTE_BASE_URL_SCAPE: "https://ops.example/api/apps/scape",
				SCAPE_AGENT_ID: "scaper-1",
			},
			() => {
				const surface = getSurface("scape");
				const resolved = resolveSurfaceWorkspace({
					surface,
					persona: "agent-gamer",
					splitPlay: true,
					launchUrl: surface.launchUrl,
				});

				expect(resolved.agentView.role).toBe("agent");
				expect(resolved.agentView.controlMode).toBe("agent-controlled");
				expect(resolved.userView?.role).toBe("user");
				expect(resolved.userView?.controlMode).toBe("user-controlled");
				expect(resolved.takeoverState).toBe("user-observing");
			},
		);
	});

	test("degrades Hyperscape split sessions to an explicit watch-only user pane", () => {
		const surface = getSurface("hyperscape");
		const resolved = resolveSurfaceWorkspace({
			surface,
			persona: "agent-gamer",
			splitPlay: true,
			launchUrl: surface.launchUrl,
		});

		expect(resolved.userView?.controlMode).toBe("watch-only");
		expect(resolved.sessionNote).toContain("watch-only");
	});
});

describe("dispatchSurfaceControlCommand", () => {
	test("routes 'scape pause through the upstream session control endpoint", async () => {
		await withEnv(
			{
				CARTRIDGE_ROUTE_BASE_URL_SCAPE: "https://ops.example/api/apps/scape",
				SCAPE_AGENT_ID: "scaper-1",
			},
			async () => {
				const calls: Array<{ url: string; body: string | undefined }> = [];
				const result = await dispatchSurfaceControlCommand({
					surface: getSurface("scape"),
					session: makeSession("scape", "https://scape-client.example"),
					command: makeCommand("pause-loop"),
					fetchImpl: createFetchMock(async (input, init) => {
						calls.push({
							url: String(input),
							body:
								typeof init?.body === "string"
									? init.body
									: undefined,
						});
						return new Response("paused", { status: 200 });
					}),
				});

				expect(calls[0]?.url).toBe(
					"https://ops.example/api/apps/scape/session/scape%3Ascaper-1/control",
				);
				expect(calls[0]?.body).toBe("pause");
				expect(result.status).toBe("executed");
			},
		);
	});

	test("uses Babylon prediction buy route when payload includes a market id", async () => {
		await withEnv(
			{
				BABYLON_AGENT_ID: "oracle-1",
				BABYLON_AGENT_SECRET: "top-secret",
			},
			async () => {
				const calls: string[] = [];
				const result = await dispatchSurfaceControlCommand({
					surface: getSurface("babylon"),
					session: makeSession("babylon", "https://staging.babylon.market"),
					command: makeCommand("place-prediction", {
						marketId: "alpha",
						side: "buy",
						amount: 12,
					}),
					fetchImpl: createFetchMock(async (input) => {
						const url = String(input);
						calls.push(url);
						if (url.endsWith("/api/agents/auth")) {
							return Response.json({ token: "session-token", expiresIn: 60 });
						}
						if (url.includes("/api/markets/predictions/alpha/buy")) {
							return Response.json({ ok: true });
						}
						if (url.includes("/api/agents/oracle-1")) {
							return Response.json({ name: "Oracle Relay", balance: 44 });
						}
						return Response.json({}, { status: 200 });
					}),
				});

				expect(calls.some((url) => url.endsWith("/api/agents/auth"))).toBe(true);
				expect(
					calls.some((url) => url.includes("/api/markets/predictions/alpha/buy")),
				).toBe(true);
				expect(result.status).toBe("executed");
			},
		);
	});
});

describe("getBabylonOperatorSnapshot", () => {
	test("loads Babylon wallet, markets, chart history, and recent trades through the hosted adapter", async () => {
		await withEnv(
			{
				BABYLON_AGENT_ID: "oracle-1",
				BABYLON_AGENT_SECRET: "top-secret",
				BABYLON_A2A_API_KEY: "bab_live_123",
				BABYLON_AGENT_ADDRESS: "0xabc123",
			},
			async () => {
				const snapshot = await getBabylonOperatorSnapshot({
					launchUrl: "https://staging.babylon.market",
					fetchImpl: createFetchMock(async (input) => {
						const url = String(input);
						if (url.endsWith("/api/agents/auth")) {
							return Response.json({ token: "session-token", expiresIn: 60 });
						}
						if (url.includes("/api/agents/oracle-1/summary")) {
							return Response.json({
								agent: {
									id: "oracle-1",
									name: "Oracle Relay",
									agentStatus: "running",
									totalTrades: 12,
									winRate: 62.5,
									reputationScore: 91,
									totalDeposited: 300,
									totalWithdrawn: 40,
									lifetimePnL: 88.5,
								},
								portfolio: {
									totalAssets: 512.25,
									available: 180.75,
									positions: 3,
									totalPnL: 48.5,
									wallet: 320.1,
								},
							});
						}
						if (url.includes("/api/agents/oracle-1/wallet")) {
							return Response.json({
								balance: 320.1,
								transactions: [
									{
										id: "tx-1",
										type: "deposit",
										amount: 200,
										timestamp: "2026-04-17T00:00:00.000Z",
									},
								],
							});
						}
						if (url.includes("/api/agents/oracle-1/trading-balance")) {
							return Response.json({ balance: 180.75 });
						}
						if (url.includes("/api/agents/oracle-1/recent-trades")) {
							return Response.json({
								items: [
									{
										id: "trade-1",
										summary: "Bought YES shares in BTC market",
										timestamp: "2026-04-17T01:00:00.000Z",
										pnl: 12.3,
									},
								],
							});
						}
						if (url.includes("/api/markets/predictions?pageSize=5&status=active")) {
							return Response.json({
								markets: [
									{
										id: "market-1",
										title: "Will BTC close above $110k?",
										status: "active",
										yesPrice: 0.64,
										noPrice: 0.36,
										volume: 1200,
										liquidity: 900,
										category: "crypto",
									},
								],
							});
						}
						if (url.includes("/api/markets/predictions/market-1/history")) {
							return Response.json({
								history: [
									{ timestamp: "2026-04-17T00:00:00.000Z", yesPrice: 0.51 },
									{ timestamp: "2026-04-17T01:00:00.000Z", yesPrice: 0.57 },
									{ timestamp: "2026-04-17T02:00:00.000Z", yesPrice: 0.64 },
								],
							});
						}
						if (url.includes("/api/markets/positions/oracle-1")) {
							return Response.json({
								predictions: [{ id: "p-1" }, { id: "p-2" }],
								perpetuals: [{ id: "perp-1" }],
								totalValue: 512.25,
								totalUnrealizedPnL: 48.5,
							});
						}
						if (url.includes("/api/agents/oracle-1")) {
							return Response.json({
								id: "oracle-1",
								name: "Oracle Relay",
								state: "running",
							});
						}
						return Response.json({}, { status: 404 });
					}),
				});

				expect(snapshot.status).toBe("ready");
				expect(snapshot.agent.name).toBe("Oracle Relay");
				expect(snapshot.balances.wallet).toBe(320.1);
				expect(snapshot.chart.points).toHaveLength(3);
				expect(snapshot.recentTrades[0]?.summary).toContain("Bought YES shares");
				expect(snapshot.creation.supported).toBe(false);
			},
		);
	});
});

describe("createBabylonAgent", () => {
	test("registers an external Babylon agent with the authenticated creation endpoint", async () => {
		await withEnv(
			{
				CARTRIDGE_BABYLON_AUTH_TOKEN: "privy-token",
			},
			async () => {
				const result = await createBabylonAgent({
					launchUrl: "https://staging.babylon.market",
					request: {
						externalId: "cartridge-bot",
						name: "Cartridge Bot",
						description: "Routes Babylon trading through Cartridge.",
					},
					fetchImpl: createFetchMock(async (input, init) => {
						const url = String(input);
						expect(url).toContain("/api/agents/external/register");
						expect((init?.headers as Record<string, string>)?.["Authorization"]).toBe(
							"Bearer privy-token",
						);
						return Response.json({
							agentId: "cartridge-bot",
							apiKey: "bab_live_secret",
						});
					}),
				});

				expect(result.agentId).toBe("cartridge-bot");
				expect(result.apiKey).toBe("bab_live_secret");
				expect(result.mode).toBe("external-register");
			},
		);
	});
});

describe("refreshSurfaceSessionTelemetry", () => {
	test("surfaces Hyperscape telemetry and degrades cleanly when only monitoring is available", async () => {
		await withEnv(
			{
				HYPERSCAPE_CLIENT_URL: "https://hyperscape.example",
				CARTRIDGE_AGENT_ID_HYPERSCAPE: "hyper-1",
				HYPERSCAPE_CHARACTER_ID: "char-7",
			},
			async () => {
				const frames = await refreshSurfaceSessionTelemetry({
					surface: getSurface("hyperscape"),
					session: makeSession("hyperscape", "https://hyperscape.example"),
					fetchImpl: createFetchMock(async (input) => {
						const url = String(input);
						if (url.endsWith("/api/embedded-agents")) {
							return Response.json({
								agents: [{ agentId: "hyper-1", state: "running" }],
							});
						}
						if (url.endsWith("/api/agents/hyper-1/goal")) {
							return Response.json({
								goal: { description: "Follow the lead player" },
							});
						}
						if (url.endsWith("/api/agents/hyper-1/quick-actions")) {
							return Response.json({
								quickCommands: [{ command: "follow lead" }],
							});
						}
						if (url.includes("/api/agents/hyper-1/thoughts")) {
							return Response.json({
								thoughts: [{ content: "Maintaining line of sight." }],
							});
						}
						return Response.json({}, { status: 404 });
					}),
				});

				expect(frames).toHaveLength(3);
				expect(frames[0]?.panel).toBe("auth-state");
				expect(frames[1]?.value).toContain("char-7");
				expect(frames[2]?.value).toContain("Maintaining line of sight.");
			},
		);
	});
});
