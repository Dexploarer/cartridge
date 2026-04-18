import type {
	AppendTelemetryInput,
	OperatorCommandPayload,
	SurfaceControlTransport,
	SurfaceTakeoverState,
	WorkspaceViewDescriptor,
} from "@cartridge/shared";
import Electrobun, { Electroview } from "electrobun/view";

import {
	buildKinemaTelemetryFrames,
	parseKinemaChatCommand,
	type KinemaBridgeSnapshot,
} from "./kinema-botsdk";
import {
	enqueueBufferedKinemaCommand,
	expireBufferedKinemaCommands,
	flushBufferedKinemaCommands,
	type BufferedKinemaCommand,
} from "./kinema-command-buffer";
import { buildWorkspacePaneState } from "./workspace-view-state";

const WORKSPACE_TOP_BAND_FRACTION = 0.38;
const WORKSPACE_EMBED_MAX_SCALE = 3.25;
const KINEMA_SNAPSHOT_POLL_MS = 1500;
const KINEMA_BRIDGE_SOURCE = "cartridge-childview";
const KINEMA_BRIDGE_TARGET = "kinema-cartridge-bridge";

type VisualFitMode = "none" | "topBand";

type ChildWindowRPC = {
	bun: {
		requests: {
			sendToMain: {
				params: { message: string };
				response: { success: boolean };
			};
			executeControl: {
				params: {
					sessionId: string;
					control: string;
					payload?: OperatorCommandPayload;
					note?: string;
				};
				response:
					| { success: true; commandId: string }
					| { success: false; error: string };
			};
			reportControlResult: {
				params: {
					sessionId: string;
					commandId: string;
					status: "executed" | "failed";
					result?: string;
				};
				response: { success: boolean };
			};
			reportTelemetry: {
				params: {
					sessionId: string;
					frames: AppendTelemetryInput;
				};
				response: { success: boolean };
			};
		};
		messages: {};
	};
	webview: {
		requests: {};
		messages: {
			receiveMessage: { from: string; message: string };
			setWindowInfo: { id: number; title: string };
			setSurfaceInfo: {
				appId: string;
				title: string;
				summary: string;
				category: string;
				capabilities: string[];
				personas: string[];
			};
			setGameViews: {
				agentView: WorkspaceViewDescriptor;
				userView: WorkspaceViewDescriptor | null;
				visualFitMode?: VisualFitMode;
			};
			setSessionInfo: {
				sessionId: string;
				persona: string;
				status: string;
				viewer: string;
				suggestions: string[];
				controls: string[];
				agentName: string;
				threadTitle: string;
				screenTitle: string;
				liveStreams: string[];
				streamScene: string | null;
				streamCaptureMode: "standard" | "immersive";
				takeoverState: SurfaceTakeoverState;
				controlTransport: SurfaceControlTransport | null;
			};
			dispatchOperatorCommand: {
				sessionId: string;
				commandId: string;
				control: string;
				payload: OperatorCommandPayload;
			};
		};
	};
};

type KinemaBridgeResultMessage = {
	source: string;
	kind: "kinema:result";
	commandId: string;
	success: boolean;
	message?: string;
	snapshot?: KinemaBridgeSnapshot;
};

type KinemaBridgeSnapshotMessage = {
	source: string;
	kind: "kinema:snapshot";
	snapshot: KinemaBridgeSnapshot;
};

type KinemaBridgeReadyMessage = {
	source: string;
	kind: "kinema:ready";
	capabilities: string[];
};

type KinemaBridgeIncomingMessage =
	| KinemaBridgeResultMessage
	| KinemaBridgeSnapshotMessage
	| KinemaBridgeReadyMessage;

type ChipDescriptor = {
	label: string;
	tone?: "default" | "ok";
};

let workspaceFitObserver: ResizeObserver | null = null;
let currentSurfaceAppId: string | null = null;
let currentSurfaceTitle = "Session";
let currentSessionId: string | null = null;
let currentSessionControls: string[] = [];
let currentEmbedUrl = "about:blank";
let kinemaTargetOrigin = "*";
let kinemaSnapshot: KinemaBridgeSnapshot | null = null;
let kinemaBridgeReady = false;
let kinemaPollTimer: ReturnType<typeof setInterval> | null = null;
let pendingKinemaCommands: BufferedKinemaCommand[] = [];

