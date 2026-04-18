import { describe, expect, test } from "bun:test";

import {
	getLocalSurfaceDevConfig,
	getSurfaceWorkspaceVisualFitMode,
	resolveLocalSurfaceLaunch,
	resolveLocalSurfaceRepoDir,
} from "./local-surface-config";

describe("local surface config", () => {
	test("defines Kinema as a locally managed dev surface", () => {
		const config = getLocalSurfaceDevConfig("kinema");

		expect(config).not.toBeNull();
		expect(config?.repoUrl).toBe("https://github.com/Dexploarer/Kinema.git");
		expect(config?.readyUrl).toBe("http://127.0.0.1:5173/");
		expect(config?.install).toEqual({
			command: "npm",
			args: ["ci"],
		});
		expect(config?.build).toEqual({
			command: "npm",
			args: ["run", "build"],
		});
		expect(config?.dev).toEqual({
			command: "npm",
			args: ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
		});
		expect(config?.bridgeSearchParams).toEqual({
			cartridgeBridge: "1",
		});
		expect(config?.botSdkBootstrap).toEqual({
			personas: ["agent-gamer"],
			searchParams: {
				spawn: "entrance",
			},
			sessionNote:
				"BotSDK bootstrap entered the procedural demo at the corridor entrance, matching the main-menu Play flow.",
		});
	});

	test("prefers the explicit env override for local surface repo dirs", () => {
		const config = getLocalSurfaceDevConfig("kinema");
		expect(config).not.toBeNull();

		expect(
			resolveLocalSurfaceRepoDir(config!, {
				CARTRIDGE_SURFACE_DIR_KINEMA: "/tmp/kinema-dev",
			}),
		).toBe("/tmp/kinema-dev");
	});

	test("uses top-band workspace fit for scape and kinema only", () => {
		expect(getSurfaceWorkspaceVisualFitMode("scape")).toBe("topBand");
		expect(getSurfaceWorkspaceVisualFitMode("kinema")).toBe("topBand");
		expect(getSurfaceWorkspaceVisualFitMode("babylon")).toBe("none");
	});

	test("adds the Kinema bootstrap launch params for agent sessions", () => {
		const resolved = resolveLocalSurfaceLaunch(
			"kinema",
			"agent-gamer",
			"http://127.0.0.1:5173",
		);

		expect(resolved.embedUrl).toBe(
			"http://127.0.0.1:5173/?cartridgeBridge=1&spawn=entrance",
		);
		expect(resolved.sessionNote).toContain("BotSDK bootstrap");
	});

	test("adds only the Kinema bridge param for non-agent launches", () => {
		const resolved = resolveLocalSurfaceLaunch(
			"kinema",
			"user-gamer",
			"http://127.0.0.1:5173",
		);

		expect(resolved).toEqual({
			embedUrl: "http://127.0.0.1:5173/?cartridgeBridge=1",
			sessionNote: null,
		});
	});

	test("preserves explicit Kinema bootstrap params from the base launch url", () => {
		const resolved = resolveLocalSurfaceLaunch(
			"kinema",
			"agent-gamer",
			"http://127.0.0.1:5173/?spawn=throw",
		);

		expect(resolved.embedUrl).toBe(
			"http://127.0.0.1:5173/?spawn=throw&cartridgeBridge=1",
		);
		expect(resolved.sessionNote).toContain("main-menu Play flow");
	});

	test("adds Babylon embedded mode for hosted workspace launches", () => {
		const resolved = resolveLocalSurfaceLaunch(
			"babylon",
			"agent-gamer",
			"https://staging.babylon.market",
		);

		expect(resolved).toEqual({
			embedUrl: "https://staging.babylon.market/?embedded=true",
			sessionNote: null,
		});
	});
});
