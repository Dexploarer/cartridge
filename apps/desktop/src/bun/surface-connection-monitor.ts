import { existsSync } from "node:fs";

import type { GameAppManifest } from "@cartridge/shared";

import {
	coerceSurfaceConnectionState,
	type SurfaceConnectionState,
} from "../shared/runtime-shell-state";
import {
	getLocalSurfaceDevConfig,
	resolveLocalSurfaceRepoDir,
} from "./local-surface-config";

const DEFAULT_TTL_MS = 45_000;
const DEFAULT_PROBE_TIMEOUT_MS = 5_000;

type UrlProbeResult = {
	ok: boolean;
	detail: string;
};

export type UrlProbe = (url: string) => Promise<UrlProbeResult>;

type ProbeOptions = {
	env?: NodeJS.ProcessEnv;
	pathExists?: (path: string) => boolean;
	probeUrl?: UrlProbe;
	now?: () => number;
	nowIso?: () => string;
	probeTimeoutMs?: number;
};

type MonitorOptions = ProbeOptions & {
	onChange?: () => void;
	ttlMs?: number;
};

function isoNow(): string {
	return new Date().toISOString();
}

function parseHttpUrl(rawUrl: string | null | undefined): URL | null {
	const value = rawUrl?.trim();
	if (!value) {
		return null;
	}
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function isLocalHttpUrl(url: URL): boolean {
	return (
		url.hostname === "localhost" ||
		url.hostname === "127.0.0.1" ||
		url.hostname === "::1"
	);
}

async function defaultProbeUrl(url: string): Promise<UrlProbeResult> {
	try {
		const response = await fetch(url, {
			method: "GET",
			signal: AbortSignal.timeout(DEFAULT_PROBE_TIMEOUT_MS),
		});
		return {
			ok: response.ok,
			detail: response.ok
				? `Reachable at ${url}`
				: `HTTP ${response.status} from ${url}`,
		};
	} catch (error) {
		return {
			ok: false,
			detail:
				error instanceof Error ? error.message : `Failed to reach ${url}`,
		};
	}
}

export async function probeSurfaceConnection(
	surface: GameAppManifest,
	options: ProbeOptions = {},
): Promise<SurfaceConnectionState> {
	const nowIso = options.nowIso ?? isoNow;
	const pathExists = options.pathExists ?? existsSync;
	const probeUrl = options.probeUrl ?? defaultProbeUrl;
	const config = getLocalSurfaceDevConfig(surface.appId);
	const launchUrl = surface.launchUrl?.trim() ?? null;

	if (config) {
		const repoDir = resolveLocalSurfaceRepoDir(config, options.env);
		const probe = await probeUrl(config.readyUrl);
		if (probe.ok) {
			return coerceSurfaceConnectionState(surface, {
				mode: "local-managed",
				status: "ready",
				detail: `Local surface ready at ${config.readyUrl}`,
				checkedAt: nowIso(),
				localRepoDir: repoDir,
			});
		}

		const repoPresent = pathExists(repoDir);
		return coerceSurfaceConnectionState(surface, {
			mode: "local-managed",
			status: "launchable",
			detail: repoPresent
				? `Local repo present at ${repoDir}. Cartridge can install, build, and run it on launch.`
				: `Repo missing locally. Cartridge will clone ${config.repoUrl} on first launch.`,
			checkedAt: nowIso(),
			localRepoDir: repoDir,
		});
	}

	const parsedUrl = parseHttpUrl(launchUrl);
	if (!parsedUrl) {
		return coerceSurfaceConnectionState(surface, {
			mode: "missing",
			status: "error",
			detail: "No valid launch URL is configured for this surface.",
			checkedAt: nowIso(),
		});
	}

	const probe = await probeUrl(parsedUrl.toString());
	const localUrl = isLocalHttpUrl(parsedUrl);
	return coerceSurfaceConnectionState(surface, {
		mode: localUrl ? "local-url" : "remote-url",
		status: probe.ok ? "ready" : localUrl ? "launchable" : "offline",
		detail: probe.ok
			? probe.detail
			: localUrl
				? `Local service is not reachable at ${parsedUrl.toString()} yet. Start it before launching.`
				: probe.detail,
		checkedAt: nowIso(),
	});
}

export class SurfaceConnectionMonitor {
	private readonly cache = new Map<string, SurfaceConnectionState>();
	private readonly inFlight = new Map<string, Promise<void>>();

	constructor(private readonly options: MonitorOptions = {}) {}

	snapshotFor(surfaces: GameAppManifest[]): SurfaceConnectionState[] {
		const now = (this.options.now ?? Date.now)();
		for (const surface of surfaces) {
			const cached = this.cache.get(surface.appId);
			if (!cached) {
				this.cache.set(
					surface.appId,
					coerceSurfaceConnectionState(surface, {
						mode: getLocalSurfaceDevConfig(surface.appId)
							? "local-managed"
							: parseHttpUrl(surface.launchUrl)?.hostname === "localhost" ||
								  parseHttpUrl(surface.launchUrl)?.hostname === "127.0.0.1" ||
								  parseHttpUrl(surface.launchUrl)?.hostname === "::1"
								? "local-url"
								: parseHttpUrl(surface.launchUrl)
									? "remote-url"
									: "missing",
					}),
				);
				this.startProbe(surface);
				continue;
			}
			const checkedAtMs = cached.checkedAt
				? Date.parse(cached.checkedAt)
				: Number.NaN;
			const ttlMs = this.options.ttlMs ?? DEFAULT_TTL_MS;
			if (!Number.isFinite(checkedAtMs) || now - checkedAtMs >= ttlMs) {
				this.startProbe(surface);
			}
		}

		return surfaces.map((surface) =>
			this.cache.get(surface.appId) ??
			coerceSurfaceConnectionState(surface),
		);
	}

	noteLaunchStart(appId: string, detail = "Preparing local surface launch."): void {
		this.patch(appId, {
			status: "starting",
			detail,
			checkedAt: isoNow(),
		});
	}

	noteLaunchReady(appId: string, detail = "Surface launch target is ready."): void {
		this.patch(appId, {
			status: "ready",
			detail,
			checkedAt: isoNow(),
		});
	}

	noteLaunchFailure(appId: string, detail: string): void {
		this.patch(appId, {
			status: "error",
			detail,
			checkedAt: isoNow(),
		});
	}

	private patch(
		appId: string,
		overrides: Partial<SurfaceConnectionState>,
	): void {
		const cached = this.cache.get(appId);
		if (!cached) {
			return;
		}
		this.cache.set(appId, { ...cached, ...overrides });
		this.options.onChange?.();
	}

	private startProbe(surface: GameAppManifest): void {
		if (this.inFlight.has(surface.appId)) {
			return;
		}
		const task = probeSurfaceConnection(surface, this.options)
			.then((result) => {
				this.cache.set(surface.appId, result);
				this.options.onChange?.();
			})
			.catch((error) => {
				this.cache.set(
					surface.appId,
					coerceSurfaceConnectionState(surface, {
						mode: getLocalSurfaceDevConfig(surface.appId)
							? "local-managed"
							: "remote-url",
						status: "error",
						detail:
							error instanceof Error
								? error.message
								: `Failed to probe ${surface.displayName}`,
						checkedAt: isoNow(),
					}),
				);
				this.options.onChange?.();
			})
			.finally(() => {
				this.inFlight.delete(surface.appId);
			});
		this.inFlight.set(surface.appId, task);
	}
}