function clearWorkspaceVisualFit(frames: HTMLIFrameElement[]): void {
	workspaceFitObserver?.disconnect();
	workspaceFitObserver = null;
	for (const frame of frames) {
		frame.style.removeProperty("transform");
		frame.style.removeProperty("transform-origin");
	}
}

function applyTopBandFit(frame: HTMLIFrameElement, pane: HTMLElement): void {
	if (!frame.src || frame.src === "about:blank") {
		frame.style.removeProperty("transform");
		frame.style.removeProperty("transform-origin");
		return;
	}
	const w = pane.clientWidth;
	const h = pane.clientHeight;
	if (w < 4 || h < 4) {
		return;
	}
	const raw = 1 / WORKSPACE_TOP_BAND_FRACTION;
	const scale = Math.min(Math.max(raw, 1.02), WORKSPACE_EMBED_MAX_SCALE);
	frame.style.transformOrigin = "top center";
	frame.style.transform = `scale(${scale})`;
}

function mountWorkspaceVisualFit(
	viewport: HTMLElement,
	pairs: { frame: HTMLIFrameElement; pane: HTMLElement }[],
	mode: VisualFitMode,
): void {
	const frames = pairs.map((p) => p.frame);
	clearWorkspaceVisualFit(frames);
	if (mode !== "topBand") {
		return;
	}
	const primary = pairs[0]?.frame;
	if (!primary?.src || primary.src === "about:blank") {
		return;
	}
	const run = () => {
		for (const { frame, pane } of pairs) {
			applyTopBandFit(frame, pane);
		}
	};
	run();
	workspaceFitObserver = new ResizeObserver(run);
	workspaceFitObserver.observe(viewport);
	queueMicrotask(run);
	requestAnimationFrame(run);
}

function normalizeOrigin(rawUrl: string): string {
	try {
		return new URL(rawUrl).origin;
	} catch {
		return "*";
	}
}

function isKinemaSurface(): boolean {
	return currentSurfaceAppId === "kinema";
}

function currentKinemaFrame(): HTMLIFrameElement {
	return gameFrameAEl;
}

function stopKinemaSnapshotPolling(): void {
	if (kinemaPollTimer) {
		clearInterval(kinemaPollTimer);
		kinemaPollTimer = null;
	}
}

function buildChip(descriptor: ChipDescriptor): HTMLSpanElement {
	const chip = document.createElement("span");
	chip.className =
		descriptor.tone === "ok" ? "chip ok" : "chip";
	chip.textContent = descriptor.label;
	return chip;
}

function setChipList(
	container: HTMLElement,
	descriptors: ChipDescriptor[],
	emptyLabel?: string,
): void {
	container.replaceChildren();
	const items =
		descriptors.length > 0
			? descriptors
			: emptyLabel
				? [{ label: emptyLabel }]
				: [];
	for (const descriptor of items) {
		container.appendChild(buildChip(descriptor));
	}
}

function postToKinemaBridge(payload: Record<string, unknown>): boolean {
	if (!isKinemaSurface()) {
		return false;
	}
	const frame = currentKinemaFrame();
	const target = frame.contentWindow;
	if (!target || !frame.src || frame.src === "about:blank") {
		return false;
	}
	target.postMessage(
		{
			source: KINEMA_BRIDGE_SOURCE,
			target: KINEMA_BRIDGE_TARGET,
			...payload,
		},
		kinemaTargetOrigin,
	);
	return true;
}

function requestKinemaSnapshot(): void {
	if (!postToKinemaBridge({ kind: "cartridge:hello" })) {
		return;
	}
	postToKinemaBridge({ kind: "cartridge:snapshot" });
}

function failPendingKinemaCommands(reason: string): void {
	if (pendingKinemaCommands.length === 0) {
		return;
	}
	const expired = pendingKinemaCommands;
	pendingKinemaCommands = [];
	renderKinemaStatus();
	for (const command of expired) {
		addMessage(
			"BotSDK",
			`Failed ${command.commandId.slice(0, 8)}…: ${reason}`,
		);
		void reportKinemaControlResult(command.commandId, "failed", reason);
	}
}

