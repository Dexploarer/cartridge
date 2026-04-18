import type { RuntimeShellState } from "../shared/runtime-shell-state";

export type TabId = "chat" | "apps" | "stream" | "wallet";

type SessionState = Pick<RuntimeShellState, "sessions"> | null;

export function normalizeShellTab(raw: string): TabId {
	const tab = raw === "studio" ? "hub" : raw;
	if (tab === "apps" || tab === "store" || tab === "hub") {
		return "apps";
	}
	if (tab === "stream") {
		return "stream";
	}
	if (tab === "wallet") {
		return "wallet";
	}
	return "chat";
}

export function hasActiveSessionForApp(
	state: SessionState,
	appId: string,
): boolean {
	return state?.sessions.some((session) => session.appId === appId && session.status !== "ended") ?? false;
}

export function shouldShowBabylonWallet(state: SessionState): boolean {
	return hasActiveSessionForApp(state, "babylon");
}
