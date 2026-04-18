import { describe, expect, test } from "bun:test";
import type { OperatorCommandPayload } from "@cartridge/shared";

import {
	type BufferedKinemaCommand,
	KINEMA_COMMAND_BUFFER_TIMEOUT_MS,
	enqueueBufferedKinemaCommand,
	expireBufferedKinemaCommands,
	flushBufferedKinemaCommands,
} from "./kinema-command-buffer";

describe("kinema command buffer", () => {
	test("buffers commands with deterministic enqueue timestamps", () => {
		const queue = enqueueBufferedKinemaCommand(
			[],
			{
				commandId: "cmd-1",
				control: "move",
				payload: { moveX: 0, moveY: 1 },
			},
			1250,
		);

		expect(queue).toEqual([
			{
				commandId: "cmd-1",
				control: "move",
				payload: { moveX: 0, moveY: 1 },
				queuedAtMs: 1250,
			},
		]);
	});

	test("flushes commands in order and preserves blocked entries", () => {
		const queue: BufferedKinemaCommand[] = [
			{
				commandId: "cmd-1",
				control: "move",
				payload: { moveX: 0, moveY: 1 } satisfies OperatorCommandPayload,
				queuedAtMs: 100,
			},
			{
				commandId: "cmd-2",
				control: "jump",
				payload: {} satisfies OperatorCommandPayload,
				queuedAtMs: 120,
			},
		];

		const { dispatched, pending } = flushBufferedKinemaCommands(queue, (command) => {
			return command.commandId === "cmd-1";
		});

		expect(dispatched.map((command) => command.commandId)).toEqual(["cmd-1"]);
		expect(pending.map((command) => command.commandId)).toEqual(["cmd-2"]);
	});

	test("expires stale commands once the bridge wait threshold is crossed", () => {
		const queue: BufferedKinemaCommand[] = [
			{
				commandId: "cmd-1",
				control: "move",
				payload: { moveX: 0, moveY: 1 } satisfies OperatorCommandPayload,
				queuedAtMs: 10,
			},
			{
				commandId: "cmd-2",
				control: "jump",
				payload: {} satisfies OperatorCommandPayload,
				queuedAtMs: KINEMA_COMMAND_BUFFER_TIMEOUT_MS - 10,
			},
		];

		const { expired, pending } = expireBufferedKinemaCommands(
			queue,
			KINEMA_COMMAND_BUFFER_TIMEOUT_MS + 50,
		);

		expect(expired.map((command) => command.commandId)).toEqual(["cmd-1"]);
		expect(pending.map((command) => command.commandId)).toEqual(["cmd-2"]);
	});
});
