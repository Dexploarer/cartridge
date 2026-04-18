import { describe, expect, it } from "bun:test";

import {
	hasActiveSessionForApp,
	normalizeShellTab,
	shouldShowBabylonWallet,
} from "./shell-navigation";

describe("normalizeShellTab", () => {
	it("maps known shell routes onto first-class tabs", () => {
		expect(normalizeShellTab("chat")).toBe("chat");
		expect(normalizeShellTab("apps")).toBe("apps");
		expect(normalizeShellTab("store")).toBe("apps");
		expect(normalizeShellTab("hub")).toBe("apps");
		expect(normalizeShellTab("studio")).toBe("apps");
		expect(normalizeShellTab("stream")).toBe("stream");
		expect(normalizeShellTab("wallet")).toBe("wallet");
	});

	it("falls back to chat for unknown tabs", () => {
		expect(normalizeShellTab("unknown")).toBe("chat");
	});
});

describe("wallet session visibility", () => {
	it("treats only non-ended sessions as active", () => {
		const state = {
			sessions: [
				{ appId: "babylon", status: "running" },
				{ appId: "scape", status: "ended" },
			],
		} as any;

		expect(hasActiveSessionForApp(state, "babylon")).toBe(true);
		expect(hasActiveSessionForApp(state, "scape")).toBe(false);
	});

	it("shows Babylon wallet tools only when Babylon is live", () => {
		expect(
			shouldShowBabylonWallet({
				sessions: [{ appId: "babylon", status: "ready" }],
			} as any),
		).toBe(true);
		expect(
			shouldShowBabylonWallet({
				sessions: [{ appId: "babylon", status: "ended" }],
			} as any),
		).toBe(false);
		expect(
			shouldShowBabylonWallet({
				sessions: [{ appId: "scape", status: "running" }],
			} as any),
		).toBe(false);
		expect(shouldShowBabylonWallet(null)).toBe(false);
	});
});
