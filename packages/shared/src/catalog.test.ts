import { describe, expect, test } from "bun:test";

import { BRANDING_PROFILE } from "./catalog";

describe("branding catalog", () => {
	test("keeps the cleaned Cartridge branding contract", () => {
		expect(BRANDING_PROFILE.brandId).toBe("cartridge");
		expect(BRANDING_PROFILE.headers.aliases).toEqual({
			"x-cartridge-token": "x-eliza-token",
			"x-cartridge-client-id": "x-eliza-client-id",
			"x-cartridge-cloud-token": "x-eliza-cloud-token",
		});
		expect(Object.hasOwn(BRANDING_PROFILE, "whiteLabel")).toBe(false);
	});
});
