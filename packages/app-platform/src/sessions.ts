import type {
	AppendTelemetryInput,
	EnqueueCommandInput,
	GameAppManifest,
	GameSessionRecord,
	OperatorCommand,
	OperatorSurfaceSpec,
	PlatformEventSink,
	ResolveCommandInput,
	SessionLaunchInput,
	SessionViewer,
	TelemetryFrame,
} from "@cartridge/shared";
import { appendTrimmedHistory, clone, createId, isoNow } from "@cartridge/shared";

import type { AppRegistry } from "./registry";

const MAX_QUEUE_HISTORY = 24;
const MAX_TELEMETRY_HISTORY = 40;
const MAX_NOTES_HISTORY = 20;

export type SessionManagerStrategies = {
	defaultViewerForApp?: (app: GameAppManifest) => SessionViewer;
	createInitialTelemetry?: (
		appId: string,
		operatorSurface: OperatorSurfaceSpec | null,
	) => TelemetryFrame[];
	createSuggestions?: (
		app: GameAppManifest,
		operatorSurface: OperatorSurfaceSpec | null,
		suggestionSeed?: string[],
	) => string[];
};

function defaultViewerForApp(app: GameAppManifest): SessionViewer {
	if (app.launchType === "native-window") {
		return "native-window";
	}

	if (app.launchType === "url") {
		return "external";
	}

	return "embedded";
}

function appendSessionNote(notes: string[], note: string): string[] {
	return appendTrimmedHistory(notes, [note], MAX_NOTES_HISTORY);
}

function createInitialTelemetry(
	appId: string,
	operatorSurface: OperatorSurfaceSpec | null,
): TelemetryFrame[] {
	const panels = operatorSurface?.telemetryPanels ?? ["session-state"];
	return panels.map((panel) => ({
		frameId: createId("frame"),
		panel,
		label: panel,
		value: `${appId} awaiting live telemetry`,
		severity: "info",
		source: "session-manager",
		recordedAt: isoNow(),
	}));
}

function createSuggestions(
	app: GameAppManifest,
	operatorSurface: OperatorSurfaceSpec | null,
	suggestionSeed?: string[],
): string[] {
	if (suggestionSeed && suggestionSeed.length > 0) {
		return suggestionSeed;
	}

	const firstControl = operatorSurface?.controls[0];
	const firstPanel = operatorSurface?.telemetryPanels[0];

	return [
		firstControl
			? `Run ${firstControl} when the session settles`
			: `Review ${app.displayName} launch state`,
		firstPanel
			? `Watch ${firstPanel} for the first meaningful signal`
			: `Validate ${app.displayName} capability handoff`,
		`Record operator notes for ${app.displayName}`,
	];
}

export class GameSessionManager {
	private readonly sessions = new Map<string, GameSessionRecord>();

	constructor(
		private readonly registry: Pick<AppRegistry, "getApp" | "getOperatorSurface">,
		private readonly publish?: PlatformEventSink,
		private readonly strategies: SessionManagerStrategies = {},
	) {}

	startSession(input: SessionLaunchInput): GameSessionRecord {
		const app = this.registry.getApp(input.appId);
		if (!app) {
			throw new Error(`Unknown app session target: ${input.appId}`);
		}

		const operatorSurface = this.registry.getOperatorSurface(input.appId);
		const now = isoNow();
		const session: GameSessionRecord = {
			sessionId: createId("session"),
			appId: app.appId,
			displayName: app.displayName,
			persona: input.persona,
			status: "active",
			mode: app.session.mode,
			viewer:
				input.viewer ??
				this.strategies.defaultViewerForApp?.(app) ??
				defaultViewerForApp(app),
			launchedFrom: input.launchedFrom,
			startedAt: now,
			updatedAt: now,
			commandQueue: [],
			telemetry:
				this.strategies.createInitialTelemetry?.(app.appId, operatorSurface) ??
				createInitialTelemetry(app.appId, operatorSurface),
			suggestions:
				this.strategies.createSuggestions?.(
					app,
					operatorSurface,
					input.suggestionSeed,
				) ?? createSuggestions(app, operatorSurface, input.suggestionSeed),
			notes: [`Session created from ${input.launchedFrom} for ${input.persona}`],
			manifest: {
				launchType: app.launchType,
				capabilities: [...app.capabilities],
				packageName: app.packageName,
			},
		};

		this.sessions.set(session.sessionId, session);
		this.publish?.({ type: "app.session.started", payload: clone(session) });
		return clone(session);
	}

	listSessions(): GameSessionRecord[] {
		return [...this.sessions.values()]
			.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
			.map((session) => clone(session));
	}

