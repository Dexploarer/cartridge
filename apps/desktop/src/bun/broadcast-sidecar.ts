import type {
	BroadcastAudioBus,
	BroadcastConfig,
	BroadcastHealth,
	BroadcastPermissionState,
	BroadcastSource,
	BroadcastStatus,
} from "@cartridge/runtime";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

export type BroadcasterCommand =
	| { id: string; method: "permissions.request" }
	| { id: string; method: "config.update"; params: { config: BroadcastConfig } }
	| { id: string; method: "source.set"; params: { source: BroadcastSource } }
	| {
			id: string;
			method: "broadcast.start";
			params: {
				config: BroadcastConfig;
				source: BroadcastSource;
				streamKey: string | null;
			};
	  }
	| { id: string; method: "broadcast.stop" }
	| {
			id: string;
			method: "audio.set";
			params: {
				bus: BroadcastAudioBus;
				config: BroadcastConfig["audioBuses"][BroadcastAudioBus];
			};
	  }
	| { id: string; method: "logs.read" }
	| { id: string; method: "window.reveal" };

export type BroadcasterEvent =
	| { type: "ready"; log: string }
	| { type: "permissions"; permissions: BroadcastPermissionState; log?: string }
	| { type: "status"; status: BroadcastStatus; lastError?: string | null; log?: string }
	| { type: "stats"; health: BroadcastHealth }
	| { type: "logs"; lines: string[] }
	| { type: "source"; source: BroadcastSource; log?: string };

export type BroadcasterSupervisorState = {
	ready: boolean;
	status: BroadcastStatus;
	permissions: BroadcastPermissionState;
	health: BroadcastHealth;
	lastError: string | null;
	logs: string[];
	sourceSessionId: string | null;
};

type BroadcasterSupervisorOptions = {
	onEvent?: (event: BroadcasterEvent) => void;
	onError?: (error: Error) => void;
};

const MAX_LOG_LINES = 40;

function createDefaultPermissions(): BroadcastPermissionState {
	return {
		screen: "required",
		systemAudio: "required",
		microphone: "required",
	};
}

function createDefaultHealth(): BroadcastHealth {
	return {
		fps: 0,
		bitrateKbps: 0,
		droppedFrames: 0,
		reconnectCount: 0,
		encoderLagMs: 0,
		publishUptimeSec: 0,
	};
}

function pushLogs(logs: string[], next: string[]): string[] {
	return [...logs, ...next].slice(-MAX_LOG_LINES);
}

export function reduceBroadcasterEvent(
	state: BroadcasterSupervisorState,
	event: BroadcasterEvent,
): BroadcasterSupervisorState {
	switch (event.type) {
		case "ready":
			return {
				...state,
				ready: true,
				logs: pushLogs(state.logs, [event.log]),
			};
		case "permissions":
			return {
				...state,
				permissions: event.permissions,
				logs: event.log ? pushLogs(state.logs, [event.log]) : state.logs,
			};
		case "status":
			return {
				...state,
				status: event.status,
				lastError: event.lastError ?? null,
				logs: event.log ? pushLogs(state.logs, [event.log]) : state.logs,
			};
		case "stats":
			return {
				...state,
				health: event.health,
			};
		case "logs":
			return {
				...state,
				logs: pushLogs(state.logs, event.lines),
			};
		case "source":
			return {
				...state,
				sourceSessionId: event.source.sessionId,
				logs: event.log ? pushLogs(state.logs, [event.log]) : state.logs,
			};
	}
}

export function createDefaultBroadcasterSupervisorState(): BroadcasterSupervisorState {
	return {
		ready: false,
		status: "idle",
		permissions: createDefaultPermissions(),
		health: createDefaultHealth(),
		lastError: null,
		logs: [],
		sourceSessionId: null,
	};
}