function expirePendingKinemaCommands(): void {
	if (pendingKinemaCommands.length === 0) {
		return;
	}
	const { expired, pending } = expireBufferedKinemaCommands(
		pendingKinemaCommands,
	);
	if (expired.length === 0) {
		return;
	}
	pendingKinemaCommands = pending;
	renderKinemaStatus();
	for (const command of expired) {
		const reason =
			"Timed out waiting for the Kinema bridge to become ready.";
		addMessage(
			"BotSDK",
			`Failed ${command.commandId.slice(0, 8)}…: ${reason}`,
		);
		void reportKinemaControlResult(command.commandId, "failed", reason);
	}
}

function flushPendingKinemaCommands(): void {
	if (!kinemaBridgeReady || pendingKinemaCommands.length === 0) {
		return;
	}
	const { pending } = flushBufferedKinemaCommands(
		pendingKinemaCommands,
		(command) =>
			postToKinemaBridge({
				kind: "cartridge:control",
				commandId: command.commandId,
				control: command.control,
				payload: command.payload,
			}),
	);
	pendingKinemaCommands = pending;
	renderKinemaStatus();
}

function bufferKinemaCommand(
	commandId: string,
	control: string,
	payload: OperatorCommandPayload,
): void {
	pendingKinemaCommands = enqueueBufferedKinemaCommand(
		pendingKinemaCommands,
		{
			commandId,
			control,
			payload,
		},
	);
	renderKinemaStatus();
}

function ensureKinemaSnapshotPolling(): void {
	stopKinemaSnapshotPolling();
	if (!isKinemaSurface() || !currentSessionId || currentEmbedUrl === "about:blank") {
		return;
	}
	requestKinemaSnapshot();
	kinemaPollTimer = setInterval(() => {
		expirePendingKinemaCommands();
		requestKinemaSnapshot();
	}, KINEMA_SNAPSHOT_POLL_MS);
}

function renderKinemaStatus(): void {
	const visible = isKinemaSurface();
	botSdkPanelEl.hidden = !visible;
	if (!visible) {
		return;
	}

	const summary = kinemaBridgeReady
		? `${currentSurfaceTitle} bridge ready${kinemaSnapshot?.run.kind ? ` · ${kinemaSnapshot.run.kind}` : ""}${pendingKinemaCommands.length > 0 ? ` · ${pendingKinemaCommands.length} queued` : ""}`
		: pendingKinemaCommands.length > 0
			? `Waiting for the Kinema control bridge · ${pendingKinemaCommands.length} queued`
			: "Waiting for the Kinema control bridge.";
	botSdkSummaryEl.textContent = summary;

	const telemetryChips: ChipDescriptor[] = [
		{
			label: kinemaBridgeReady ? "bridge ready" : "bridge pending",
			tone: kinemaBridgeReady ? "ok" : "default",
		},
		...(kinemaSnapshot?.run.reviewSpawnKey
			? [{ label: kinemaSnapshot.run.reviewSpawnKey }]
			: []),
		...(kinemaSnapshot?.render
			? [{ label: kinemaSnapshot.render.graphicsProfile }]
			: []),
		...(kinemaSnapshot?.render
			? [{ label: kinemaSnapshot.render.rendererBackend }]
			: []),
		...(kinemaSnapshot?.editor
			? [
					{
						label: kinemaSnapshot.editor.active
							? "editor active"
							: "editor hidden",
					},
				]
			: []),
		...(pendingKinemaCommands.length > 0
			? [{ label: `${pendingKinemaCommands.length} queued` }]
			: []),
	];
	setChipList(botSdkTelemetryEl, telemetryChips);
	renderKinemaControlGrid();
}

function buildControlButton(
	label: string,
	onClick: () => Promise<void> | void,
): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = label;
	button.addEventListener("click", () => {
		void onClick();
	});
	return button;
}

