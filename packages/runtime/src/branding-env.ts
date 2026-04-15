import type { BrandingProfile } from "@cartridge/shared";

function envRecord(): Record<string, string | undefined> {
	if (typeof Bun !== "undefined") {
		return Bun.env as Record<string, string | undefined>;
	}
	if (typeof process !== "undefined" && process.env) {
		return process.env as Record<string, string | undefined>;
	}
	return {};
}

/** Overlay `CARTRIDGE_*` env vars onto branding defaults. */
export function mergeBrandingFromEnv(profile: BrandingProfile): BrandingProfile {
	const env = envRecord();
	return {
		...profile,
		docsUrl: env["CARTRIDGE_DOCS_URL"] ?? profile.docsUrl,
		appUrl: env["CARTRIDGE_APP_URL"] ?? profile.appUrl,
		cloudUrl: env["CARTRIDGE_CLOUD_URL"] ?? profile.cloudUrl,
		elizaCloudDashboardUrl:
			env["CARTRIDGE_ELIZA_CLOUD_DASHBOARD_URL"] ?? profile.elizaCloudDashboardUrl,
		elizaCloudApiBaseUrl:
			env["CARTRIDGE_ELIZA_CLOUD_API_BASE_URL"] ?? profile.elizaCloudApiBaseUrl,
		bugReportUrl: env["CARTRIDGE_BUG_REPORT_URL"] ?? profile.bugReportUrl,
	};
}
