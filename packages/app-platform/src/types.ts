import type {
	GameAppManifest,
	Persona,
	SessionMode,
	SessionViewer,
} from "@cartridge/shared";

export type { SessionViewer } from "@cartridge/shared";

export type SessionStatus = "launching" | "active" | "paused" | "ended" | "error";

export type TelemetrySeverity = "info" | "warning" | "critical";

export type OperatorCommandStatus = "queued" | "executed" | "failed";

export type OperatorCommandPayload = Record<
	string,
	string | number | boolean | null
>;

export type TelemetryFrame = {
	frameId: string;
	panel: string;
	label: string;
	value: string;
	severity: TelemetrySeverity;
	source: string;
	recordedAt: string;
};

export type OperatorCommand = {
	commandId: string;
	control: string;
	payload: OperatorCommandPayload;
	status: OperatorCommandStatus;
	enqueuedAt: string;
	resolvedAt: string | null;
	result: string | null;
};

export type GameSessionRecord = {
	sessionId: string;
	appId: string;
	displayName: string;
	persona: Persona;
	status: SessionStatus;
	mode: SessionMode;
	viewer: SessionViewer;
	launchedFrom: string;
	startedAt: string;
	updatedAt: string;
	commandQueue: OperatorCommand[];
	telemetry: TelemetryFrame[];
	suggestions: string[];
	notes: string[];
	manifest: Pick<GameAppManifest, "launchType" | "capabilities" | "packageName">;
};

export type AppendTelemetryInput = Array<
	Omit<TelemetryFrame, "frameId" | "recordedAt">
>;

export type EnqueueCommandInput = {
	control: string;
	payload?: OperatorCommandPayload;
	note?: string;
};

export type ResolveCommandInput = {
	commandId: string;
	status: Exclude<OperatorCommandStatus, "queued">;
	result?: string;
};

export type PlatformEventMap = {
	"app.session.started": GameSessionRecord;
	"app.session.updated": GameSessionRecord;
	"app.session.ended": GameSessionRecord;
	"operator.command.enqueued": {
		sessionId: string;
		appId: string;
		command: OperatorCommand;
	};
	"operator.command.executed": {
		sessionId: string;
		appId: string;
		command: OperatorCommand;
	};
	"telemetry.frame.received": {
		sessionId: string;
		appId: string;
		frame: TelemetryFrame;
	};
};

export type PlatformEventEnvelope<
	K extends keyof PlatformEventMap = keyof PlatformEventMap,
> = {
	type: K;
	payload: PlatformEventMap[K];
};

export type PlatformEventSink = <K extends keyof PlatformEventMap>(
	event: PlatformEventEnvelope<K>,
) => void;