async function queueKinemaControl(
	control: string,
	payload: OperatorCommandPayload = {},
	note?: string,
): Promise<void> {
	if (!currentSessionId) {
		addMessage("BotSDK", "Cannot queue control without an active session.");
		return;
	}
	const response = await electrobun.rpc!.request.executeControl({
		sessionId: currentSessionId,
		control,
		payload,
		note,
	});
	if (response.success) {
		addMessage("BotSDK", `Queued ${control} (${response.commandId.slice(0, 8)}…).`);
		return;
	}
	addMessage("BotSDK", `Failed to queue ${control}: ${response.error}`);
}

function renderKinemaControlGrid(): void {
	botSdkControlsEl.innerHTML = "";
	if (!isKinemaSurface()) {
		return;
	}

	const controlSet = new Set(currentSessionControls);
	const buttons: HTMLButtonElement[] = [];

	if (controlSet.has("start-procedural-run")) {
		buttons.push(
			buildControlButton("Play", async () => {
				const spawn = window.prompt(
					"Optional review spawn key (blank for default run)",
					"entrance",
				);
				if (spawn === null) {
					return;
				}
				await queueKinemaControl(
					"start-procedural-run",
					spawn.trim() ? { spawn: spawn.trim() } : {},
					spawn.trim()
						? `Start Kinema procedural run at ${spawn.trim()}`
						: "Start Kinema procedural run",
				);
			}),
		);
	}

	if (controlSet.has("jump-to-station")) {
		buttons.push(
			buildControlButton("Station…", async () => {
				const station = window.prompt("Review spawn / station key", "vehicles");
				if (!station?.trim()) {
					return;
				}
				await queueKinemaControl(
					"jump-to-station",
					{ station: station.trim() },
					`Jump Kinema to station ${station.trim()}`,
				);
			}),
		);
	}

	if (controlSet.has("reset-run")) {
		buttons.push(
			buildControlButton("Reset", () =>
				queueKinemaControl("reset-run", {}, "Restart Kinema run"),
			),
		);
	}

	if (controlSet.has("toggle-editor")) {
		buttons.push(
			buildControlButton("Editor", () =>
				queueKinemaControl("toggle-editor", {}, "Toggle Kinema editor"),
			),
		);
	}

	if (controlSet.has("toggle-render-path")) {
		buttons.push(
			buildControlButton("Graphics", () =>
				queueKinemaControl(
					"toggle-render-path",
					{},
					"Cycle Kinema graphics profile",
				),
			),
		);
	}

	if (controlSet.has("move")) {
		buttons.push(
			buildControlButton("Forward", () =>
				queueKinemaControl(
					"move",
					{ moveX: 0, moveY: 1, frames: 24 },
					"Kinema forward input burst",
				),
			),
		);
		buttons.push(
			buildControlButton("Left", () =>
				queueKinemaControl(
					"move",
					{ moveX: -1, moveY: 0, frames: 24 },
					"Kinema strafe-left input burst",
				),
			),
		);
		buttons.push(
			buildControlButton("Right", () =>
				queueKinemaControl(
					"move",
					{ moveX: 1, moveY: 0, frames: 24 },
					"Kinema strafe-right input burst",
				),
			),
		);
		buttons.push(
			buildControlButton("Back", () =>
				queueKinemaControl(
					"move",
					{ moveX: 0, moveY: -1, frames: 24 },
					"Kinema backward input burst",
				),
			),
		);
	}

	if (controlSet.has("jump")) {
		buttons.push(
			buildControlButton("Jump", () =>
				queueKinemaControl("jump", {}, "Trigger Kinema jump input"),
			),
		);
	}

	if (controlSet.has("interact")) {
		buttons.push(
			buildControlButton("Interact", () =>
				queueKinemaControl(
					"interact",
					{ frames: 90 },
					"Trigger Kinema interact input",
				),
			),
		);
	}

	if (controlSet.has("look")) {
		buttons.push(
			buildControlButton("Look…", async () => {
				const raw = window.prompt("Pitch yaw", "-0.2 0.12");
				if (!raw?.trim()) {
					return;
				}
				const [pitchRaw, yawRaw] = raw.trim().split(/\s+/);
				const pitch = Number(pitchRaw);
				const yaw = Number(yawRaw);
				if (!Number.isFinite(pitch) || !Number.isFinite(yaw)) {
					addMessage("BotSDK", "Look expects: pitch yaw");
					return;
				}
				await queueKinemaControl(
					"look",
					{ pitch, yaw },
					`Set Kinema camera look to pitch ${pitch}, yaw ${yaw}`,
				);
			}),
		);
	}

	buttons.push(
		buildControlButton("Snapshot", async () => {
			requestKinemaSnapshot();
			addMessage("BotSDK", "Requested a fresh Kinema telemetry snapshot.");
		}),
	);

	for (const button of buttons) {
		botSdkControlsEl.appendChild(button);
	}
}

