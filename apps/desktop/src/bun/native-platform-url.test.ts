import { describe, expect, test } from "bun:test";

import { isAllowedExternalUrl } from "./url-allowlist";

const CASES: Array<[string, boolean]> = [
	["https://example.com", true],
	["HTTP://localhost:3000", true],
	["mailto:support@example.com", true],
	["cartridge://open?tab=apps", true],
	["javascript:alert(1)", false],
	["file:///etc/passwd", false],
	["not a url", false],
];

describe("isAllowedExternalUrl", () => {
	for (const [url, expected] of CASES) {
		test(`returns ${expected} for ${url}`, () => {
			expect(isAllowedExternalUrl(url)).toBe(expected);
		});
	}
});
