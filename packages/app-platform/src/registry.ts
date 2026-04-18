import {
	ACTIVE_SURFACES,
	OPERATOR_SURFACES,
	type AppCatalogSummary,
	type GameAppManifest,
	type OperatorSurfaceSpec,
	type Persona,
	type SurfaceCategory,
} from "@cartridge/shared";

export function launchUrlOverrideEnvKey(appId: string): string {
	return `CARTRIDGE_LAUNCH_URL_${appId.replaceAll("-", "_").toUpperCase()}`;
}

const LEGACY_LAUNCH_URL_ENV_KEYS: Record<string, string[]> = {
	babylon: ["BABYLON_CLIENT_URL", "BABYLON_APP_URL", "BABYLON_API_URL"],
	hyperscape: ["HYPERSCAPE_CLIENT_URL", "HYPERSCAPE_API_URL"],
	scape: ["SCAPE_CLIENT_URL"],
};

function resolveLegacyLaunchUrlOverride(appId: string): string | undefined {
	for (const key of LEGACY_LAUNCH_URL_ENV_KEYS[appId] ?? []) {
		const value = process.env[key]?.trim();
		if (value) {
			return value;
		}
	}
	return undefined;
}

function applyLaunchUrlEnvOverrides(apps: GameAppManifest[]): GameAppManifest[] {
	return apps.map((app) => {
		const cartridge = process.env[launchUrlOverrideEnvKey(app.appId)]?.trim();
		const raw = cartridge || resolveLegacyLaunchUrlOverride(app.appId);
		if (!raw) {
			return app;
		}
		return { ...app, launchUrl: raw };
	});
}

export class AppRegistry {
	private readonly appsById: Map<string, GameAppManifest>;
	private readonly operatorSurfacesByAppId: Map<string, OperatorSurfaceSpec>;

	constructor(apps: GameAppManifest[], operatorSurfaces: OperatorSurfaceSpec[]) {
		this.appsById = new Map(apps.map((app) => [app.appId, app]));
		this.operatorSurfacesByAppId = new Map(
			operatorSurfaces.map((surface) => [surface.targetAppId, surface]),
		);
	}

	listApps(): GameAppManifest[] {
		return [...this.appsById.values()];
	}

	listAppsByCategory(category: SurfaceCategory): GameAppManifest[] {
		return this.listApps().filter((app) => app.category === category);
	}

	listAppsForPersona(persona: Persona): GameAppManifest[] {
		return this.listApps().filter((app) => app.personas.includes(persona));
	}

	getApp(appId: string): GameAppManifest | null {
		return this.appsById.get(appId) ?? null;
	}

	getOperatorSurface(appId: string): OperatorSurfaceSpec | null {
		return this.operatorSurfacesByAppId.get(appId) ?? null;
	}

	getCatalogSummary(): AppCatalogSummary {
		const personaCoverage: AppCatalogSummary["personaCoverage"] = {
			"agent-gamer": 0,
			"dev-gamer": 0,
			"user-gamer": 0,
		};

		let games = 0;
		let support = 0;

		for (const app of this.appsById.values()) {
			if (app.category === "game") {
				games += 1;
			} else if (app.category === "support") {
				support += 1;
			}

			for (const persona of app.personas) {
				personaCoverage[persona] += 1;
			}
		}

		return {
			totalApps: this.appsById.size,
			games,
			support,
			operatorSurfaces: this.operatorSurfacesByAppId.size,
			personaCoverage,
		};
	}
}

export function createDefaultAppRegistry(): AppRegistry {
	return new AppRegistry(applyLaunchUrlEnvOverrides(ACTIVE_SURFACES), OPERATOR_SURFACES);
}
