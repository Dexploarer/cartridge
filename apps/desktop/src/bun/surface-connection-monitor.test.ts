import { describe, expect, test } from "bun:test";

import type { GameAppManifest } from "@cartridge/shared";

import {
	SurfaceConnectionMonitor,
	probeSurfaceConnection,
} from "./surface-connection-monitor";

const REMOTE_SURFACE: GameAppManifest = {
	appId: "scape",
	packageName: "@elizaos/app-scape",
	displayName: "'scape",
	category: "game",
	launchType: "connect",
	launchUrl: "https://scape-client-2sqyc.kinsta.page",
	runtimePlugin: "@elizaos/app-scape",
	summary: "Test surface",
	capabilities: ["autonomy-loop"],
	personas: ["agent-gamer", "dev-gamer", "user-gamer"],
	session: {
		mode: "spectate-and-steer",
		features: ["commands"],
	},
};

const LOCAL_MANAGED_SURFACE: GameAppManifest = {
	appId: "kinema",
	packageName: "kinema",
	displayName: "Kinema",
	category: "game",
	launchType: "connect",
	launchUrl: "http://127.0.0.1:5173",
	runtimePlugin: "kinema",
	summary: "Test surface",
	capabilities: ["third-person"],
	personas: ["agent-gamer", "dev-gamer", "user-gamer"],
	session: {
		mode: "spectate-and-steer",
		features: ["commands"],
	},
};

const LOCAL_URL_SURFACE: GameAppManifest = {
	appId: "babylon",
	packageName: "@elizaos/app-babylon",
	displayName: "Babylon",
	category: "game",
	launchType: "url",
	launchUrl: "http://localhost:3000",
	runtimePlugin: "@elizaos/app-babylon",
	summary: "Test surface",
	capabilities: ["prediction-market"],
	personas: ["agent-gamer", "dev-gamer", "user-gamer"],
	session: {
		mode: "spectate-and-steer",
		features: ["commands"],
	},
};

describe("probeSurfaceConnection", () => {
	test("marks reachable remote surfaces as ready", async () => {
		const result = await probeSurfaceConnection(REMOTE_SURFACE, {
			probeUrl: async (url) => ({
				ok: true,
				detail: `Reachable at ${url}`,
			}),
			nowIso: () => "2026-04-17T12:00:00.000Z",
		});

		expect(result).toMatchObject({
			appId: "scape",
			mode: "remote-url",
			status: "ready",
			checkedAt: "2026-04-17T12:00:00.000Z",
		});
	});

	test("marks local managed surfaces as launchable when the dev server is down", async () => {
		const result = await probeSurfaceConnection(LOCAL_MANAGED_SURFACE, {
			env: {
				CARTRIDGE_SURFACE_DIR_KINEMA: "/tmp/kinema-dev",
			},
			pathExists: (target) => target === "/tmp/kinema-dev",
			probeUrl: async () => ({
				ok: false,
				detail: "connection refused",
			}),
			nowIso: () => "2026-04-17T12:00:00.000Z",
		});

		expect(result).toMatchObject({
			appId: "kinema",
			mode: "local-managed",
			status: "launchable",
			localRepoDir: "/tmp/kinema-dev",
		});
		expect(result.detail).toContain("Cartridge can install, build, and run it on launch");
	});

	test("marks unresolved localhost surfaces as launchable instead of offline", async () => {
		const result = await probeSurfaceConnection(LOCAL_URL_SURFACE, {
			probeUrl: async () => ({
				ok: false,
				detail: "connection refused",
			}),
			nowIso: () => "2026-04-17T12:00:00.000Z",
		});

		expect(result).toMatchObject({
			appId: "babylon",
			mode: "local-url",
			status: "launchable",
		});
		expect(result.detail).toContain("Local service is not reachable");
	});
});

describe("SurfaceConnectionMonitor", () => {
	test("promotes launch lifecycle updates into the cached snapshot", () => {
		const monitor = new SurfaceConnectionMonitor({
			now: () => 10,
			probeUrl: async () => ({
				ok: true,
				detail: "ready",
			}),
		});

		const first = monitor.snapshotFor([LOCAL_MANAGED_SURFACE]);
		expect(first[0]?.status).toBe("checking");

		monitor.noteLaunchStart("kinema", "Preparing Kinema install.");
		const starting = monitor.snapshotFor([LOCAL_MANAGED_SURFACE]);
		expect(starting[0]).toMatchObject({
			status: "starting",
			detail: "Preparing Kinema install.",
		});

		monitor.noteLaunchReady("kinema", "Kinema ready at http://127.0.0.1:5173/");
		const ready = monitor.snapshotFor([LOCAL_MANAGED_SURFACE]);
		expect(ready[0]).toMatchObject({
			status: "ready",
			detail: "Kinema ready at http://127.0.0.1:5173/",
		});
	});
});