	listActiveSessions(): GameSessionRecord[] {
		return this.listSessions().filter(
			(session) => session.status === "active" || session.status === "paused",
		);
	}

	getSession(sessionId: string): GameSessionRecord | null {
		const session = this.sessions.get(sessionId);
		return session ? clone(session) : null;
	}

	appendTelemetry(
		sessionId: string,
		frames: AppendTelemetryInput,
	): GameSessionRecord {
		return this.mutateSession(sessionId, (session) => {
			const telemetry = frames.map((frame) => ({
				...frame,
				frameId: createId("frame"),
				recordedAt: isoNow(),
			}));

			session.telemetry = appendTrimmedHistory(
				session.telemetry,
				telemetry,
				MAX_TELEMETRY_HISTORY,
			);

			for (const frame of telemetry) {
				this.publish?.({
					type: "telemetry.frame.received",
					payload: { sessionId, appId: session.appId, frame: clone(frame) },
				});
			}
		});
	}

	enqueueCommand(
		sessionId: string,
		input: EnqueueCommandInput,
	): OperatorCommand {
		const session = this.requireSession(sessionId);
		const operatorSurface = this.registry.getOperatorSurface(session.appId);

		if (
			operatorSurface &&
			operatorSurface.controls.length > 0 &&
			!operatorSurface.controls.includes(input.control)
		) {
			throw new Error(
				`Unsupported operator control "${input.control}" for ${session.appId}`,
			);
		}

		const command: OperatorCommand = {
			commandId: createId("command"),
			control: input.control,
			payload: input.payload ?? {},
			status: "queued",
			enqueuedAt: isoNow(),
			resolvedAt: null,
			result: null,
		};

		this.mutateSession(sessionId, (draft) => {
			draft.commandQueue = appendTrimmedHistory(
				draft.commandQueue,
				[command],
				MAX_QUEUE_HISTORY,
			);
			if (input.note) {
				draft.notes = appendSessionNote(draft.notes, input.note);
			}
		});

		this.publish?.({
			type: "operator.command.enqueued",
			payload: { sessionId, appId: session.appId, command: clone(command) },
		});

		return clone(command);
	}

	resolveCommand(
		sessionId: string,
		input: ResolveCommandInput,
	): GameSessionRecord {
		return this.mutateSession(sessionId, (session) => {
			const command = session.commandQueue.find(
				(entry) => entry.commandId === input.commandId,
			);
			if (!command) {
				throw new Error(`Unknown command: ${input.commandId}`);
			}

			command.status = input.status;
			command.resolvedAt = isoNow();
			command.result = input.result ?? null;

			this.publish?.({
				type: "operator.command.executed",
				payload: {
					sessionId,
					appId: session.appId,
					command: clone(command),
				},
			});
		});
	}

	pauseSession(sessionId: string, note?: string): GameSessionRecord {
		const session = this.requireSession(sessionId);
		const operatorSurface = this.registry.getOperatorSurface(session.appId);

		if (!operatorSurface?.supportsPauseResume) {
			throw new Error(`Pause is not supported for ${session.appId}`);
		}

		return this.mutateSession(sessionId, (draft) => {
			draft.status = "paused";
			if (note) {
				draft.notes = appendSessionNote(draft.notes, note);
			}
		});
	}

	resumeSession(sessionId: string, note?: string): GameSessionRecord {
		return this.mutateSession(sessionId, (draft) => {
			draft.status = "active";
			if (note) {
				draft.notes = appendSessionNote(draft.notes, note);
			}
		});
	}

	addSessionNote(sessionId: string, note: string): GameSessionRecord {
		return this.mutateSession(sessionId, (draft) => {
			draft.notes = appendSessionNote(draft.notes, note);
		});
	}

	endSession(sessionId: string, note?: string): GameSessionRecord {
		const ended = this.mutateSession(sessionId, (draft) => {
			draft.status = "ended";
			if (note) {
				draft.notes = appendSessionNote(draft.notes, note);
			}
		});

		this.publish?.({ type: "app.session.ended", payload: clone(ended) });
		return ended;
	}

	private mutateSession(
		sessionId: string,
		mutator: (session: GameSessionRecord) => void,
	): GameSessionRecord {
		const session = this.requireSession(sessionId);
		mutator(session);
		session.updatedAt = isoNow();
		this.sessions.set(sessionId, session);
		this.publish?.({ type: "app.session.updated", payload: clone(session) });
		return clone(session);
	}

	private requireSession(sessionId: string): GameSessionRecord {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Unknown session: ${sessionId}`);
		}

		return session;
	}
}