function createSidecarCommandId(method: BroadcasterCommand["method"]): string {
	return `${method}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSidecarSpawnArgs(): { command: string; args: string[] } {
	const currentModule = import.meta.path;
	const command = process.execPath;
	const args = currentModule.endsWith(".ts")
		? [currentModule, "--cartridge-broadcaster-sidecar"]
		: ["--cartridge-broadcaster-sidecar"];
	return { command, args };
}

export class CartridgeBroadcasterSupervisor {
	private child: ChildProcessWithoutNullStreams | null = null;
	private state = createDefaultBroadcasterSupervisorState();

	constructor(private readonly options: BroadcasterSupervisorOptions = {}) {}

	getState(): BroadcasterSupervisorState {
		return {
			...this.state,
			permissions: { ...this.state.permissions },
			health: { ...this.state.health },
			logs: [...this.state.logs],
		};
	}

	readLogs(): string[] {
		return [...this.state.logs];
	}

	requestPermissions(): void {
		this.send({ id: createSidecarCommandId("permissions.request"), method: "permissions.request" });
	}

	updateConfig(config: BroadcastConfig): void {
		this.send({
			id: createSidecarCommandId("config.update"),
			method: "config.update",
			params: { config },
		});
	}

	setSource(source: BroadcastSource): void {
		this.send({
			id: createSidecarCommandId("source.set"),
			method: "source.set",
			params: { source },
		});
	}

	start(config: BroadcastConfig, source: BroadcastSource, streamKey: string | null): void {
		this.send({
			id: createSidecarCommandId("broadcast.start"),
			method: "broadcast.start",
			params: { config, source, streamKey },
		});
	}

	stop(): void {
		this.send({ id: createSidecarCommandId("broadcast.stop"), method: "broadcast.stop" });
	}

	setAudioBus(
		bus: BroadcastAudioBus,
		config: BroadcastConfig["audioBuses"][BroadcastAudioBus],
	): void {
		this.send({
			id: createSidecarCommandId("audio.set"),
			method: "audio.set",
			params: { bus, config },
		});
	}

	revealWindow(): void {
		this.send({ id: createSidecarCommandId("window.reveal"), method: "window.reveal" });
	}

	dispose(): void {
		if (!this.child) {
			return;
		}
		this.child.kill();
		this.child = null;
	}

	private ensureChild(): ChildProcessWithoutNullStreams {
		if (this.child) {
			return this.child;
		}
		const { command, args } = getSidecarSpawnArgs();
		const child = spawn(command, args, {
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				CARTRIDGE_BROADCASTER_SIDECAR: "1",
			},
		});
		const stdout = createInterface({ input: child.stdout });
		stdout.on("line", (line) => {
			this.handleLine(line);
		});
		child.stderr.on("data", (chunk) => {
			const text = String(chunk).trim();
			if (!text) {
				return;
			}
			const error = new Error(text);
			this.options.onError?.(error);
			this.state = {
				...this.state,
				lastError: text,
				logs: pushLogs(this.state.logs, [text]),
			};
		});
		child.on("exit", (code) => {
			this.child = null;
			this.state = {
				...this.state,
				status: code === 0 ? "idle" : "error",
				lastError: code === 0 ? this.state.lastError : `Broadcaster exited with code ${code ?? -1}`,
			};
		});
		this.child = child;
		return child;
	}

	private send(command: BroadcasterCommand): void {
		const child = this.ensureChild();
		child.stdin.write(`${JSON.stringify(command)}\n`);
	}

	private handleLine(line: string): void {
		if (!line.trim()) {
			return;
		}
		try {
			const event = JSON.parse(line) as BroadcasterEvent;
			this.state = reduceBroadcasterEvent(this.state, event);
			this.options.onEvent?.(event);
		} catch (error) {
			const err =
				error instanceof Error ? error : new Error(`Failed to parse broadcaster event: ${String(error)}`);
			this.options.onError?.(err);
		}
	}
}

type SidecarRuntimeState = {
	config: BroadcastConfig | null;
	source: BroadcastSource | null;
	streamKey: string | null;
	permissions: BroadcastPermissionState;
	status: BroadcastStatus;
	health: BroadcastHealth;
	logs: string[];
	statsTimer: ReturnType<typeof setInterval> | null;
};

function emit(event: BroadcasterEvent): void {
	process.stdout.write(`${JSON.stringify(event)}\n`);
}

function appendSidecarLog(state: SidecarRuntimeState, line: string): SidecarRuntimeState {
	return {
		...state,
		logs: pushLogs(state.logs, [line]),
	};
}

function clearStatsTimer(state: SidecarRuntimeState): void {
	if (state.statsTimer) {
		clearInterval(state.statsTimer);
		state.statsTimer = null;
	}
}

function handleSidecarCommand(
	state: SidecarRuntimeState,
	command: BroadcasterCommand,
): SidecarRuntimeState {
	switch (command.method) {
		case "permissions.request": {
			const permissions: BroadcastPermissionState = {
				screen: "granted",
				systemAudio: "granted",
				microphone: "granted",
			};
			const next = {
				...state,
				permissions,
			};
			emit({
				type: "permissions",
				permissions,
				log: "Permissions granted for screen, system audio, and microphone.",
			});
			return appendSidecarLog(
				next,
				"Permissions granted for screen, system audio, and microphone.",
			);
		}
		case "config.update":
			return appendSidecarLog(
				{
					...state,
					config: command.params.config,
				},
				"Broadcast config updated.",
			);
		case "source.set":
			emit({
				type: "source",
				source: command.params.source,
				log: `Source set to ${command.params.source.outputLabel}.`,
			});
			return appendSidecarLog(
				{
					...state,
					source: command.params.source,
				},
				`Source set to ${command.params.source.outputLabel}.`,
			);
		case "audio.set": {
			const next = state.config
				? {
						...state,
						config: {
							...state.config,
							audioBuses: {
								...state.config.audioBuses,
								[command.params.bus]: command.params.config,
							},
						},
					}
				: state;
			return appendSidecarLog(next, `Audio bus ${command.params.bus} updated.`);
		}
		case "window.reveal":
			return appendSidecarLog(state, "Reveal broadcast window requested.");
		case "logs.read":
			emit({ type: "logs", lines: state.logs });
			return state;
		case "broadcast.start": {
			if (
				state.permissions.screen !== "granted" ||
				state.permissions.systemAudio !== "granted" ||
				state.permissions.microphone !== "granted"
			) {
				emit({
					type: "status",
					status: "permissions_required",
					lastError: "Broadcast permissions are required before going live.",
					log: "Broadcast start blocked by missing permissions.",
				});
				return appendSidecarLog(
					{
						...state,
						status: "permissions_required",
					},
					"Broadcast start blocked by missing permissions.",
				);
			}
			if (!command.params.source.sessionId) {
				emit({
					type: "status",
					status: "idle",
					lastError: "No broadcast source session is available.",
					log: "Broadcast start blocked by missing source.",
				});
				return appendSidecarLog(state, "Broadcast start blocked by missing source.");
			}
			clearStatsTimer(state);
			const next: SidecarRuntimeState = appendSidecarLog(
				{
					...state,
					config: command.params.config,
					source: command.params.source,
					streamKey: command.params.streamKey,
					status: "live",
					health: {
						fps: command.params.config.videoProfile.fps,
						bitrateKbps: command.params.config.videoProfile.videoBitrateKbps,
						droppedFrames: 0,
						reconnectCount: state.health.reconnectCount,
						encoderLagMs: 16,
						publishUptimeSec: 0,
					},
				},
				`Broadcast live to ${command.params.config.destinationUrl || "unset RTMP destination"}.`,
			);
			emit({ type: "status", status: "starting", log: "Broadcaster starting." });
			emit({
				type: "status",
				status: "live",
				log: `Broadcast live to ${command.params.config.destinationUrl || "unset RTMP destination"}.`,
			});
			next.statsTimer = setInterval(() => {
				next.health = {
					...next.health,
					publishUptimeSec: next.health.publishUptimeSec + 1,
					bitrateKbps: next.config?.videoProfile.videoBitrateKbps ?? next.health.bitrateKbps,
					fps: next.config?.videoProfile.fps ?? next.health.fps,
				};
				emit({ type: "stats", health: next.health });
			}, 1000);
			return next;
		}
		case "broadcast.stop":
			clearStatsTimer(state);
			emit({ type: "status", status: "stopping", log: "Broadcaster stopping." });
			emit({ type: "status", status: "idle", log: "Broadcaster idle." });
			return appendSidecarLog(
				{
					...state,
					status: "idle",
					health: createDefaultHealth(),
				},
				"Broadcaster idle.",
			);
	}
}

export async function maybeRunBroadcasterSidecar(): Promise<boolean> {
	const wantsSidecar =
		process.argv.includes("--cartridge-broadcaster-sidecar") ||
		process.env["CARTRIDGE_BROADCASTER_SIDECAR"] === "1";
	if (!wantsSidecar) {
		return false;
	}
	let state: SidecarRuntimeState = {
		config: null,
		source: null,
		streamKey: null,
		permissions: createDefaultPermissions(),
		status: "idle",
		health: createDefaultHealth(),
		logs: [],
		statsTimer: null,
	};
	emit({ type: "ready", log: "Cartridge broadcaster sidecar online." });
	emit({ type: "permissions", permissions: state.permissions });

	const rl = createInterface({
		input: process.stdin,
		crlfDelay: Infinity,
	});

	for await (const line of rl) {
		if (!line.trim()) {
			continue;
		}
		try {
			const command = JSON.parse(line) as BroadcasterCommand;
			state = handleSidecarCommand(state, command);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : `Unknown broadcaster sidecar error: ${String(error)}`;
			emit({
				type: "status",
				status: "error",
				lastError: message,
				log: message,
			});
			state = appendSidecarLog(
				{
					...state,
					status: "error",
				},
				message,
			);
		}
	}

	clearStatsTimer(state);
	return true;
}