async function reportKinemaTelemetry(
	frames: AppendTelemetryInput,
): Promise<void> {
	if (!currentSessionId || frames.length === 0) {
		return;
	}
	await electrobun.rpc!.request.reportTelemetry({
		sessionId: currentSessionId,
		frames,
	});
}

async function reportKinemaControlResult(
	commandId: string,
	status: "executed" | "failed",
	result?: string,
): Promise<void> {
	if (!currentSessionId) {
		return;
	}
	await electrobun.rpc!.request.reportControlResult({
		sessionId: currentSessionId,
		commandId,
		status,
		result,
	});
}

function handleKinemaSnapshot(snapshot: KinemaBridgeSnapshot): void {
	kinemaSnapshot = snapshot;
	renderKinemaStatus();
	void reportKinemaTelemetry(buildKinemaTelemetryFrames(snapshot));
}

function isKinemaBridgeMessage(data: unknown): data is KinemaBridgeIncomingMessage {
	return Boolean(
		data &&
			typeof data === "object" &&
			"source" in data &&
			(data as { source?: string }).source === KINEMA_BRIDGE_TARGET &&
			"kind" in data,
	);
}

window.addEventListener("message", (event) => {
	if (!isKinemaSurface()) {
		return;
	}
	if (event.source !== currentKinemaFrame().contentWindow) {
		return;
	}
	if (!isKinemaBridgeMessage(event.data)) {
		return;
	}

	if (event.data.kind === "kinema:ready") {
		if (!kinemaBridgeReady) {
			addMessage(
				"BotSDK",
				`Kinema bridge ready${event.data.capabilities.length > 0 ? ` · ${event.data.capabilities.join(", ")}` : ""}`,
			);
		}
		kinemaBridgeReady = true;
		renderKinemaStatus();
		flushPendingKinemaCommands();
		return;
	}

	if (event.data.kind === "kinema:snapshot") {
		kinemaBridgeReady = true;
		handleKinemaSnapshot(event.data.snapshot);
		flushPendingKinemaCommands();
		return;
	}

	if (event.data.kind === "kinema:result") {
		kinemaBridgeReady = true;
		if (event.data.snapshot) {
			handleKinemaSnapshot(event.data.snapshot);
		}
		addMessage(
			"BotSDK",
			`${event.data.success ? "Executed" : "Failed"} ${event.data.commandId.slice(0, 8)}…${event.data.message ? `: ${event.data.message}` : ""}`,
		);
		void reportKinemaControlResult(
			event.data.commandId,
			event.data.success ? "executed" : "failed",
			event.data.message,
		);
		flushPendingKinemaCommands();
	}
});

