import type { WorkspaceViewDescriptor } from "@cartridge/shared";

export type WorkspacePaneState = {
	split: boolean;
	agentView: WorkspaceViewDescriptor;
	userView: WorkspaceViewDescriptor | null;
};

export function buildWorkspacePaneState(input: {
	agentView: WorkspaceViewDescriptor;
	userView?: WorkspaceViewDescriptor | null;
}): WorkspacePaneState {
	return {
		split: Boolean(input.userView),
		agentView: input.agentView,
		userView: input.userView ?? null,
	};
}
