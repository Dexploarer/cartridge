import { useEffect, useRef } from "react";

import type { AiLinkStatus } from "@cartridge/shared";

import type { RuntimeShellState } from "../shared/runtime-shell-state";

type OnboardingOverlayProps = {
	state: RuntimeShellState | null;
	onDismiss: () => void;
};

type DiagnosticsRow = {
	label: string;
	value: string;
	tone?: "good" | "warn" | "error" | "neutral";
};

type DiagnosticsPanelProps = {
	title: string;
	rows: DiagnosticsRow[];
};

type StatusChip = {
	label: string;
	tone: "good" | "warn" | "error" | "neutral";
};

function formatTimestamp(value: string | null): string {
	if (!value) {
		return "Awaiting boot";
	}
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).format(new Date(value));
}

function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return "0 B";
	}
	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	const precision = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
	return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function formatUptime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) {
		return "0m";
	}
	const totalMinutes = Math.floor(seconds / 60);
	const days = Math.floor(totalMinutes / 1440);
	const hours = Math.floor((totalMinutes % 1440) / 60);
	const minutes = totalMinutes % 60;
	if (days > 0) {
		return `${days}d ${hours}h`;
	}
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
}

function formatLoad(load: [number, number, number]): string {
	return load.map((entry) => entry.toFixed(2)).join(" / ");
}

function formatStatus(status: AiLinkStatus): string {
	return status.replaceAll("_", " ");
}

function getStatusTone(status: AiLinkStatus): "good" | "warn" | "error" | "neutral" {
	switch (status) {
		case "ok":
		case "configured":
			return "good";
		case "auth_required":
		case "offline":
			return "warn";
		case "error":
			return "error";
		default:
			return "neutral";
	}
}

function collectProviderStatuses(state: RuntimeShellState | null): AiLinkStatus[] {
	if (!state) {
		return [];
	}
	return [
		state.aiPlane.elizaCloud.status,
		...state.aiPlane.external.map((provider) => provider.status),
		...state.aiPlane.local.map((provider) => provider.status),
	];
}

function countReadyProviders(statuses: AiLinkStatus[]): number {
	return statuses.filter((status) => status === "ok" || status === "configured").length;
}

function countAttentionProviders(statuses: AiLinkStatus[]): number {
	return statuses.filter(
		(status) =>
			status === "auth_required" || status === "offline" || status === "error",
	).length;
}

function summarizeWorkspaces(state: RuntimeShellState | null): string {
	if (!state || state.workspaces.length === 0) {
		return "No child workspaces";
	}
	const labels = state.workspaces.slice(0, 3).map((workspace) => workspace.title.toUpperCase());
	if (state.workspaces.length > 3) {
		labels.push(`+${state.workspaces.length - 3} more`);
	}
	return labels.join(" / ");
}

function buildStatusChips(state: RuntimeShellState | null): StatusChip[] {
	if (!state) {
		return [{ label: "Syncing host snapshot", tone: "neutral" }];
	}
	const providerStatuses = collectProviderStatuses(state);
	const readyProviders = countReadyProviders(providerStatuses);
	const attentionProviders = countAttentionProviders(providerStatuses);
	return [
		{
			label: `${state.runtime.runtimeLocation} runtime`,
			tone: state.runtime.runtimeLocation === "cloud" ? "warn" : "good",
		},
		{
			label: state.runtime.cloudEnabled ? "Cloud link enabled" : "Cloud link offline",
			tone: state.runtime.cloudEnabled ? "good" : "neutral",
		},
		{
			label: `${readyProviders}/${providerStatuses.length || 1} routes ready`,
			tone: attentionProviders > 0 ? "warn" : "good",
		},
		{
			label: `${state.runtime.activeSessionCount} active sessions`,
			tone: state.runtime.activeSessionCount > 0 ? "good" : "neutral",
		},
		...(state.runtime.dataPlaneSyncError
			? [{ label: "Data plane degraded", tone: "error" as const }]
			: []),
	];
}

