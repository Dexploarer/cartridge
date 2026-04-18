import type {
	AppendTelemetryInput,
	OperatorCommandPayload,
} from "@cartridge/shared";

type KinemaVector3 = {
	x: number;
	y: number;
	z: number;
};

type KinemaPlayerSnapshot = {
	position: KinemaVector3;
	velocity: KinemaVector3;
	isGrounded: boolean;
	state: string;
	verticalVelocity: number;
};

type KinemaRunSnapshot = {
	kind: string | null;
	reviewSpawnKey: string | null;
	stationKey: string | null;
};

type KinemaRenderSnapshot = {
	graphicsProfile: string;
	rendererBackend: string;
	advancedFx: boolean;
};

type KinemaEditorSnapshot = {
	active: boolean;
};

export type KinemaBridgeSnapshot = {
	ready: boolean;
	run: KinemaRunSnapshot;
	player: KinemaPlayerSnapshot | null;
	render: KinemaRenderSnapshot | null;
	editor: KinemaEditorSnapshot | null;
};

export type ParsedKinemaChatCommand = {
	control: string;
	payload: OperatorCommandPayload;
	note: string;
};

function fixed(value: number): string {
	return value.toFixed(1);
}

function parseNumber(raw: string | undefined): number | null {
	if (!raw) {
		return null;
	}
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDirectionPayload(
	direction: string,
	framesRaw: string | undefined,
): ParsedKinemaChatCommand | null {
	const frames = parseNumber(framesRaw) ?? 30;
	const normalized = direction.toLowerCase();
	const vectors: Record<string, { moveX: number; moveY: number; note: string }> = {
		forward: { moveX: 0, moveY: 1, note: "Kinema forward input burst" },
		backward: { moveX: 0, moveY: -1, note: "Kinema backward input burst" },
		left: { moveX: -1, moveY: 0, note: "Kinema strafe-left input burst" },
		right: { moveX: 1, moveY: 0, note: "Kinema strafe-right input burst" },
	};
	const vector = vectors[normalized];
	if (!vector) {
		return null;
	}
	return {
		control: "move",
		payload: {
			moveX: vector.moveX,
			moveY: vector.moveY,
			frames,
		},
		note: vector.note,
	};
}

export function buildKinemaTelemetryFrames(
	snapshot: KinemaBridgeSnapshot,
): AppendTelemetryInput {
	const player = snapshot.player
		? `${snapshot.player.state} · ${snapshot.player.isGrounded ? "grounded" : "air"} · ${fixed(snapshot.player.position.x)}, ${fixed(snapshot.player.position.y)}, ${fixed(snapshot.player.position.z)}`
		: "Kinema bridge waiting for player state";
	const render = snapshot.render
		? `${snapshot.render.graphicsProfile} · ${snapshot.render.rendererBackend} · ${snapshot.render.advancedFx ? "advanced fx" : "compat fx"}`
		: "Kinema bridge waiting for renderer state";
	const runParts = [
		snapshot.run.kind ?? "menu",
		snapshot.run.reviewSpawnKey ?? snapshot.run.stationKey ?? "no-spawn",
		snapshot.editor?.active ? "editor active" : "editor hidden",
	];

	return [
		{
			panel: "player-state",
			label: "Player",
			value: player,
			severity: "info",
			source: "kinema-botsdk",
		},
		{
			panel: "render-state",
			label: "Renderer",
			value: render,
			severity: "info",
			source: "kinema-botsdk",
		},
		{
			panel: "editor-state",
			label: "Run",
			value: runParts.join(" · "),
			severity: "info",
			source: "kinema-botsdk",
		},
	];
}

export function parseKinemaChatCommand(
	message: string,
): ParsedKinemaChatCommand | null {
	const trimmed = message.trim();
	if (!trimmed.startsWith("/")) {
		return null;
	}

	const [rawCommand, ...args] = trimmed.slice(1).split(/\s+/);
	const command = rawCommand.toLowerCase();

	switch (command) {
		case "play":
		case "run":
			return {
				control: "start-procedural-run",
				payload: args[0] ? { spawn: args[0] } : {},
				note: args[0]
					? `Start Kinema procedural run at ${args[0]}`
					: "Start Kinema procedural run",
			};
		case "station":
		case "spawn":
			if (!args[0]) {
				return null;
			}
			return {
				control: "jump-to-station",
				payload: { station: args[0] },
				note: `Jump Kinema to station ${args[0]}`,
			};
		case "move":
		case "walk": {
			if (!args[0]) {
				return null;
			}
			const directional = normalizeDirectionPayload(args[0], args[1]);
			if (directional) {
				return directional;
			}
			const moveX = parseNumber(args[0]);
			const moveY = parseNumber(args[1]);
			if (moveX === null || moveY === null) {
				return null;
			}
			return {
				control: "move",
				payload: {
					moveX,
					moveY,
					frames: parseNumber(args[2]) ?? 30,
				},
				note: "Kinema movement input burst",
			};
		}
		case "look": {
			const pitch = parseNumber(args[0]);
			const yaw = parseNumber(args[1]);
			if (pitch === null || yaw === null) {
				return null;
			}
			return {
				control: "look",
				payload: { pitch, yaw },
				note: `Set Kinema camera look to pitch ${pitch}, yaw ${yaw}`,
			};
		}
		case "jump":
			return {
				control: "jump",
				payload: {},
				note: "Trigger Kinema jump input",
			};
		case "interact":
		case "use":
			return {
				control: "interact",
				payload: { frames: parseNumber(args[0]) ?? 210 },
				note: "Trigger Kinema interact input",
			};
		case "editor":
			return {
				control: "toggle-editor",
				payload: {},
				note: "Toggle Kinema editor",
			};
		case "graphics":
		case "render":
			return {
				control: "toggle-render-path",
				payload: {},
				note: "Cycle Kinema graphics profile",
			};
		case "reset":
		case "restart":
			return {
				control: "reset-run",
				payload: {},
				note: "Restart Kinema run",
			};
		default:
			return null;
	}
}
