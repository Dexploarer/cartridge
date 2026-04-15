import type { BrandingProfile } from "@cartridge/shared";

type BrandingEnv = {
	CARTRIDGE_DOCS_URL?: string;
	CARTRIDGE_APP_URL?: string;
	CARTRIDGE_CLOUD_URL?: string;
	CARTRIDGE_ELIZA_CLOUD_DASHBOARD_URL?: string;
	CARTRIDGE_ELIZA_CLOUD_API_BASE_URL?: string;
	CARTRIDGE_BUG_REPORT_URL?: string;
};

function envRecord(): BrandingEnv {
	const bunEnv = typeof Bun !== "undefined" ? Bun.env : undefined;
	const processEnv = typeof process !== "undefined" && process.env ? process.env : undefined;

	return {
		CARTRIDGE_DOCS_URL: bunEnv?.["CARTRIDGE_DOCS_URL"] ?? processEnv?.["CARTRIDGE_DOCS_URL"],
		CARTRIDGE_APP_URL: bunEnv?.["CARTRIDGE_APP_URL"] ?? processEnv?.["CARTRIDGE_APP_URL"],
		CARTRIDGE_CLOUD_URL: bunEnv?.["CARTRIDGE_CLOUD_URL"] ?? processEnv?.["CARTRIDGE_CLOUD_URL"],
		CARTRIDGE_ELIZA_CLOUD_DASHBOARD_URL:
			bunEnv?.["CARTRIDGE_ELIZA_CLOUD_DASHBOARD_URL"] ??
			processEnv?.["CARTRIDGE_ELIZA_CLOUD_DASHBOARD_URL"],
		CARTRIDGE_ELIZA_CLOUD_API_BASE_URL:
			bunEnv?.["CARTRIDGE_ELIZA_CLOUD_API_BASE_URL"] ??
			processEnv?.["CARTRIDGE_ELIZA_CLOUD_API_BASE_URL"],
		CARTRIDGE_BUG_REPORT_URL:
			bunEnv?.["CARTRIDGE_BUG_REPORT_URL"] ?? processEnv?.["CARTRIDGE_BUG_REPORT_URL"],
	};
}

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
