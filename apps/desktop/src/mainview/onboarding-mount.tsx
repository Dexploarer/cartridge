import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OnboardingOverlay } from "./onboarding.tsx";

const STORAGE_KEY = "cartridge.onboarding.dismissed.v1";

export function mountOnboarding(): void {
	const el = document.getElementById("onboarding-root");
	if (!el) {
		return;
	}
	if (localStorage.getItem(STORAGE_KEY) === "1") {
		el.remove();
		return;
	}
	const root = createRoot(el);
	root.render(
		<StrictMode>
			<OnboardingOverlay
				onDismiss={() => {
					localStorage.setItem(STORAGE_KEY, "1");
					root.unmount();
					el.remove();
				}}
			/>
		</StrictMode>,
	);
}