function DiagnosticsPanel({ title, rows }: DiagnosticsPanelProps) {
	return (
		<section className="ds-onboarding-panel">
			<p className="ds-onboarding-panel-title">{title}</p>
			<dl className="ds-onboarding-kv">
				{rows.map((row) => (
					<div key={`${title}-${row.label}`} className="ds-onboarding-kv-row">
						<dt>{row.label}</dt>
						<dd className={row.tone ? `tone-${row.tone}` : undefined}>{row.value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

function WebGLSplashField() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}

		const gl = canvas.getContext("webgl", {
			alpha: true,
			antialias: false,
			premultipliedAlpha: true,
		});
		if (!gl) {
			return;
		}

		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		const compileShader = (type: number, source: string) => {
			const shader = gl.createShader(type);
			if (!shader) {
				return null;
			}
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				gl.deleteShader(shader);
				return null;
			}
			return shader;
		};

		const vertexShader = compileShader(
			gl.VERTEX_SHADER,
			`
				attribute vec2 a_position;
				varying vec2 v_uv;

				void main() {
					v_uv = a_position * 0.5 + 0.5;
					gl_Position = vec4(a_position, 0.0, 1.0);
				}
			`,
		);
		const fragmentShader = compileShader(
			gl.FRAGMENT_SHADER,
			`
				precision highp float;

				varying vec2 v_uv;
				uniform vec2 u_resolution;
				uniform float u_time;
				uniform vec2 u_pointer;
				uniform float u_reduce_motion;

				float hash(vec2 p) {
					return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
				}

				void main() {
					vec2 uv = v_uv;
					vec2 center = uv - 0.5;
					float aspect = u_resolution.x / max(u_resolution.y, 1.0);
					vec2 drift = (u_pointer - 0.5) * 0.06;
					float pulse = 0.5 + 0.5 * sin(u_time * 0.32);
					float travel = mix(u_time * 0.012, 0.0, u_reduce_motion);
					vec2 fieldUv = uv + vec2(drift.x, drift.y * 0.55) + vec2(0.0, travel);
					vec2 grid = fieldUv * vec2(78.0, 52.0);
					vec2 cell = fract(grid) - 0.5;
					vec2 cellId = floor(grid);
					float randomValue = hash(cellId);
					float distanceToDot = length(cell * vec2(1.0, 1.25));
					float dotMask = smoothstep(0.24, 0.04, distanceToDot);
					float sparseMask = step(0.56, randomValue);
					float depth = smoothstep(1.05, 0.08, length(center * vec2(aspect, 1.0)));
					float halo = smoothstep(0.85, 0.18, length(center * vec2(aspect, 1.0)));
					float intensity = dotMask * sparseMask * depth * (0.3 + pulse * 0.45);
					vec3 dotColor = mix(vec3(0.32, 0.19, 0.02), vec3(1.0, 0.67, 0.0), 0.62 + 0.38 * hash(cellId + 9.0));
					vec3 base = vec3(0.02, 0.02, 0.02);
					base += vec3(0.08, 0.04, 0.0) * halo * (0.4 + pulse * 0.25);
					vec3 color = base + dotColor * intensity;
					gl_FragColor = vec4(color, 1.0);
				}
			`,
		);

		if (!vertexShader || !fragmentShader) {
			if (vertexShader) {
				gl.deleteShader(vertexShader);
			}
			if (fragmentShader) {
				gl.deleteShader(fragmentShader);
			}
			return;
		}

		const program = gl.createProgram();
		if (!program) {
			gl.deleteShader(vertexShader);
			gl.deleteShader(fragmentShader);
			return;
		}

		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			gl.deleteProgram(program);
			return;
		}

		const buffer = gl.createBuffer();
		if (!buffer) {
			gl.deleteProgram(program);
			return;
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 3, -1, -1, 3]),
			gl.STATIC_DRAW,
		);

		const positionLocation = gl.getAttribLocation(program, "a_position");
		const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
		const timeLocation = gl.getUniformLocation(program, "u_time");
		const pointerLocation = gl.getUniformLocation(program, "u_pointer");
		const reduceMotionLocation = gl.getUniformLocation(program, "u_reduce_motion");

		const pointerTarget = { x: 0.5, y: 0.5 };
		const pointer = { x: 0.5, y: 0.5 };
		let frameId = 0;
		let startedAt = performance.now();

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
			const width = Math.max(1, Math.round(rect.width * devicePixelRatio));
			const height = Math.max(1, Math.round(rect.height * devicePixelRatio));
			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
			}
			gl.viewport(0, 0, width, height);
		};

		const onPointerMove = (event: PointerEvent) => {
			pointerTarget.x = event.clientX / window.innerWidth;
			pointerTarget.y = 1 - event.clientY / window.innerHeight;
		};

		const onPointerLeave = () => {
			pointerTarget.x = 0.5;
			pointerTarget.y = 0.5;
		};

		const render = (now: number) => {
			pointer.x += (pointerTarget.x - pointer.x) * 0.045;
			pointer.y += (pointerTarget.y - pointer.y) * 0.045;

			resize();
			gl.useProgram(program);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(positionLocation);
			gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
			gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
			gl.uniform1f(timeLocation, (now - startedAt) / 1000);
			gl.uniform2f(pointerLocation, pointer.x, pointer.y);
			gl.uniform1f(reduceMotionLocation, prefersReducedMotion ? 1 : 0);
			gl.drawArrays(gl.TRIANGLES, 0, 3);

			frameId = window.requestAnimationFrame(render);
		};

		resize();
		window.addEventListener("resize", resize);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerleave", onPointerLeave);
		frameId = window.requestAnimationFrame(render);

		return () => {
			window.cancelAnimationFrame(frameId);
			window.removeEventListener("resize", resize);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerleave", onPointerLeave);
			gl.deleteBuffer(buffer);
			gl.deleteProgram(program);
		};
	}, []);

	return <canvas ref={canvasRef} className="ds-onboarding-webgl" aria-hidden="true" />;
}

