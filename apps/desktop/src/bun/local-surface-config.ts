import type { Persona } from "@cartridge/shared";
import { homedir } from "node:os";
import path from "node:path";

export type SurfaceWorkspaceVisualFitMode = "none" | "topBand";

export type LocalSurfaceCommand = {
	command: string;
	args: string[];
};

export type LocalSurfaceDevConfig = {
	appId: string;
	displayName: string;
	repoUrl: string;
	envDirKey: string;
	candidateDirs: string[];
	readyUrl: string;
	install: LocalSurfaceCommand;
	build: LocalSurfaceCommand;
	dev: LocalSurfaceCommand;
	readyTimeoutMs: number;
	visualFitMode: SurfaceWorkspaceVisualFitMode;
	bridgeSearchParams?: Record<string, string>;
	botSdkBootstrap?: {
		personas: Persona[];
		searchParams: Record<string, string>;
		sessionNote: string;
	};
};

const HOME = homedir();

const SURFACE_LAUNCH_SEARCH_PARAMS: Record<string, Record<string, string>> = {
	babylon: {
		embedded: "true",
	},
};

const DIRECT_SURFACE_WINDOW_APPS = new Set([
	"babylon",
	"clawville",
	"hyperscape",
	"companion",
	"coding",
	"steward",
	"browser",
]);

const LOCAL_SURFACE_DEV_CONFIGS: Record<string, LocalSurfaceDevConfig> = {
	kinema: {
		appId: "kinema",
		displayName: "Kinema",
		repoUrl: "https://github.com/Dexploarer/Kinema.git",
		envDirKey: "CARTRIDGE_SURFACE_DIR_KINEMA",
		candidateDirs: [
			path.join(HOME, "Kinema"),
			path.resolve(process.cwd(), "..", "Kinema"),
		],
		readyUrl: "http://127.0.0.1:5173/",
		install: {
			command: "npm",
			args: ["ci"],
		},
		build: {
			command: "npm",
			args: ["run", "build"],
		},
		dev: {
			command: "npm",
			args: ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
		},
		readyTimeoutMs: 30000,
		visualFitMode: "none",
		bridgeSearchParams: {
			cartridgeBridge: "1",
		},
		botSdkBootstrap: {
			personas: ["agent-gamer"],
			searchParams: {
				spawn: "entrance",
			},
			sessionNote:
				"BotSDK bootstrap entered the procedural demo at the corridor entrance, matching the main-menu Play flow.",
		},
	},
};

export function getLocalSurfaceDevConfig(
	appId: string,
): LocalSurfaceDevConfig | null {
	return LOCAL_SURFACE_DEV_CONFIGS[appId] ?? null;
}

export function resolveLocalSurfaceRepoDir(
	config: LocalSurfaceDevConfig,
	env: NodeJS.ProcessEnv = process.env,
): string {
	const fromEnv = env[config.envDirKey]?.trim();
	if (fromEnv) {
		return fromEnv;
	}
	return config.candidateDirs[0] ?? path.join(HOME, config.displayName);
}

export function getSurfaceWorkspaceVisualFitMode(
	appId: string,
): SurfaceWorkspaceVisualFitMode {
	if (appId === "scape") {
		return "topBand";
	}
	return getLocalSurfaceDevConfig(appId)?.visualFitMode ?? "none";
}

export function shouldUseDirectSurfaceWindow(
	appId: string,
): boolean {
	return DIRECT_SURFACE_WINDOW_APPS.has(appId);
}

export function resolveLocalSurfaceLaunch(
	appId: string,
	persona: Persona,
	launchUrl: string | null | undefined,
): { embedUrl: string | null; sessionNote: string | null } {
	const rawUrl = launchUrl?.trim() ?? "";
	if (!rawUrl) {
		return {
			embedUrl: null,
			sessionNote: null,
		};
	}

	const config = getLocalSurfaceDevConfig(appId);
	const bootstrap = config?.botSdkBootstrap;
	const launchSearchParams =
		config?.bridgeSearchParams ?? SURFACE_LAUNCH_SEARCH_PARAMS[appId] ?? {};

	try {
		const url = new URL(rawUrl);
		for (const [key, value] of Object.entries(launchSearchParams)) {
			if (!url.searchParams.has(key)) {
				url.searchParams.set(key, value);
			}
		}
		if (!bootstrap || !bootstrap.personas.includes(persona)) {
			return {
				embedUrl: url.toString(),
				sessionNote: null,
			};
		}
		for (const [key, value] of Object.entries(bootstrap.searchParams)) {
			if (!url.searchParams.has(key)) {
				url.searchParams.set(key, value);
			}
		}
		return {
			embedUrl: url.toString(),
			sessionNote: bootstrap.sessionNote,
		};
	} catch {
		return {
			embedUrl: rawUrl,
			sessionNote: null,
		};
	}
}
