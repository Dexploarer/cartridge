import { describe, expect, test } from "bun:test";

import type { WorkspaceViewDescriptor } from "@cartridge/shared";

import { buildWorkspacePaneState } from "./workspace-view-state";

function makeView(
	role: WorkspaceViewDescriptor["role"],
	controlMode: WorkspaceViewDescriptor["controlMode"],
	url: string,
): WorkspaceViewDescriptor {
	return {
		role,
		label: `${role} view`,
		url,
		controlMode,
		capturePriority: role === "agent" ? "primary" : "secondary",
	};
}

describe("buildWorkspacePaneState", () => {
	test("renders distinct agent and user pane descriptors for split play", () => {
		const state = buildWorkspacePaneState({
			agentView: makeView("agent", "agent-controlled", "https://agent.example"),
			userView: makeView("user", "user-controlled", "https://user.example"),
		});

		expect(state.split).toBe(true);
		expect(state.agentView.url).toBe("https://agent.example");
		expect(state.userView?.url).toBe("https://user.example");
		expect(state.userView?.controlMode).toBe("user-controlled");
	});

	test("degrades explicitly to a single-pane workspace when no safe user view exists", () => {
		const state = buildWorkspacePaneState({
			agentView: makeView("agent", "watch-only", "https://watch.example"),
		});

		expect(state.split).toBe(false);
		expect(state.agentView.controlMode).toBe("watch-only");
		expect(state.userView).toBeNull();
	});
});
