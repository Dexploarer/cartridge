import { describe, expect, test } from "bun:test";

import {
	GameSessionManager,
	createDefaultAppRegistry,
} from "./index";
import { launchUrlOverrideEnvKey } from "./registry";

function withEnvOverrides(
	overrides: Partial<{
		BABYLON_API_URL: string | undefined;
		BABYLON_APP_URL: string | undefined;
		BABYLON_CLIENT_URL: string | undefined;
		CARTRIDGE_LAUNCH_URL_BABYLON: string | undefined;
		CARTRIDGE_LAUNCH_URL_HYPERSCAPE: string | undefined;
		CARTRIDGE_LAUNCH_URL_KINEMA: string | undefined;
		CARTRIDGE_LAUNCH_URL_SCAPE: string | undefined;
		HYPERSCAPE_API_URL: string | undefined;
		HYPERSCAPE_CLIENT_URL: string | undefined;
		SCAPE_CLIENT_URL: string | undefined;
	}>,
	run: () => void,
): void {
	const previousValues = new Map<string, string | undefined>();

	for (const key of [
		"BABYLON_API_URL",
		"BABYLON_APP_URL",
		"BABYLON_CLIENT_URL",
		"CARTRIDGE_LAUNCH_URL_BABYLON",
		"CARTRIDGE_LAUNCH_URL_HYPERSCAPE",
		"CARTRIDGE_LAUNCH_URL_KINEMA",
		"CARTRIDGE_LAUNCH_URL_SCAPE",
		"HYPERSCAPE_API_URL",
		"HYPERSCAPE_CLIENT_URL",
		"SCAPE_CLIENT_URL",
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

describe("AppRegistry", () => {
	test("tracks the active gaming surface catalog", () => {
		const registry = createDefaultAppRegistry();

		expect(registry.listApps()).toHaveLength(10);
		expect(registry.listAppsByCategory("game")).toHaveLength(6);
		expect(registry.listAppsByCategory("support")).toHaveLength(4);
		expect(registry.getCatalogSummary()).toEqual({
			totalApps: 10,
			games: 6,
			support: 4,
			operatorSurfaces: 7,
			personaCoverage: {
				"agent-gamer": 10,
				"dev-gamer": 10,
				"user-gamer": 9,
			},
		});
		expect(registry.getApp("babylon")?.displayName).toBe("Babylon");
		expect(registry.getApp("babylon")?.launchUrl).toBe(
			"https://staging.babylon.market",
		);
		expect(registry.getApp("babylon")?.workspace).toMatchObject({
			controlTransport: "hybrid",
			supportsDualView: true,
			supportsTakeover: true,
			userInput: "takeover",
		});
		expect(registry.getApp("hyperscape")?.displayName).toBe("Hyperscape");
		expect(registry.getApp("hyperscape")?.launchUrl).toBe("https://hyperscape.gg");
		expect(registry.getApp("hyperscape")?.workspace).toMatchObject({
			controlTransport: "hybrid",
			supportsDualView: true,
			supportsTakeover: false,
			userInput: "watch-only",
		});
		expect(registry.getApp("scape")?.displayName).toBe("'scape");
		expect(registry.getApp("scape")?.launchUrl).toBe(
			"https://scape-client-2sqyc.kinsta.page",
		);
		expect(registry.getApp("scape")?.workspace).toMatchObject({
			controlTransport: "session-route",
			supportsDualView: true,
			supportsTakeover: true,
			userInput: "takeover",
		});
		expect(registry.getApp("kinema")?.displayName).toBe("Kinema");
		expect(registry.getApp("kinema")?.launchUrl).toBe("http://127.0.0.1:5173");
		expect(registry.getApp("kinema")?.workspace).toMatchObject({
			controlTransport: "local-bridge",
			supportsDualView: true,
			supportsTakeover: true,
			userInput: "supported",
		});
		expect(registry.getApp("companion")?.launchUrl).toBeTruthy();
		expect(registry.getOperatorSurface("babylon")?.supportsPauseResume).toBe(true);
		expect(registry.getOperatorSurface("hyperscape")?.supportsPauseResume).toBe(true);
		expect(registry.getOperatorSurface("kinema")?.supportsCommandQueue).toBe(true);
		expect(registry.getOperatorSurface("coding")?.supportsCommandQueue).toBe(true);
		expect(
			registry
				.listAppsForPersona("dev-gamer")
				.some((app) => app.appId === "kinema"),
		).toBe(true);
	});
});

describe("launch URL env overrides", () => {
	test("maps appId to CARTRIDGE_LAUNCH_URL_* env key", () => {
		expect(launchUrlOverrideEnvKey("babylon")).toBe("CARTRIDGE_LAUNCH_URL_BABYLON");
		expect(launchUrlOverrideEnvKey("hyperscape")).toBe(
			"CARTRIDGE_LAUNCH_URL_HYPERSCAPE",
		);
		expect(launchUrlOverrideEnvKey("kinema")).toBe("CARTRIDGE_LAUNCH_URL_KINEMA");
		expect(launchUrlOverrideEnvKey("scape")).toBe("CARTRIDGE_LAUNCH_URL_SCAPE");
		expect(launchUrlOverrideEnvKey("defense-of-the-agents")).toBe(
			"CARTRIDGE_LAUNCH_URL_DEFENSE_OF_THE_AGENTS",
		);
	});

	test("CARTRIDGE_LAUNCH_URL_BABYLON overrides the Babylon launch URL", () => {
		const url = "https://babylon.example/play";
		withEnvOverrides({ CARTRIDGE_LAUNCH_URL_BABYLON: url }, () => {
			expect(createDefaultAppRegistry().getApp("babylon")?.launchUrl).toBe(url);
		});
		expect(createDefaultAppRegistry().getApp("babylon")?.launchUrl).toBe(
			"https://staging.babylon.market",
		);
	});

	test("BABYLON_CLIENT_URL overrides Babylon when CARTRIDGE_LAUNCH_URL_BABYLON is unset", () => {
		const url = "http://localhost:3000";
		withEnvOverrides({ BABYLON_CLIENT_URL: url }, () => {
			expect(createDefaultAppRegistry().getApp("babylon")?.launchUrl).toBe(url);
		});
	});

	test("BABYLON_APP_URL and BABYLON_API_URL act as Babylon fallbacks", () => {
		withEnvOverrides({ BABYLON_APP_URL: "https://babylon-app.example" }, () => {
			expect(createDefaultAppRegistry().getApp("babylon")?.launchUrl).toBe(
				"https://babylon-app.example",
			);
		});

		withEnvOverrides({ BABYLON_API_URL: "https://babylon-api.example" }, () => {
			expect(createDefaultAppRegistry().getApp("babylon")?.launchUrl).toBe(
				"https://babylon-api.example",
			);
		});
	});

	test("CARTRIDGE_LAUNCH_URL_BABYLON wins over Babylon legacy envs", () => {
		withEnvOverrides(
			{
				BABYLON_CLIENT_URL: "http://localhost:3000",
				CARTRIDGE_LAUNCH_URL_BABYLON: "https://cartridge-babylon.example/",
			},
			() => {
				expect(createDefaultAppRegistry().getApp("babylon")?.launchUrl).toBe(
					"https://cartridge-babylon.example/",
				);
			},
		);
	});

	test("CARTRIDGE_LAUNCH_URL_HYPERSCAPE overrides the Hyperscape launch URL", () => {
		const url = "https://hyperscape.example/play";
		withEnvOverrides({ CARTRIDGE_LAUNCH_URL_HYPERSCAPE: url }, () => {
			expect(createDefaultAppRegistry().getApp("hyperscape")?.launchUrl).toBe(url);
		});
		expect(createDefaultAppRegistry().getApp("hyperscape")?.launchUrl).toBe(
			"https://hyperscape.gg",
		);
	});

	test("HYPERSCAPE_CLIENT_URL overrides Hyperscape when CARTRIDGE_LAUNCH_URL_HYPERSCAPE is unset", () => {
		const url = "http://localhost:3333";
		withEnvOverrides({ HYPERSCAPE_CLIENT_URL: url }, () => {
			expect(createDefaultAppRegistry().getApp("hyperscape")?.launchUrl).toBe(url);
		});
	});

	test("HYPERSCAPE_API_URL acts as a Hyperscape fallback", () => {
		withEnvOverrides({ HYPERSCAPE_API_URL: "https://hyperscape-api.example" }, () => {
			expect(createDefaultAppRegistry().getApp("hyperscape")?.launchUrl).toBe(
				"https://hyperscape-api.example",
			);
		});
	});

	test("CARTRIDGE_LAUNCH_URL_HYPERSCAPE wins over Hyperscape legacy envs", () => {
		withEnvOverrides(
			{
				HYPERSCAPE_CLIENT_URL: "http://localhost:3333",
				CARTRIDGE_LAUNCH_URL_HYPERSCAPE: "https://cartridge-hyperscape.example/",
			},
			() => {
				expect(createDefaultAppRegistry().getApp("hyperscape")?.launchUrl).toBe(
					"https://cartridge-hyperscape.example/",
				);
			},
		);
	});

	test("CARTRIDGE_LAUNCH_URL_KINEMA overrides the Kinema launch URL", () => {
		const url = "https://kinema.example/play";
		withEnvOverrides({ CARTRIDGE_LAUNCH_URL_KINEMA: url }, () => {
			expect(createDefaultAppRegistry().getApp("kinema")?.launchUrl).toBe(url);
		});
		expect(createDefaultAppRegistry().getApp("kinema")?.launchUrl).toBe(
			"http://127.0.0.1:5173",
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
		expect(session.manifest.launchUrl).toBe(
			registry.getApp("scape")?.launchUrl ?? null,
		);

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

	test("stores a resolved launch url override on the session manifest", () => {
		const manager = new GameSessionManager(createDefaultAppRegistry());
		const session = manager.startSession({
			appId: "kinema",
			persona: "agent-gamer",
			launchedFrom: "bun-test",
			viewer: "embedded",
			launchUrlOverride: "http://127.0.0.1:5173/?cartridgeBridge=1&spawn=entrance",
		});

		expect(session.manifest.launchUrl).toBe(
			"http://127.0.0.1:5173/?cartridgeBridge=1&spawn=entrance",
		);
	});
});
