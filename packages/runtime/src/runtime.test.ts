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

		expect(state.runtime.totalSurfaceCount).toBe(10);
		expect(state.surfaces).toHaveLength(10);
		expect(state.surfaces.some((surface) => surface.appId === "hyperscape")).toBe(true);
		expect(state.surfaces.some((surface) => surface.appId === "scape")).toBe(true);
		expect(state.runtime.totalSessionCount).toBe(1);
		expect(state.sessions[0]?.status).toBe("ended");
		expect(state.agents.some((agent) => agent.homeAppId === "babylon")).toBe(true);
		expect(state.agents.some((agent) => agent.homeAppId === "hyperscape")).toBe(true);
		expect(state.agents.some((agent) => agent.homeAppId === "kinema")).toBe(true);
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

	test("prefers the agent gameplay session as the live stream source", () => {
		const runtime = new CartridgeRuntime();

		runtime.boot();

		runtime.launchSurface({
			appId: "babylon",
			persona: "user-gamer",
			launchedFrom: "desktop-main",
			viewer: "native-window",
		});

		const agentSession = runtime.launchSurface({
			appId: "scape",
			persona: "agent-gamer",
			launchedFrom: "desktop-main",
			viewer: "native-window",
		});

		const twitch = runtime
			.getRuntimeState()
			.streams.find((stream) => stream.destinationId === "twitch");

		expect(twitch?.sessionId).toBe(agentSession.sessionId);
		expect(twitch?.scene).toBe("'scape Agent Screen");
		expect(twitch?.outputLabel).toBe("'scape · agent fullscreen");
		expect(twitch?.captureMode).toBe("immersive");
		expect(twitch?.sourcePersona).toBe("agent-gamer");
		expect(twitch?.sourceViewRole).toBe("agent");
		expect(twitch?.takeoverState).toBe("agent-active");
	});

	test("does not fall back to non-agent sessions for broadcast source selection", () => {
		const runtime = new CartridgeRuntime();

		runtime.boot();

		runtime.launchSurface({
			appId: "babylon",
			persona: "user-gamer",
			launchedFrom: "desktop-main",
			viewer: "native-window",
		});

		const state = runtime.getRuntimeState();
		const twitch = state.streams.find((stream) => stream.destinationId === "twitch");

		expect(twitch?.sessionId).toBeNull();
		expect(state.broadcast.source.sessionId).toBeNull();
		expect(state.broadcast.source.broadcastRole).toBe("none");
		expect(state.broadcast.source.viewRole).toBeNull();
	});

	test("tracks broadcast config, audio matrix, permissions, and status state", () => {
		const runtime = new CartridgeRuntime();

		runtime.boot();
		runtime.launchSurface({
			appId: "scape",
			persona: "agent-gamer",
			launchedFrom: "desktop-main",
			viewer: "native-window",
		});

		runtime.updateBroadcastConfig({
			enabled: true,
			destinationUrl: "rtmps://live.example.com/app",
			streamKeyRef: "key••••7890",
			videoProfile: { width: 1280, height: 720 },
		});
		runtime.setBroadcastAudioBus("mic", {
			gainPct: 85,
			muted: true,
		});
		runtime.setBroadcastPermissions({
			screen: "granted",
			systemAudio: "granted",
			microphone: "granted",
		});
		runtime.setBroadcastStatus({
			status: "live",
			health: {
				fps: 60,
				bitrateKbps: 8000,
				droppedFrames: 2,
			},
			logs: ["Broadcaster ready", "Publish started"],
		});

		const state = runtime.getRuntimeState();

		expect(state.broadcast.config.enabled).toBe(true);
		expect(state.broadcast.config.destinationUrl).toBe("rtmps://live.example.com/app");
		expect(state.broadcast.config.streamKeyRef).toBe("key••••7890");
		expect(state.broadcast.config.videoProfile.width).toBe(1280);
		expect(state.broadcast.config.audioBuses.mic.gainPct).toBe(85);
		expect(state.broadcast.config.audioBuses.mic.muted).toBe(true);
		expect(state.broadcast.permissions.microphone).toBe("granted");
		expect(state.broadcast.status).toBe("live");
		expect(state.broadcast.health.fps).toBe(60);
		expect(state.broadcast.recentLogs).toEqual(["Broadcaster ready", "Publish started"]);
		expect(state.broadcast.source.viewRole).toBe("agent");
		expect(state.broadcast.source.takeoverState).toBe("agent-active");
	});

	test("stores dual-view shell embed descriptors and takeover state", () => {
		const runtime = new CartridgeRuntime();

		runtime.boot();
		runtime.launchSurfaceInShell({
			appId: "kinema",
			persona: "agent-gamer",
			splitPlay: true,
			launchUrlOverride: "http://127.0.0.1:5173/?cartridgeBridge=1&spawn=entrance",
			views: {
				agentView: {
					role: "agent",
					label: "Agent pane",
					url: "http://127.0.0.1:5173/?cartridgeBridge=1&spawn=entrance",
					controlMode: "agent-controlled",
					capturePriority: "primary",
				},
				userView: {
					role: "user",
					label: "User pane",
					url: "http://127.0.0.1:5173/?cartridgeBridge=1",
					controlMode: "user-controlled",
					capturePriority: "secondary",
				},
			},
			takeoverState: "user-observing",
		});

		const state = runtime.getRuntimeState();

		expect(state.shellEmbed).toMatchObject({
			appId: "kinema",
			persona: "agent-gamer",
			splitPlay: true,
			takeoverState: "user-observing",
		});
		expect(state.shellEmbed?.agentView).toMatchObject({
			url: "http://127.0.0.1:5173/?cartridgeBridge=1&spawn=entrance",
			controlMode: "agent-controlled",
		});
		expect(state.shellEmbed?.userView).toMatchObject({
			url: "http://127.0.0.1:5173/?cartridgeBridge=1",
			controlMode: "user-controlled",
		});
	});
});
