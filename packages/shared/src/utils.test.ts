import { describe, expect, test } from "bun:test";

import { cloneItems, formatErrorMessage } from "./utils";

describe("shared utils", () => {
	test("cloneItems returns independent copies", () => {
		const items = [{ value: "one" }, { value: "two" }];
		const cloned = cloneItems(items);

		expect(cloned).toEqual(items);
		expect(cloned).not.toBe(items);
		expect(cloned[0]).not.toBe(items[0]);
	});

	test("formatErrorMessage normalizes error-like values", () => {
		expect(formatErrorMessage(new Error("boom"))).toBe("boom");
		expect(formatErrorMessage("fail")).toBe("fail");
	});
});
