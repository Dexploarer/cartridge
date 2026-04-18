import type { OperatorCommandPayload } from "@cartridge/shared";

export const KINEMA_COMMAND_BUFFER_TIMEOUT_MS = 8000;

export type BufferedKinemaCommand = {
	commandId: string;
	control: string;
	payload: OperatorCommandPayload;
	queuedAtMs: number;
};

export function enqueueBufferedKinemaCommand(
	queue: BufferedKinemaCommand[],
	command: {
		commandId: string;
		control: string;
		payload: OperatorCommandPayload;
	},
	nowMs: number = Date.now(),
): BufferedKinemaCommand[] {
	return [
		...queue,
		{
			...command,
			queuedAtMs: nowMs,
		},
	];
}

export function flushBufferedKinemaCommands(
	queue: BufferedKinemaCommand[],
	dispatch: (command: BufferedKinemaCommand) => boolean,
): {
	dispatched: BufferedKinemaCommand[];
	pending: BufferedKinemaCommand[];
} {
	const dispatched: BufferedKinemaCommand[] = [];
	const pending: BufferedKinemaCommand[] = [];

	for (const command of queue) {
		if (dispatch(command)) {
			dispatched.push(command);
			continue;
		}
		pending.push(command);
	}

	return { dispatched, pending };
}

export function expireBufferedKinemaCommands(
	queue: BufferedKinemaCommand[],
	nowMs: number = Date.now(),
	timeoutMs: number = KINEMA_COMMAND_BUFFER_TIMEOUT_MS,
): {
	expired: BufferedKinemaCommand[];
	pending: BufferedKinemaCommand[];
} {
	const expired: BufferedKinemaCommand[] = [];
	const pending: BufferedKinemaCommand[] = [];

	for (const command of queue) {
		if (nowMs - command.queuedAtMs >= timeoutMs) {
			expired.push(command);
			continue;
		}
		pending.push(command);
	}

	return { expired, pending };
}
