import { describe, expect, test } from "bun:test";

import {
	GameSessionManager,
	createDefaultAppRegistry,
} from "./index";
import { launchUrlOverrideEnvKey } from "./registry";

function withEnvOverrides(
	overrides: Partial<{
		CARTRIDGE_LAUNCH_URL_SCAPE: string | undefined;
		SCAPE_CLIENT_URL: string | undefined;
	}>,
	run: () => void,
): void {
	const previousValues = new Map<string, string | undefined>();

	for (const key of ["CARTRIDGE_LAUNCH_URL_SCAPE", "SCAPE_CLIENT_URL"] as const) {
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

describe("AppRegistry", () => {
	test("tracks the active gaming surface catalog", () => {
		const registry = createDefaultAppRegistry();

		expect(registry.listApps()).toHaveLength(8);
		expect(registry.listAppsByCategory("game")).toHaveLength(4);
		expect(registry.listAppsByCategory("support")).toHaveLength(4);
		expect(registry.getCatalogSummary()).toEqual({
			totalApps: 8,
			games: 4,
			support: 4,
			operatorSurfaces: 5,
			personaCoverage: {
				"agent-gamer": 8,
				"dev-gamer": 8,
				"user-gamer": 7,
			},
		});
		expect(registry.getApp("scape")?.displayName).toBe("'scape");
		expect(registry.getApp("scape")?.launchUrl).toBe(
			"https://scape-client-2sqyc.kinsta.page",
		);
		expect(registry.getApp("babylon")?.launchUrl).toBe("http://localhost:3000");
		expect(registry.getApp("companion")?.launchUrl).toBeTruthy();
		expect(registry.getOperatorSurface("coding")?.supportsCommandQueue).toBe(true);
		expect(
			registry
				.listAppsForPersona("dev-gamer")
				.some((app) => app.appId === "coding"),
		).toBe(true);
	});
});

describe("launch URL env overrides", () => {
	test("maps appId to CARTRIDGE_LAUNCH_URL_* env key", () => {
		expect(launchUrlOverrideEnvKey("scape")).toBe("CARTRIDGE_LAUNCH_URL_SCAPE");
		expect(launchUrlOverrideEnvKey("defense-of-the-agents")).toBe(
			"CARTRIDGE_LAUNCH_URL_DEFENSE_OF_THE_AGENTS",
		);
	});

	test("CARTRIDGE_LAUNCH_URL_SCAPE wires the 'scape surface client", () => {
		const url = "https://client.scape.example/play";
		withEnvOverrides({ CARTRIDGE_LAUNCH_URL_SCAPE: url }, () => {
			expect(createDefaultAppRegistry().getApp("scape")?.launchUrl).toBe(url);
		});
		expect(createDefaultAppRegistry().getApp("scape")?.launchUrl).toBe(
			"https://scape-client-2sqyc.kinsta.page",
		);
	});

	test("SCAPE_CLIENT_URL overrides default when CARTRIDGE_LAUNCH_URL_SCAPE is unset", () => {
		const url = "http://localhost:3000";
		withEnvOverrides({ SCAPE_CLIENT_URL: url }, () => {
			expect(createDefaultAppRegistry().getApp("scape")?.launchUrl).toBe(url);
		});
	});

	test("CARTRIDGE_LAUNCH_URL_SCAPE wins over SCAPE_CLIENT_URL", () => {
		withEnvOverrides(
			{
				SCAPE_CLIENT_URL: "http://localhost:3000",
				CARTRIDGE_LAUNCH_URL_SCAPE: "https://cartridge-wins.example/",
			},
			() => {
				expect(createDefaultAppRegistry().getApp("scape")?.launchUrl).toBe(
					"https://cartridge-wins.example/",
				);
			},
		);
	});
});

describe("GameSessionManager", () => {
	test("tracks session lifecycle without polling", () => {
		const registry = createDefaultAppRegistry();
		const events: string[] = [];
		const manager = new GameSessionManager(registry, (event) => {
			events.push(event.type);
		});

		const session = manager.startSession({
			appId: "scape",
			persona: "agent-gamer",
			launchedFrom: "bun-test",
			viewer: "native-window",
		});

		expect(session.status).toBe("active");

		const command = manager.enqueueCommand(session.sessionId, {
			control: "pause-loop",
			payload: { source: "test" },
			note: "Queue a loop pause",
		});

		expect(command.status).toBe("queued");

		manager.resolveCommand(session.sessionId, {
			commandId: command.commandId,
			status: "executed",
			result: "Loop paused",
		});

		manager.appendTelemetry(session.sessionId, [
			{
				panel: "loop-state",
				label: "Loop State",
				value: "Stable",
				severity: "info",
				source: "test-suite",
			},
		]);

		manager.pauseSession(session.sessionId, "Hold for operator review");
		manager.resumeSession(session.sessionId, "Resume validated loop");
		const ended = manager.endSession(session.sessionId, "Test complete");

		expect(ended.status).toBe("ended");
		expect(manager.getSession(session.sessionId)?.commandQueue[0]?.status).toBe(
			"executed",
		);
		expect(events).toContain("app.session.started");
		expect(events).toContain("operator.command.enqueued");
		expect(events).toContain("operator.command.executed");
		expect(events).toContain("telemetry.frame.received");
		expect(events).toContain("app.session.ended");
	});

	test("trims session notes to the configured history window", () => {
		const manager = new GameSessionManager(createDefaultAppRegistry());
		const session = manager.startSession({
			appId: "scape",
			persona: "agent-gamer",
			launchedFrom: "bun-test",
			viewer: "native-window",
		});

		for (let index = 0; index < 25; index += 1) {
			manager.addSessionNote(session.sessionId, `note-${index}`);
		}

		const updated = manager.getSession(session.sessionId);

		expect(updated?.notes).toHaveLength(20);
		expect(updated?.notes[0]).toBe("note-5");
		expect(updated?.notes[19]).toBe("note-24");
	});
});
