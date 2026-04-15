import { describe, expect, test } from "bun:test";

import { CartridgeRuntime } from "./index";

function createFetchMock(handler: () => Promise<Response>): typeof fetch {
	return Object.assign(handler, {
		preconnect: async () => {},
	}) as typeof fetch;
}

describe("CartridgeRuntime", () => {
	test("uses only Cartridge header aliases", () => {
		const runtime = new CartridgeRuntime();

		expect(runtime.getConfig().brandingProfile.headers.aliases).toEqual({
			"x-cartridge-token": "x-eliza-token",
			"x-cartridge-client-id": "x-eliza-client-id",
			"x-cartridge-cloud-token": "x-eliza-cloud-token",
		});
	});

	test("boots and exposes chat, agents, and pip state for game sessions", () => {
		const runtime = new CartridgeRuntime();
		const observedEvents: string[] = [];

		runtime.subscribe("runtime.booted", () => {
			observedEvents.push("runtime.booted");
		});

		runtime.subscribe("operator.command.executed", () => {
			observedEvents.push("operator.command.executed");
		});

		runtime.boot();

		const session = runtime.launchSurface({
			appId: "babylon",
			persona: "user-gamer",
			launchedFrom: "desktop-main",
			viewer: "native-window",
		});

		const command = runtime.enqueueOperatorCommand(session.sessionId, {
			control: "open-market",
			payload: { market: "alpha" },
		});

		runtime.markCommandResolved(session.sessionId, {
			commandId: command.commandId,
			status: "executed",
			result: "market-opened",
		});

		for (let index = 0; index < 40; index += 1) {
			runtime.sendChatMessage({
				appId: "babylon",
				sessionId: session.sessionId,
				author: "Operator",
				body: `Watch the alpha market closely ${index}.`,
			});
		}

		runtime.appendTelemetry(session.sessionId, [
			{
				panel: "market-state",
				label: "Market",
				value: "Open",
				severity: "info",
				source: "test-suite",
			},
		]);

		runtime.endSession(session.sessionId, "Scenario complete");

		const state = runtime.getRuntimeState();
		const babylonMessages =
			state.chatThreads.find((thread) => thread.appId === "babylon")?.messages ?? [];

		expect(state.runtime.totalSurfaceCount).toBe(8);
		expect(state.runtime.totalSessionCount).toBe(1);
		expect(state.sessions[0]?.status).toBe("ended");
		expect(state.agents.some((agent) => agent.homeAppId === "babylon")).toBe(true);
		expect(babylonMessages.length).toBe(32);
		expect(babylonMessages.some((message) => message.body === "Watch the alpha market closely 0.")).toBe(
			false,
		);
		expect(babylonMessages.some((message) => message.body === "Watch the alpha market closely 39.")).toBe(
			true,
		);
		expect(babylonMessages.at(-1)?.body).toBe("Babylon session ended: Scenario complete");
		expect(state.pipScreens.some((screen) => screen.appId === "babylon")).toBe(true);
		expect(state.streams.some((stream) => stream.destinationId === "twitch")).toBe(true);
		expect(state.knowledge.length).toBeGreaterThan(0);
		expect(state.knowledge.every((doc) => doc.embeddingModel === "cartridge-text-embed-v3")).toBe(
			true,
		);
		expect(state.dataStores.length).toBe(4);
		expect(state.aiPlane.elizaCloud.kind).toBe("eliza-cloud");
		expect(state.aiPlane.external.some((x) => x.id === "openai")).toBe(true);
		expect(state.shellEmbed).toBeNull();
		expect(state.knowledge.some((doc) => doc.source === "cartridge-memory")).toBe(
			true,
		);
		expect(observedEvents).toContain("runtime.booted");
		expect(observedEvents).toContain("operator.command.executed");
		expect(runtime.getEventHistory().some((event) => event.type === "app.session.started")).toBe(
			true,
		);
	});

	test("refreshAiPlaneProbes records probe errors without swallowing them", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = createFetchMock(async () => {
			throw new TypeError("fetch failed");
		});

		try {
			const runtime = new CartridgeRuntime();
			await runtime.refreshAiPlaneProbes();

			const state = runtime.getRuntimeState();
			expect(state.aiPlane.lastProbeAt).not.toBeNull();
			expect(state.aiPlane.aggregateProbeError).toBeNull();
			expect(state.aiPlane.elizaCloud.lastError).toContain("fetch failed");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
