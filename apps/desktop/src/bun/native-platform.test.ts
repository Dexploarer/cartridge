import { describe, expect, test } from "bun:test";

import { summarizeForFeed } from "./feed-summary";

describe("summarizeForFeed", () => {
	test("summarizes the nested data payload directly", () => {
		expect(
			summarizeForFeed({
				data: {
					action: "surface-open",
					appId: "babylon",
				},
			}),
		).toBe('{"action":"surface-open","appId":"babylon"}');
	});

	test("truncates long payloads deterministically", () => {
		const summary = summarizeForFeed(
			{
				data: {
					message: "x".repeat(120),
				},
			},
			32,
		);

		expect(summary.endsWith("…")).toBe(true);
		expect(summary.length).toBe(33);
		expect(summary.startsWith('{"message":"')).toBe(true);
	});
});