const windowTitleEl = document.getElementById("window-title") as HTMLHeadingElement;
const surfaceSummaryEl = document.getElementById("surface-summary") as HTMLParagraphElement;
const surfaceMetaEl = document.getElementById("surface-meta") as HTMLDivElement;
const gameViewportEl = document.getElementById("game-viewport") as HTMLDivElement;
const gamePaneLabelAEl = document.getElementById("game-pane-label-a") as HTMLSpanElement;
const gamePaneLabelBEl = document.getElementById("game-pane-label-b") as HTMLSpanElement;
const gameFrameAEl = document.getElementById("game-frame-a") as HTMLIFrameElement;
const gameFrameBEl = document.getElementById("game-frame-b") as HTMLIFrameElement;
const gamePaneAEl = document.querySelector(".game-pane-a") as HTMLDivElement;
const gamePaneBEl = document.querySelector(".game-pane-b") as HTMLDivElement;
const messageInput = document.getElementById("message-input") as HTMLInputElement;
const sendBtn = document.getElementById("send-main") as HTMLButtonElement;
const messagesDiv = document.getElementById("messages") as HTMLDivElement;
const toggleDetailsBtn = document.getElementById("toggle-details") as HTMLButtonElement;
const detailsDrawer = document.getElementById("details-drawer") as HTMLDivElement;
const sessionSummaryEl = document.getElementById("session-summary") as HTMLParagraphElement;
const sessionMetaEl = document.getElementById("session-meta") as HTMLDivElement;
const sessionControlsEl = document.getElementById("session-controls") as HTMLDivElement;
const sessionRouteEl = document.getElementById("session-route") as HTMLParagraphElement;
const sessionStreamsEl = document.getElementById("session-streams") as HTMLDivElement;
const botSdkPanelEl = document.getElementById("botsdk-panel") as HTMLDivElement;
const botSdkSummaryEl = document.getElementById("botsdk-summary") as HTMLParagraphElement;
const botSdkTelemetryEl = document.getElementById("botsdk-telemetry") as HTMLDivElement;
const botSdkControlsEl = document.getElementById("botsdk-controls") as HTMLDivElement;

function syncDetailsState(): void {
	document.body.dataset["detailsOpen"] = detailsDrawer.hidden ? "false" : "true";
}

async function handleWorkspaceMessage(from: string, message: string): Promise<void> {
	addMessage(from, message);
	if (from !== "Main Workspace" || !isKinemaSurface()) {
		return;
	}
	const parsed = parseKinemaChatCommand(message);
	if (!parsed) {
		return;
	}
	await queueKinemaControl(parsed.control, parsed.payload, parsed.note);
}