export function OnboardingOverlay({ state, onDismiss }: OnboardingOverlayProps) {
	const providerStatuses = collectProviderStatuses(state);
	const readyProviders = countReadyProviders(providerStatuses);
	const attentionProviders = countAttentionProviders(providerStatuses);
	const chips = buildStatusChips(state);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Enter" && event.key !== "Escape") {
				return;
			}
			event.preventDefault();
			onDismiss();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [onDismiss]);

	const shellRows: DiagnosticsRow[] = [
		{ label: "Shell", value: state?.host.shellVersion ?? "Loading" },
		{ label: "Runtime", value: state?.runtime.runtimeId ?? "Loading" },
		{ label: "Booted", value: formatTimestamp(state?.runtime.bootedAt ?? null) },
		{ label: "RPC bridge", value: state?.host.rpcPort ? `:${state.host.rpcPort}` : "Unavailable" },
		{ label: "Cookies", value: String(state?.host.cookieCount ?? 0) },
	];

	const hostRows: DiagnosticsRow[] = [
		{ label: "Host", value: state?.host.hostname ?? "Loading" },
		{
			label: "Platform",
			value: state ? `${state.host.platform} ${state.host.release} / ${state.host.arch}` : "Loading",
		},
		{
			label: "CPU",
			value: state ? `${state.host.cpuCount}c / ${state.host.cpuModel}` : "Loading",
		},
		{
			label: "Memory",
			value: state
				? `${formatBytes(state.host.freeMemoryBytes)} free / ${formatBytes(state.host.totalMemoryBytes)}`
				: "Loading",
		},
		{
			label: "Resident",
			value: state ? formatBytes(state.host.processResidentBytes) : "Loading",
		},
		{
			label: "Load",
			value: state ? formatLoad(state.host.loadAverage) : "Loading",
		},
	];

	const displayRows: DiagnosticsRow[] = [
		{
			label: "Panel",
			value: state?.host.primaryDisplay
				? `${state.host.primaryDisplay.width} × ${state.host.primaryDisplay.height}`
				: "Unavailable",
		},
		{
			label: "Work area",
			value: state?.host.primaryDisplay
				? `${state.host.primaryDisplay.workAreaWidth} × ${state.host.primaryDisplay.workAreaHeight}`
				: "Unavailable",
		},
		{
			label: "Scale",
			value: state?.host.primaryDisplay
				? `${state.host.primaryDisplay.scaleFactor.toFixed(2)}x`
				: "Unavailable",
		},
		{
			label: "Workspaces",
			value: state ? summarizeWorkspaces(state) : "Loading",
		},
		{
			label: "Uptime",
			value: state ? formatUptime(state.host.uptimeSeconds) : "Loading",
		},
	];

	const aiRows: DiagnosticsRow[] = [
		{
			label: "Eliza cloud",
			value: state ? formatStatus(state.aiPlane.elizaCloud.status) : "Loading",
			tone: state ? getStatusTone(state.aiPlane.elizaCloud.status) : "neutral",
		},
		{
			label: "Routes",
			value: state ? `${readyProviders} ready / ${providerStatuses.length || 1}` : "Loading",
			tone: attentionProviders > 0 ? "warn" : "good",
		},
		{
			label: "Attention",
			value: state ? String(attentionProviders) : "0",
			tone: attentionProviders > 0 ? "warn" : "neutral",
		},
		{
			label: "Active route",
			value: state
				? `${(state.aiPlane.activeProviderId ?? "auto").replaceAll("-", " ")} / ${state.aiPlane.activeModelId ?? "auto"}`
				: "Loading",
		},
		{
			label: "Last probe",
			value: formatTimestamp(state?.aiPlane.lastProbeAt ?? null),
		},
		{
			label: "Probe state",
			value: state?.aiPlane.aggregateProbeError ?? "Stable",
			tone: state?.aiPlane.aggregateProbeError ? "warn" : "good",
		},
	];

	return (
		<div className="ds-onboarding" role="dialog" aria-modal="true" aria-labelledby="splash-title">
			<div className="ds-onboarding-backdrop" aria-hidden="true">
				<WebGLSplashField />
				<div className="ds-onboarding-scanlines" />
			</div>
			<div className="ds-onboarding-shell">
				<div className="ds-onboarding-frame">
					<div className="ds-onboarding-grid">
						<section className="ds-onboarding-hero">
							<p className="ds-onboarding-eyebrow">Live Boot Diagnostics</p>
							<h1 id="splash-title" className="ds-onboarding-title">
								Cartridge
							</h1>
							<p className="ds-onboarding-copy">
								Real host, runtime, AI plane, and display telemetry from the Electrobun shell.
							</p>
							<div className="ds-onboarding-chip-row">
								{chips.map((chip) => (
									<span key={chip.label} className={`ds-onboarding-chip tone-${chip.tone}`}>
										{chip.label}
									</span>
								))}
							</div>
							<div className="ds-onboarding-metrics">
								<div className="ds-onboarding-metric">
									<span>Surfaces</span>
									<strong>{state?.catalog.totalApps ?? "—"}</strong>
								</div>
								<div className="ds-onboarding-metric">
									<span>Knowledge</span>
									<strong>{state?.knowledge.length ?? "—"}</strong>
								</div>
								<div className="ds-onboarding-metric">
									<span>Data stores</span>
									<strong>{state?.dataStores.length ?? "—"}</strong>
								</div>
								<div className="ds-onboarding-metric">
									<span>Threads</span>
									<strong>{state?.chatThreads.length ?? "—"}</strong>
								</div>
							</div>
						</section>

						<div className="ds-onboarding-panels">
							<DiagnosticsPanel title="Shell" rows={shellRows} />
							<DiagnosticsPanel title="Host" rows={hostRows} />
							<DiagnosticsPanel title="Display" rows={displayRows} />
							<DiagnosticsPanel title="AI Plane" rows={aiRows} />
						</div>
					</div>

					<div className="ds-onboarding-footer">
						<div className="ds-onboarding-footer-copy">
							<p>
								{state?.runtime.dataPlaneSyncError
									? `Remote data plane degraded: ${state.runtime.dataPlaneSyncError}`
									: `Wallet ${state?.runtime.walletEnabled ? "enabled" : "disabled"} · ${state?.runtime.activeSessionCount ?? 0}/${state?.runtime.totalSessionCount ?? 0} sessions online`}
							</p>
							<p>
								{state
									? `Bun ${state.host.bunVersion}${state.host.nodeVersion ? ` · Node ${state.host.nodeVersion}` : ""}`
									: "Collecting host versions"}
							</p>
						</div>
						<div className="ds-onboarding-actions">
							<span className="ds-onboarding-keyhint">Enter or Esc</span>
							<button type="button" className="ds-onboarding-cta" onClick={onDismiss}>
								Enter Shell
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
