import { describe, expect, test } from "bun:test";

import { TypedEventBus } from "./events";

describe("TypedEventBus", () => {
	test("delivers typed payloads and trims history in order", () => {
		type EventMap = {
			foo: { value: string };
			bar: { count: number };
		};

		const bus = new TypedEventBus<EventMap>(2);
		const seen: Array<string> = [];
		const unsubscribe = bus.subscribe("foo", (payload, envelope) => {
			seen.push(`${envelope.type}:${payload.value}`);
		});

		bus.emit("foo", { value: "one" });
		bus.emit("bar", { count: 1 });
		unsubscribe();
		bus.emit("foo", { value: "two" });

		expect(seen).toEqual(["foo:one"]);
		expect(bus.getHistory().map((event) => event.type)).toEqual(["bar", "foo"]);
	});
});
