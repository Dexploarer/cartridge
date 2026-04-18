import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OnboardingOverlay } from "./onboarding.tsx";
import type { RuntimeShellState } from "../shared/runtime-shell-state";

let root: ReturnType<typeof createRoot> | null = null;
let hostEl: HTMLElement | null = null;
let latestState: RuntimeShellState | null = null;
let dismissed = false;

function renderOverlay(): void {
	if (!root || !hostEl || dismissed) {
		return;
	}
	root.render(
		<StrictMode>
			<OnboardingOverlay state={latestState} onDismiss={dismissOnboarding} />
		</StrictMode>,
	);
}

function dismissOnboarding(): void {
	dismissed = true;
	root?.unmount();
	hostEl?.remove();
	root = null;
	hostEl = null;
}

function ensureRoot(): boolean {
	if (dismissed) {
		return false;
	}
	hostEl ??= document.getElementById("onboarding-root");
	if (!hostEl) {
		return false;
	}
	root ??= createRoot(hostEl);
	return true;
}

export function mountOnboarding(): void {
	if (!ensureRoot()) {
		return;
	}
	renderOverlay();
}

export function updateOnboarding(state: RuntimeShellState): void {
	latestState = state;
	if (!ensureRoot()) {
		return;
	}
	renderOverlay();
}
