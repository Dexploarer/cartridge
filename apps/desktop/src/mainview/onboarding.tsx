import { TextHoverEffect } from "../components/ui/text-hover-effect";

type OnboardingOverlayProps = {
	onDismiss: () => void;
};

export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
	return (
		<div className="ds-onboarding">
			<div className="ds-onboarding-backdrop" aria-hidden="true" />
			<div className="ds-onboarding-content">
				<div className="ds-onboarding-hero">
					<TextHoverEffect text="CARTRIDGE" duration={3} fillColor="#000000" />
				</div>
				<p className="ds-onboarding-lede">Cartridge — your gaming desktop shell.</p>
				<button type="button" className="ds-onboarding-cta" onClick={onDismiss}>
					Continue
				</button>
			</div>
		</div>
	);
}