const rpc = Electroview.defineRPC<ChildWindowRPC>({
	maxRequestTime: 5000,
	handlers: {
		requests: {},
		messages: {
			receiveMessage: ({ from, message }) => {
				void handleWorkspaceMessage(from, message);
			},
			setWindowInfo: ({ id, title }) => {
				windowTitleEl.textContent = `${title} (#${id})`;
			},
			setSurfaceInfo: ({
				appId,
				title,
				summary,
				category,
				capabilities,
				personas,
			}) => {
				if (currentSurfaceAppId === "kinema" && appId !== "kinema") {
					failPendingKinemaCommands(
						"Workspace navigated away from the Kinema surface.",
					);
				}
				currentSurfaceAppId = appId;
				currentSurfaceTitle = title;
				surfaceSummaryEl.textContent = `${title} · ${category} · ${summary}`;
				setChipList(surfaceMetaEl, [
					{ label: `app:${appId}` },
					...capabilities.map((capability) => ({ label: capability })),
					...personas.map((persona) => ({ label: persona })),
				]);
				renderKinemaStatus();
			},
			setGameViews: ({ agentView, userView, visualFitMode }) => {
				failPendingKinemaCommands(
					"Kinema workspace reloaded before the command bridge became ready.",
				);
				const paneState = buildWorkspacePaneState({ agentView, userView });
				const agentUrl =
					paneState.agentView.url.trim().length > 0
						? paneState.agentView.url.trim()
						: "about:blank";
				currentEmbedUrl = agentUrl;
				kinemaTargetOrigin = normalizeOrigin(agentUrl);
				kinemaBridgeReady = false;
				kinemaSnapshot = null;
				pendingKinemaCommands = [];
				const fitMode: VisualFitMode =
					visualFitMode === "topBand" ? "topBand" : "none";
				gamePaneLabelAEl.textContent = `${paneState.agentView.label} · ${paneState.agentView.controlMode}`;
				gameFrameAEl.src = agentUrl;
				if (paneState.userView) {
					const userUrl =
						paneState.userView.url.trim().length > 0
							? paneState.userView.url.trim()
							: "about:blank";
					gamePaneLabelBEl.textContent = `${paneState.userView.label} · ${paneState.userView.controlMode}`;
					gameFrameBEl.src = userUrl;
					gamePaneBEl.hidden = false;
					gameViewportEl.dataset["split"] = "true";
					mountWorkspaceVisualFit(
						gameViewportEl,
						[
							{ frame: gameFrameAEl, pane: gamePaneAEl },
							{ frame: gameFrameBEl, pane: gamePaneBEl },
						],
						fitMode,
					);
				} else {
					gamePaneLabelBEl.textContent = "User pane";
					gameFrameBEl.src = "about:blank";
					gamePaneBEl.hidden = true;
					gameViewportEl.dataset["split"] = "false";
					mountWorkspaceVisualFit(
						gameViewportEl,
						[{ frame: gameFrameAEl, pane: gamePaneAEl }],
						fitMode,
					);
				}
				ensureKinemaSnapshotPolling();
				renderKinemaStatus();
			},
			setSessionInfo: ({
				sessionId,
				persona,
				status,
				viewer,
				suggestions,
				controls,
				agentName,
				threadTitle,
				screenTitle,
				liveStreams,
				streamScene,
				streamCaptureMode,
				takeoverState,
				controlTransport,
			}) => {
				currentSessionId = sessionId;
				currentSessionControls = controls;
				document.body.dataset["streamCapture"] = streamCaptureMode;
				sessionSummaryEl.textContent = `Session ${sessionId} is ${status} in ${viewer} mode for ${persona}.`;
				setChipList(sessionMetaEl, [
					{ label: `persona:${persona}` },
					{ label: `status:${status}` },
					{ label: `viewer:${viewer}` },
					{
						label:
							streamCaptureMode === "immersive"
								? "fullscreen stream source"
								: "operator view",
					},
					{ label: `takeover:${takeoverState}` },
					...(controlTransport ? [{ label: `transport:${controlTransport}` }] : []),
				]);
				setChipList(sessionControlsEl, [
					...controls.map((control) => ({ label: control })),
					...suggestions.map((suggestion) => ({ label: suggestion })),
				]);
				sessionRouteEl.textContent = `Assigned agent: ${agentName}. Chat route: ${threadTitle}. PiP screen: ${screenTitle}.${streamScene ? ` Stream scene: ${streamScene}.` : ""}`;
				setChipList(
					sessionStreamsEl,
					liveStreams.map((stream) => ({ label: stream })),
					"No live streams routed",
				);
				renderKinemaStatus();
				ensureKinemaSnapshotPolling();
			},
			dispatchOperatorCommand: ({
				commandId,
				control,
				payload,
			}) => {
				if (
					kinemaBridgeReady &&
					postToKinemaBridge({
						kind: "cartridge:control",
						commandId,
						control,
						payload,
					})
				) {
					return;
				}
				bufferKinemaCommand(commandId, control, payload);
				requestKinemaSnapshot();
				addMessage(
					"BotSDK",
					`Queued ${control} (${commandId.slice(0, 8)}…) until the Kinema bridge is ready.`,
				);
			},
		},
	},
});

const electrobun = new Electrobun.Electroview({ rpc });

gameFrameAEl.addEventListener("load", () => {
	if (!isKinemaSurface()) {
		return;
	}
	requestKinemaSnapshot();
});

toggleDetailsBtn.addEventListener("click", () => {
	const willOpen = detailsDrawer.hidden;
	detailsDrawer.hidden = !willOpen;
	toggleDetailsBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
	syncDetailsState();
});

syncDetailsState();

sendBtn.addEventListener("click", async () => {
	const message = messageInput.value.trim();
	if (!message) {
		return;
	}

	await electrobun.rpc!.request.sendToMain({ message });
	addMessage("You", message);
	messageInput.value = "";
});

messageInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		sendBtn.click();
	}
});

function addMessage(from: string, message: string) {
	const emptyState = messagesDiv.querySelector(".empty-state");
	if (emptyState) {
		emptyState.remove();
	}

	const entry = document.createElement("div");
	entry.className = "message-entry";
	const fromEl = document.createElement("span");
	fromEl.className = "from";
	fromEl.textContent = `${from}:`;
	entry.appendChild(fromEl);
	entry.append(` ${message}`);
	messagesDiv.appendChild(entry);
	messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
