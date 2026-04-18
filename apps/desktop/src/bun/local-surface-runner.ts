import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

import {
	getLocalSurfaceDevConfig,
	resolveLocalSurfaceRepoDir,
	type LocalSurfaceCommand,
	type LocalSurfaceDevConfig,
} from "./local-surface-config";

type FeedSink = (from: string, message: string) => void;

type ManagedSurfaceProcess = {
	config: LocalSurfaceDevConfig;
	repoDir: string;
	child: ChildProcess;
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isUrlReady(url: string): Promise<boolean> {
	try {
		const response = await fetch(url, {
			method: "GET",
		});
		return response.ok;
	} catch {
		return false;
	}
}

async function waitForUrlReady(
	url: string,
	timeoutMs: number,
): Promise<boolean> {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (await isUrlReady(url)) {
			return true;
		}
		await sleep(250);
	}
	return false;
}

function formatCommand(command: LocalSurfaceCommand): string {
	return [command.command, ...command.args].join(" ");
}

async function runCommand(
	command: LocalSurfaceCommand,
	cwd: string,
	feed: FeedSink,
	label: string,
): Promise<void> {
	feed("Local Surface", `${label}: ${formatCommand(command)} (${cwd})`);
	return new Promise((resolve, reject) => {
		const child = spawn(command.command, command.args, {
			cwd,
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let tail = "";
		const append = (chunk: string) => {
			tail = `${tail}${chunk}`.slice(-4000);
		};
		child.stdout.on("data", (chunk) => {
			append(String(chunk));
		});
		child.stderr.on("data", (chunk) => {
			append(String(chunk));
		});
		child.on("error", (error) => {
			reject(error);
		});
		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(
				new Error(
					`${label} failed with code ${code ?? -1}${tail.trim() ? `\n${tail.trim()}` : ""}`,
				),
			);
		});
	});
}

export class LocalSurfaceRunner {
	private readonly processes = new Map<string, ManagedSurfaceProcess>();
	private readonly buildVerified = new Set<string>();

	async ensureSurfaceReady(appId: string, feed: FeedSink): Promise<void> {
		const config = getLocalSurfaceDevConfig(appId);
		if (!config) {
			return;
		}
		const repoDir = resolveLocalSurfaceRepoDir(config);
		await this.ensureRepo(config, repoDir, feed);
		await this.ensureInstall(config, repoDir, feed);
		await this.ensureBuild(config, repoDir, feed);
		if (await isUrlReady(config.readyUrl)) {
			feed("Local Surface", `${config.displayName} already available at ${config.readyUrl}`);
			return;
		}
		await this.ensureDevServer(config, repoDir, feed);
	}

	dispose(): void {
		for (const managed of this.processes.values()) {
			managed.child.kill();
		}
		this.processes.clear();
	}

	private async ensureRepo(
		config: LocalSurfaceDevConfig,
		repoDir: string,
		feed: FeedSink,
	): Promise<void> {
		if (existsSync(path.join(repoDir, "package.json"))) {
			return;
		}

		mkdirSync(path.dirname(repoDir), { recursive: true });
		await runCommand(
			{
				command: "git",
				args: ["clone", config.repoUrl, repoDir],
			},
			process.cwd(),
			feed,
			`${config.displayName} clone`,
		);
	}

	private async ensureInstall(
		config: LocalSurfaceDevConfig,
		repoDir: string,
		feed: FeedSink,
	): Promise<void> {
		if (existsSync(path.join(repoDir, "node_modules"))) {
			return;
		}
		await runCommand(config.install, repoDir, feed, `${config.displayName} install`);
	}

	private async ensureBuild(
		config: LocalSurfaceDevConfig,
		repoDir: string,
		feed: FeedSink,
	): Promise<void> {
		if (this.buildVerified.has(config.appId)) {
			return;
		}
		await runCommand(config.build, repoDir, feed, `${config.displayName} build`);
		this.buildVerified.add(config.appId);
	}

	private async ensureDevServer(
		config: LocalSurfaceDevConfig,
		repoDir: string,
		feed: FeedSink,
	): Promise<void> {
		const existing = this.processes.get(config.appId);
		if (existing && !existing.child.killed && existing.child.exitCode === null) {
			if (await waitForUrlReady(config.readyUrl, config.readyTimeoutMs)) {
				feed("Local Surface", `${config.displayName} ready at ${config.readyUrl}`);
				return;
			}
		}

		const child = spawn(config.dev.command, config.dev.args, {
			cwd: repoDir,
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		const managed: ManagedSurfaceProcess = {
			config,
			repoDir,
			child,
		};
		this.processes.set(config.appId, managed);

		const pipeLogs = (stream: NodeJS.ReadableStream, prefix: "stdout" | "stderr") => {
			const rl = createInterface({ input: stream });
			rl.on("line", (line) => {
				const text = line.trim();
				if (!text) {
					return;
				}
				feed(config.displayName, `${prefix}: ${text}`);
			});
		};
		if (child.stdout) {
			pipeLogs(child.stdout, "stdout");
		}
		if (child.stderr) {
			pipeLogs(child.stderr, "stderr");
		}
		child.on("exit", () => {
			const current = this.processes.get(config.appId);
			if (current?.child === child) {
				this.processes.delete(config.appId);
			}
		});

		const ready = await waitForUrlReady(config.readyUrl, config.readyTimeoutMs);
		if (!ready) {
			child.kill();
			throw new Error(`${config.displayName} dev server did not become ready at ${config.readyUrl}`);
		}

		feed("Local Surface", `${config.displayName} ready at ${config.readyUrl}`);
	}
}
