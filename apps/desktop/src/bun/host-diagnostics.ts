import os from "node:os";
import { readFileSync } from "node:fs";

import { Screen, Session, Socket } from "electrobun/bun";

import {
	coerceHostDiagnostics,
	type HostDiagnostics,
} from "../shared/host-diagnostics";

const FALLBACK_SHELL_VERSION = "0.1.0";

function readShellVersion(): string {
	const envVersion = Bun.env["npm_package_version"] ?? process.env["npm_package_version"];
	if (envVersion?.trim()) {
		return envVersion.trim();
	}
	try {
		const raw = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
		const parsed = JSON.parse(raw) as { version?: string };
		if (parsed.version?.trim()) {
			return parsed.version.trim();
		}
	} catch {}
	return FALLBACK_SHELL_VERSION;
}

function readPrimaryDisplay() {
	try {
		const display = Screen.getPrimaryDisplay() as unknown as {
			size?: { width: number; height: number };
			bounds?: { width: number; height: number };
			workArea?: { width: number; height: number };
			scaleFactor?: number;
		};
		const size = display.size ?? display.bounds ?? display.workArea;
		if (!size || !display.workArea) {
			return null;
		}
		return {
			width: size.width,
			height: size.height,
			workAreaWidth: display.workArea.width,
			workAreaHeight: display.workArea.height,
			scaleFactor: Number(display.scaleFactor ?? 1),
		};
	} catch {
		return null;
	}
}

function readCookieCount(): number {
	try {
		return Session.defaultSession.cookies.get().length;
	} catch {
		return 0;
	}
}

function readResidentBytes(): number {
	try {
		return process.memoryUsage().rss;
	} catch {
		return 0;
	}
}

export function readHostDiagnostics(): HostDiagnostics {
	const cpus = os.cpus();
	const primaryCpu = cpus[0];
	return coerceHostDiagnostics({
		shellVersion: readShellVersion(),
		bunVersion: Bun.version,
		nodeVersion: process.versions?.node ?? null,
		platform: os.platform(),
		release: os.release(),
		hostname: os.hostname(),
		arch: os.arch(),
		uptimeSeconds: os.uptime(),
		totalMemoryBytes: os.totalmem(),
		freeMemoryBytes: os.freemem(),
		processResidentBytes: readResidentBytes(),
		cpuModel: primaryCpu?.model ?? "unknown",
		cpuCount: cpus.length,
		loadAverage: os.loadavg(),
		cookieCount: readCookieCount(),
		rpcPort: typeof Socket.rpcPort === "number" ? Socket.rpcPort : null,
		primaryDisplay: readPrimaryDisplay(),
	});
}
