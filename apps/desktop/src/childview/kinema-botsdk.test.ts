import { describe, expect, test } from "bun:test";

import {
	buildKinemaTelemetryFrames,
	parseKinemaChatCommand,
} from "./kinema-botsdk";

describe("kinema botsdk helper", () => {
	test("builds telemetry frames from a bridge snapshot", () => {
		const frames = buildKinemaTelemetryFrames({
			ready: true,
			run: {
				kind: "procedural",
				reviewSpawnKey: "entrance",
				stationKey: null,
			},
			player: {
				position: { x: 1.25, y: 2.5, z: -3.75 },
				velocity: { x: 0, y: 0, z: 0 },
				isGrounded: true,
				state: "idle",
				verticalVelocity: 0,
			},
			render: {
				graphicsProfile: "balanced",
				rendererBackend: "webgpu",
				advancedFx: true,
			},
			editor: {
				active: false,
			},
		});

		expect(frames).toHaveLength(3);
		expect(frames[0]).toMatchObject({
			panel: "player-state",
			label: "Player",
			value: "idle · grounded · 1.3, 2.5, -3.8",
		});
		expect(frames[1]).toMatchObject({
			panel: "render-state",
			label: "Renderer",
			value: "balanced · webgpu · advanced fx",
		});
		expect(frames[2]).toMatchObject({
			panel: "editor-state",
			label: "Run",
			value: "procedural · entrance · editor hidden",
		});
	});

	test("parses movement shortcuts into structured control payloads", () => {
		expect(parseKinemaChatCommand("/move forward 18")).toEqual({
			control: "move",
			payload: {
				moveX: 0,
				moveY: 1,
				frames: 18,
			},
			note: "Kinema forward input burst",
		});

		expect(parseKinemaChatCommand("/move -1 0 24")).toEqual({
			control: "move",
			payload: {
				moveX: -1,
				moveY: 0,
				frames: 24,
			},
			note: "Kinema movement input burst",
		});
	});

	test("parses high-level run controls", () => {
		expect(parseKinemaChatCommand("/play entrance")).toEqual({
			control: "start-procedural-run",
			payload: {
				spawn: "entrance",
			},
			note: "Start Kinema procedural run at entrance",
		});
		expect(parseKinemaChatCommand("/station vehicles")).toEqual({
			control: "jump-to-station",
			payload: {
				station: "vehicles",
			},
			note: "Jump Kinema to station vehicles",
		});
		expect(parseKinemaChatCommand("/jump")).toEqual({
			control: "jump",
			payload: {},
			note: "Trigger Kinema jump input",
		});
		expect(parseKinemaChatCommand("/graphics")).toEqual({
			control: "toggle-render-path",
			payload: {},
			note: "Cycle Kinema graphics profile",
		});
	});
});
