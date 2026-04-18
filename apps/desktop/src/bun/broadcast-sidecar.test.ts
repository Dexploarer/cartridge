import { describe, expect, test } from "bun:test";

import {
	createDefaultBroadcasterSupervisorState,
	reduceBroadcasterEvent,
} from "./broadcast-sidecar";

describe("reduceBroadcasterEvent", () => {
	test("tracks ready, permissions, live status, and logs deterministically", () => {
		let state = createDefaultBroadcasterSupervisorState();

		state = reduceBroadcasterEvent(state, {
			type: "ready",
			log: "Cartridge broadcaster sidecar online.",
		});
		state = reduceBroadcasterEvent(state, {
			type: "permissions",
			permissions: {
				screen: "granted",
				systemAudio: "granted",
				microphone: "granted",
			},
			log: "Permissions granted.",
		});
		state = reduceBroadcasterEvent(state, {
			type: "status",
			status: "live",
			log: "Broadcast live.",
		});

		expect(state.ready).toBe(true);
		expect(state.permissions.microphone).toBe("granted");
		expect(state.status).toBe("live");
		expect(state.logs).toEqual([
			"Cartridge broadcaster sidecar online.",
			"Permissions granted.",
			"Broadcast live.",
		]);
	});

	test("updates source and health without clobbering prior logs", () => {
		let state = createDefaultBroadcasterSupervisorState();
		state = reduceBroadcasterEvent(state, {
			type: "source",
			source: {
				appId: "scape",
				sessionId: "session-123",
				displayName: "'scape",
				persona: "agent-gamer",
				viewer: "native-window",
				viewRole: "agent",
				captureMode: "immersive",
				broadcastRole: "source",
				takeoverState: "agent-active",
				scene: "'scape Agent Screen",
				outputLabel: "'scape · agent fullscreen",
			},
			log: "Source moved to scape.",
		});
		state = reduceBroadcasterEvent(state, {
			type: "stats",
			health: {
				fps: 60,
				bitrateKbps: 8000,
				droppedFrames: 3,
				reconnectCount: 1,
				encoderLagMs: 18,
				publishUptimeSec: 42,
			},
		});

		expect(state.sourceSessionId).toBe("session-123");
		expect(state.health.publishUptimeSec).toBe(42);
		expect(state.logs).toEqual(["Source moved to scape."]);
	});
});
