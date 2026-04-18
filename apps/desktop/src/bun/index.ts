import {
	CartridgeRuntime,
	type BroadcastAudioBus,
	type BroadcastPermissionState,
	type BroadcastVideoProfile,
	type RuntimeState,
} from "@cartridge/runtime";
import {
	type AppendTelemetryInput,
	type GameSessionRecord,
	type OperatorCommand,
	type OperatorCommandPayload,
	type Persona,
	type SurfaceControlTransport,
	type SurfaceTakeoverState,
	type WorkspaceViewDescriptor,
} from "@cartridge/shared";
import { parseCartridgeDeepLink } from "./cartridge-deep-link";
import Electrobun, {
	ApplicationMenu,
	BrowserView,
	BrowserWindow,
	ContextMenu,
	Screen,
	Tray,
	Utils,
	type ApplicationMenuItemConfig,
	type MenuItemConfig,
	type RPCSchema,
} from "electrobun/bun";
import {
	applyCartridgeNavigationRules,
	attachWebviewMonitor,
	handleCartridgeNativeMenuAction,
	installNativePlatformLayer,
	isAllowedExternalUrl,
} from "./native-platform";
import {
	CartridgeBroadcasterSupervisor,
	maybeRunBroadcasterSidecar,
	type BroadcasterEvent,
} from "./broadcast-sidecar";
import { readHostDiagnostics } from "./host-diagnostics";
import {
	getLocalSurfaceDevConfig,
	getSurfaceWorkspaceVisualFitMode,
} from "./local-surface-config";
import { LocalSurfaceRunner } from "./local-surface-runner";
import {
	createBabylonAgent,
	dispatchSurfaceControlCommand,
	getBabylonOperatorSnapshot,
	refreshSurfaceSessionTelemetry,
	resolveSurfaceWorkspace,
} from "./surface-control-adapter";
import {
	callA2AEndpoint,
	getProtocolWorkbenchSnapshot,
	probeX402Endpoint,
} from "./protocol-workbench";
import {
	createStewardAgent,
	getStewardWorkbenchSnapshot,
	resolveStewardApprovalAction,
} from "./steward-workbench";
import { SurfaceConnectionMonitor } from "./surface-connection-monitor";
import type {
	BabylonAgentCreationInput,
	BabylonAgentCreationResult,
	BabylonOperatorSnapshot,
	ProtocolA2ARequestInput,
	ProtocolA2ARequestResult,
	ProtocolWorkbenchSnapshot,
	ProtocolX402ProbeInput,
	ProtocolWorkbenchX402Snapshot,
	RuntimeShellState,
	StewardAgentCreationInput,
	StewardAgentCreationResult,
	StewardApprovalActionInput,
	StewardApprovalActionResult,
	StewardWorkbenchSnapshot,
	SurfaceConnectionState,
	WorkspaceWindowInfo,
} from "../shared/runtime-shell-state";

if (await maybeRunBroadcasterSidecar()) {
	process.exit(0);
}

const childWindows = new Map<number, BrowserWindow>();
const childSessionIds = new Map<number, string>();
const childWindowKinds = new Map<number, "workspace" | "broadcast-output">();
let nextChildId = 1;
const runtime = new CartridgeRuntime();
const broadcaster = new CartridgeBroadcasterSupervisor({
	onEvent: (event) => {
		handleBroadcasterEvent(event);
		broadcastRuntimeState();
	},
	onError: (error) => {
		runtime.setBroadcastStatus({
			status: "error",
			lastError: error.message,
			logs: [error.message],
		});
		broadcastRuntimeState();
	},
});
const localSurfaceRunner = new LocalSurfaceRunner();
const surfaceConnections = new SurfaceConnectionMonitor({
	onChange: () => {
		broadcastRuntimeState();
	},
});
let broadcastStreamKey: string | null = null;
let broadcastWindowId: number | null = null;

type WindowFrame = { x: number; y: number; width: number; height: number };

type RpcMessageMap = Record<string, object>;

type RpcSend<MessageMap extends RpcMessageMap> = {
	[K in keyof MessageMap]: (message: MessageMap[K]) => void;
};

type RpcBridge<MessageMap extends RpcMessageMap> = {
	send?: RpcSend<MessageMap>;
};

type ShellNavigateMessage = {
	tab: string;
	highlightAppId?: string;
};

type SurfaceContextMenuAction = "shell" | "split" | "window" | "pip";

type SurfaceContextMenuEvent = {
	data?: {
		action?: string;
		data?: {
			kind?: SurfaceContextMenuAction;
			appId?: string;
			persona?: Persona;
			tab?: string;
			text?: string;
		};
	};
};

type OpenUrlEvent = {
	data?: {
		url?: string;
	};
};

type TrayClickEvent = {
	data?: {
		action?: string;
	};
};

type MainWindowRPC = {
	bun: RPCSchema<{
		requests: {
			openChildWindow: {
				params: { appId: string; persona: Persona; title?: string; pip?: boolean };
				response: { id: number; sessionId: string };
			};
			closeChildWindow: {
				params: { id: number };
				response: { success: boolean };
			};
			getRuntimeState: {
				params: {};
				response: RuntimeShellState;
			};
			getBabylonOperatorSnapshot: {
				params: {};
				response: BabylonOperatorSnapshot;
			};
			getProtocolWorkbenchSnapshot: {
				params: {};
				response: ProtocolWorkbenchSnapshot;
			};
			getStewardWorkbenchSnapshot: {
				params: {};
				response: StewardWorkbenchSnapshot;
			};
			createBabylonAgent: {
				params: BabylonAgentCreationInput;
				response: BabylonAgentCreationResult;
			};
			createStewardAgent: {
				params: StewardAgentCreationInput;
				response: StewardAgentCreationResult;
			};
			callA2AEndpoint: {
				params: ProtocolA2ARequestInput;
				response: ProtocolA2ARequestResult;
			};
			probeX402Endpoint: {
				params: ProtocolX402ProbeInput;
				response: ProtocolWorkbenchX402Snapshot;
			};
			resolveStewardApprovalAction: {
				params: StewardApprovalActionInput;
				response: StewardApprovalActionResult;
			};
			sendToChild: {
				params: { id: number; message: string };
				response: { success: boolean };
			};
			sendChatMessage: {
				params: { threadId: string; message: string };
				response: { success: boolean; threadId: string };
			};
			setElizaCloudSessionToken: {
				params: { token: string | null };
				response: { success: boolean };
			};
			clearElizaCloudSession: {
				params: {};
				response: { success: boolean };
			};
			setActiveAiModel: {
				params: { providerId: string | null; modelId: string | null };
				response: { success: boolean };
			};
			refreshAiPlane: {
				params: {};
				response: { success: boolean };
			};
			requestBroadcastPermissions: {
				params: {};
				response: { success: boolean; permissions: BroadcastPermissionState };
			};
			updateBroadcastConfig: {
				params: {
					enabled?: boolean;
					destinationUrl?: string;
					streamKey?: string | null;
					videoProfile?: Partial<BroadcastVideoProfile>;
				};
				response: { success: boolean };
			};
			startBroadcast: {
				params: {};
				response: { success: boolean; reason?: string };
			};
			stopBroadcast: {
				params: {};
				response: { success: boolean };
			};
			setBroadcastAudioBus: {
				params: {
					bus: BroadcastAudioBus;
					enabled?: boolean;
					muted?: boolean;
					gainPct?: number;
				};
				response: { success: boolean };
			};
			revealBroadcastWindow: {
				params: {};
				response: { success: boolean };
			};
			readBroadcastLogs: {
				params: {};
				response: { lines: string[] };
			};
			launchInShell: {
				params: { appId: string; persona: Persona; splitPlay?: boolean };
				response: { sessionId: string };
			};
			clearShellEmbed: {
				params: {};
				response: { success: boolean };
			};
			openExternalUrl: {
				params: { url: string };
				response: { success: boolean };
			};
			readClipboardText: {
				params: {};
				response: { text: string | null };
			};
			writeClipboardText: {
				params: { text: string };
				response: { success: boolean };
			};
			openNativeFileDialog: {
				params: { pickFolders?: boolean };
				response: { paths: string[] };
			};
			showSurfaceContextMenu: {
				params: { appId: string; persona: Persona; displayName: string; packageName: string };
				response: { success: boolean };
			};
		};
		messages: {};
	}>;
	webview: RPCSchema<{
		requests: {};
		messages: {
			receiveMessage: { from: string; message: string };
			runtimeStateUpdated: RuntimeShellState;
			shellNavigate: ShellNavigateMessage;
		};
	}>;
};

type ChildWindowRPC = {
	bun: RPCSchema<{
		requests: {
			sendToMain: {
				params: { message: string };
				response: { success: boolean };
			};
			sendToChild: {
				params: { id: number; message: string };
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
	}>;
		webview: RPCSchema<{
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
				visualFitMode?: "none" | "topBand";
			};
			setSessionInfo: {
				sessionId: string;
				persona: Persona;
				status: GameSessionRecord["status"];
				viewer: GameSessionRecord["viewer"];
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
	}>;
};

const mainRPC = BrowserView.defineRPC<MainWindowRPC>({
	maxRequestTime: 180000,
	handlers: {
		requests: {
			openChildWindow: async ({ appId, persona, title, pip }) =>
				launchWorkspaceWindowForSurface({
					appId,
					persona,
					launchedFrom: "desktop-main",
					title,
					pip,
				}),
			closeChildWindow: ({ id }) => {
				const child = childWindows.get(id);
				if (!child) {
					return { success: false };
				}

				child.close();
				return { success: true };
			},
			getRuntimeState: () => getRuntimeShellState(),
			getBabylonOperatorSnapshot: async () =>
				getBabylonOperatorSnapshot({
					launchUrl: runtime.getSurface("babylon")?.launchUrl ?? null,
				}),
			getProtocolWorkbenchSnapshot: async () => getProtocolWorkbenchSnapshot(),
			getStewardWorkbenchSnapshot: async () => getStewardWorkbenchSnapshot(),
			createBabylonAgent: async (params) => {
				const result = await createBabylonAgent({
					request: params,
					launchUrl: runtime.getSurface("babylon")?.launchUrl ?? null,
				});
				sendMainFeedMessage("Babylon", `Registered ${result.agentId}.`);
				return result;
			},
			createStewardAgent: async (params) => {
				const result = await createStewardAgent({
					request: params,
				});
				sendMainFeedMessage("Steward", `Created ${result.agentId}.`);
				return result;
			},
			callA2AEndpoint: async (params) => {
				const result = await callA2AEndpoint({
					request: params,
				});
				sendMainFeedMessage(
					"A2A",
					result.status === "ok"
						? `Completed ${params.method} against ${result.endpointUrl ?? "unknown endpoint"}.`
						: `A2A request failed: ${result.detail}`,
				);
				return result;
			},
			probeX402Endpoint: async (params) => {
				const result = await probeX402Endpoint(params);
				sendMainFeedMessage(
					"x402",
					result.status === "payment-required"
						? `Payment challenge discovered at ${params.url}.`
						: result.status === "ready"
							? `Endpoint ${params.url} responded without a payment challenge.`
							: `Probe status: ${result.detail}`,
				);
				return result;
			},
			resolveStewardApprovalAction: async (params) => {
				const result = await resolveStewardApprovalAction({
					request: params,
				});
				sendMainFeedMessage(
					"Steward",
					result.detail,
				);
				return result;
			},
			sendToChild: ({ id, message }) => {
				const child = childWindows.get(id);
				if (!child) {
					return { success: false };
				}

				const session = getSessionForWindow(id);
				if (session) {
					runtime.addSessionNote(session.sessionId, `Operator directive: ${message}`);
					runtime.sendChatMessage({
						appId: session.appId,
						sessionId: session.sessionId,
						author: "Operator",
						body: message,
						channel: "ops",
					});
				}

				const childRpc = child.webview.rpc as RpcBridge<ChildWindowRPC["webview"]["messages"]> | undefined;
				childRpc?.send?.receiveMessage?.({
					from: "Main Workspace",
					message,
				});
				sendMainFeedMessage("Operator", message);
				broadcastRuntimeState();
				return { success: true };
			},
			sendChatMessage: ({ threadId, message }) => {
				runtime.sendChatMessage({
					threadId,
					author: "Operator",
					body: message,
				});
				sendMainFeedMessage("Chat", `Posted to ${threadId}`);
				broadcastRuntimeState();
				return { success: true, threadId };
			},
			setElizaCloudSessionToken: ({ token }) => {
				runtime.setElizaCloudSessionToken(token);
				broadcastRuntimeState();
				return { success: true };
			},
			clearElizaCloudSession: () => {
				runtime.clearElizaCloudSession();
				broadcastRuntimeState();
				return { success: true };
			},
			setActiveAiModel: ({ providerId, modelId }) => {
				runtime.setActiveAiModel(providerId, modelId);
				broadcastRuntimeState();
				return { success: true };
			},
			refreshAiPlane: async () => {
				await runtime.refreshAiPlaneProbes();
				broadcastRuntimeState();
				return { success: true };
			},
			requestBroadcastPermissions: () => {
				broadcaster.requestPermissions();
				runtime.setBroadcastStatus({
					status: "permissions_required",
					logs: ["Requesting broadcast permissions from sidecar."],
				});
				broadcastRuntimeState();
				return {
					success: true,
					permissions: runtime.getRuntimeState().broadcast.permissions,
				};
			},
			updateBroadcastConfig: ({ enabled, destinationUrl, streamKey, videoProfile }) => {
				if (streamKey !== undefined) {
					broadcastStreamKey = streamKey?.trim() || null;
				}
				runtime.updateBroadcastConfig({
					enabled,
					destinationUrl,
					streamKeyRef: maskStreamKey(broadcastStreamKey),
					videoProfile,
				});
				broadcaster.updateConfig(runtime.getRuntimeState().broadcast.config);
				broadcastRuntimeState();
				return { success: true };
			},
			startBroadcast: () => {
				const result = startBroadcastFlow();
				broadcastRuntimeState();
				return result;
			},
			stopBroadcast: () => {
				stopBroadcastFlow();
				broadcastRuntimeState();
				return { success: true };
			},
				setBroadcastAudioBus: ({ bus, enabled, muted, gainPct }) => {
					runtime.setBroadcastAudioBus(bus, { enabled, muted, gainPct });
					const next = runtime.getRuntimeState().broadcast.config.audioBuses[bus];
					broadcaster.setAudioBus(bus, next);
					broadcastRuntimeState();
					return { success: true };
				},
				revealBroadcastWindow: () => {
					const success = ensureBroadcastWindowVisible();
					broadcaster.revealWindow();
					broadcastRuntimeState();
					return { success };
				},
			readBroadcastLogs: () => ({
				lines: broadcaster.readLogs(),
			}),
			launchInShell: async ({ appId, persona, splitPlay }) => {
				const { sessionId } = await launchWorkspaceWindowForSurface({
					appId,
					persona,
					launchedFrom: "desktop-main",
					splitPlay: splitPlay === true,
				});
				return { sessionId };
			},
			clearShellEmbed: () => {
				runtime.clearShellEmbed();
				sendMainFeedMessage("System", "Shell embed cleared.");
				broadcastRuntimeState();
				return { success: true };
			},
			openExternalUrl: ({ url }) => {
				if (!isAllowedExternalUrl(url)) {
					sendMainFeedMessage("Security", `Blocked openExternal (${url})`);
					return { success: false };
				}
				return { success: Utils.openExternal(url) };
			},
			readClipboardText: () => ({ text: Utils.clipboardReadText() }),
			writeClipboardText: ({ text }) => {
				Utils.clipboardWriteText(text);
				return { success: true };
			},
			openNativeFileDialog: async ({ pickFolders }) => {
				const paths = await Utils.openFileDialog({
					canChooseFiles: !pickFolders,
					canChooseDirectory: Boolean(pickFolders),
					allowsMultipleSelection: false,
				});
				return { paths };
			},
			showSurfaceContextMenu: ({ appId, persona, displayName, packageName }) => {
				const surface = runtime.getSurface(appId);
				if (!surface) {
					return { success: false };
				}
				ContextMenu.showContextMenu([
					{
						label: `Open “${displayName}” in workspace`,
						action: "cartridge:surface-launch",
						data: { kind: "shell", appId, persona },
					},
					{
						label: "Split play (user + agent)",
						action: "cartridge:surface-launch",
						data: { kind: "split", appId, persona },
					},
					{ type: "separator" },
					{
						label: "Open in workspace window",
						action: "cartridge:surface-launch",
						data: { kind: "window", appId, persona },
					},
					{
						label: "Picture in picture",
						action: "cartridge:surface-launch",
						data: { kind: "pip", appId, persona },
					},
					{ type: "separator" },
					{
						label: "Copy package name",
						action: "cartridge:surface-copy",
						data: { text: packageName },
					},
					{
						label: "Copy deep link (cartridge://)",
						action: "cartridge:surface-copy",
						data: {
							text: `cartridge://open?app=${encodeURIComponent(appId)}&mode=shell&persona=${encodeURIComponent(persona)}`,
						},
					},
				]);
				return { success: true };
			},
		},
		messages: {},
	},
});

const BASE_MAIN_TITLE = "Cartridge";

const mainWindow = new BrowserWindow({
	title: BASE_MAIN_TITLE,
	url: "views://mainview/index.html",
	rpc: mainRPC,
	frame: {
		width: 1420,
		height: 940,
		x: 72,
		y: 72,
	},
	...(process.platform === "darwin"
		? {
				titleBarStyle: "hiddenInset" as const,
				transparent: false,
				passthrough: false,
			}
		: {}),
});

function nativePlatformContext() {
	return {
		sendFeed: sendMainFeedMessage,
		focusMain: () => mainWindow.focus(),
		sendShellNavigate,
	};
}

installCartridgeElectrobunIntegration(mainWindow);

runtime.boot();
broadcaster.updateConfig(runtime.getRuntimeState().broadcast.config);
syncBroadcastSource();
void runtime.refreshDataPlaneFromApis().then(() => {
	broadcastRuntimeState();
});
void runtime
	.refreshAiPlaneProbes()
	.then(() => {
		broadcastRuntimeState();
	});
runtime.subscribe("app.session.started", () => {
	syncBroadcastSource();
	broadcastRuntimeState();
});
runtime.subscribe("app.session.updated", () => {
	syncBroadcastSource();
	broadcastRuntimeState();
});
runtime.subscribe("app.session.ended", () => {
	syncBroadcastSource();
	broadcastRuntimeState();
});
runtime.subscribe("operator.command.enqueued", ({ sessionId, appId, command }) => {
	void handleOperatorCommandDispatch(sessionId, appId, command);
});

mainWindow.webview.on("dom-ready", () => {
	broadcastRuntimeState();
});

process.once("exit", () => {
	localSurfaceRunner.dispose();
});

function createChildWindow(
	id: number,
	session: GameSessionRecord,
	title: string,
	opts?: {
		pip?: boolean;
		kind?: "workspace" | "broadcast-output";
		views?: {
			agentView: WorkspaceViewDescriptor;
			userView: WorkspaceViewDescriptor | null;
		};
	},
) {
	const surface = runtime.getSurface(session.appId);
	if (!surface) {
		throw new Error(`Unknown surface: ${session.appId}`);
	}

	const pip = opts?.pip === true;

	const childRPC = BrowserView.defineRPC<ChildWindowRPC>({
		maxRequestTime: 5000,
		handlers: {
			requests: {
				sendToMain: ({ message }) => {
					const liveSession = getSessionForWindow(id);
					if (liveSession) {
						runtime.addSessionNote(
							liveSession.sessionId,
							`Workspace note (${surface.displayName}): ${message}`,
						);
						runtime.routeWorkspaceMessage(
							liveSession.sessionId,
							surface.displayName,
							message,
						);
					}

					sendMainFeedMessage(surface.displayName, message);
					broadcastRuntimeState();
					return { success: true };
				},
				sendToChild: ({ id: targetId, message }) => {
					const target = childWindows.get(targetId);
					if (!target) {
						return { success: false };
					}

				const targetRpc = target.webview.rpc as RpcBridge<ChildWindowRPC["webview"]["messages"]> | undefined;
					targetRpc?.send?.receiveMessage?.({
						from: surface.displayName,
						message,
					});
					return { success: true };
				},
				executeControl: ({ sessionId, control, payload, note }) => {
					try {
						const command = runtime.enqueueOperatorCommand(sessionId, {
							control,
							payload,
							note,
						});
						return {
							success: true,
							commandId: command.commandId,
						};
					} catch (error) {
						return {
							success: false,
							error: formatLaunchError(error),
						};
					}
				},
				reportControlResult: ({ sessionId, commandId, status, result }) => {
					runtime.markCommandResolved(sessionId, {
						commandId,
						status,
						result,
					});
					return { success: true };
				},
				reportTelemetry: ({ sessionId, frames }) => {
					runtime.appendTelemetry(sessionId, frames);
					return { success: true };
				},
			},
			messages: {},
		},
	});

	const offset = (id - 1) * 24;
	const frame = resolveChildWindowFrame(pip, offset);

	const child = new BrowserWindow({
		title: pip ? `${title} · PIP` : title,
		url: "views://childview/index.html",
		rpc: childRPC,
		frame,
	});

	if (pip) {
		child.setAlwaysOnTop(true);
	}

	childWindows.set(id, child);
	childSessionIds.set(id, session.sessionId);
	childWindowKinds.set(id, opts?.kind ?? "workspace");

	applyCartridgeNavigationRules(child.webview);

	child.webview.on("dom-ready", () => {
		const views = opts?.views ?? {
			agentView: {
				role: "agent",
				label: "Agent pane",
				url: surface.launchUrl?.trim() || "about:blank",
				controlMode: "watch-only",
				capturePriority: "primary",
			},
			userView: null,
		};
		const visualFitMode = getSurfaceWorkspaceVisualFitMode(surface.appId);
		const childRpc = child.webview.rpc as RpcBridge<ChildWindowRPC["webview"]["messages"]> | undefined;
		childRpc?.send?.setWindowInfo?.({ id, title });
		childRpc?.send?.setSurfaceInfo?.({
			appId: surface.appId,
			title: surface.displayName,
			summary: surface.summary,
			category: surface.category,
			capabilities: surface.capabilities,
			personas: surface.personas,
		});
		childRpc?.send?.setGameViews?.({
			agentView: views.agentView,
			userView: views.userView,
			visualFitMode,
		});
		refreshChildWindowState(id);
	});

	attachWebviewMonitor(child.webview, nativePlatformContext());

	child.on("close", () => {
		const liveSession = getSessionForWindow(id);
		const kind = childWindowKinds.get(id) ?? "workspace";
		if (kind === "workspace" && liveSession && liveSession.status !== "ended") {
			runtime.endSession(
				liveSession.sessionId,
				`${surface.displayName} workspace closed`,
			);
		}
		if (broadcastWindowId === id) {
			broadcastWindowId = null;
		}

		childWindows.delete(id);
		childSessionIds.delete(id);
		childWindowKinds.delete(id);
		sendMainFeedMessage("System", `${surface.displayName} window closed.`);
		broadcastRuntimeState();
	});
}

function openWorkspaceWindowForSurface(params: {
	appId: string;
	persona: Persona;
	launchedFrom: string;
	title?: string;
	pip?: boolean;
	splitPlay?: boolean;
	operatorNote?: string;
	launchUrlOverride?: string;
}): { id: number; sessionId: string } {
	runtime.clearShellEmbed();
	const surface = runtime.getSurface(params.appId);
	if (!surface) {
		throw new Error(`Unknown surface: ${params.appId}`);
	}
	const workspace = resolveSurfaceWorkspace({
		surface,
		persona: params.persona,
		splitPlay: params.splitPlay === true,
		launchUrl: params.launchUrlOverride ?? surface.launchUrl,
	});
	const session = runtime.launchSurface({
		appId: params.appId,
		persona: params.persona,
		launchedFrom: params.launchedFrom,
		viewer: "native-window",
		launchUrlOverride: workspace.launchUrlOverride ?? params.launchUrlOverride,
	});
	runtime.setSessionTakeoverState(session.sessionId, workspace.takeoverState);
	if (workspace.sessionNote) {
		runtime.addSessionNote(session.sessionId, workspace.sessionNote);
		sendMainFeedMessage(
			"Surface Control",
			`${surface.displayName}: ${workspace.sessionNote}`,
		);
	}
	const id = nextChildId++;
	let winTitle =
		params.title && params.title.trim().length > 0
			? params.title
			: `${surface.displayName} Workspace`;
	if (params.splitPlay) {
		winTitle = `${surface.displayName} · split`;
	}
	createChildWindow(id, session, winTitle, {
		pip: params.pip === true,
		kind: "workspace",
		views: {
			agentView: workspace.agentView,
			userView: workspace.userView,
		},
	});
	const note =
		params.operatorNote ??
		(params.splitPlay
			? `Workspace ${id} opened with coordinated agent and user panes.`
			: `Window ${id} opened for ${surface.displayName}.`);
	runtime.sendChatMessage({
		appId: params.appId,
		sessionId: session.sessionId,
		author: "Operator",
		body: note,
		channel: "ops",
	});
	let feed = `Workspace: ${surface.displayName}`;
	if (params.pip) {
		feed = `PIP: ${surface.displayName}`;
	} else if (params.splitPlay) {
		feed = `Workspace (split): ${surface.displayName}`;
	}
	sendMainFeedMessage("System", `${feed} (${params.persona}).`);
	broadcastRuntimeState();
	return { id, sessionId: session.sessionId };
}

function maskStreamKey(value: string | null): string | null {
	if (!value) {
		return null;
	}
	const tail = value.slice(-4);
	return `key••••${tail}`;
}

function hasGrantedBroadcastPermissions(
	permissions: BroadcastPermissionState,
): boolean {
	return (
		permissions.screen === "granted" &&
		permissions.systemAudio === "granted" &&
		permissions.microphone === "granted"
	);
}

function openBroadcastWindowForSession(sessionId: string): boolean {
	const state = runtime.getRuntimeState();
	const session = state.sessions.find((entry) => entry.sessionId === sessionId);
	if (!session) {
		return false;
	}
	if (broadcastWindowId && childWindows.has(broadcastWindowId)) {
		if (childSessionIds.get(broadcastWindowId) !== sessionId) {
			closeBroadcastWindow();
		} else {
		childWindows.get(broadcastWindowId)?.focus();
		return true;
		}
	}
	const surface = runtime.getSurface(session.appId);
	if (!surface) {
		return false;
	}
	const id = nextChildId++;
	broadcastWindowId = id;
	createChildWindow(id, session, `${surface.displayName} · Broadcast`, {
		kind: "broadcast-output",
	});
	sendMainFeedMessage("System", `Broadcast output opened for ${surface.displayName}.`);
	return true;
}

function ensureBroadcastWindowVisible(): boolean {
	const source = runtime.getRuntimeState().broadcast.source;
	if (!source.sessionId) {
		return false;
	}
	if (broadcastWindowId && childWindows.has(broadcastWindowId)) {
		childWindows.get(broadcastWindowId)?.focus();
		return true;
	}
	return openBroadcastWindowForSession(source.sessionId);
}

function closeBroadcastWindow(): void {
	if (!broadcastWindowId) {
		return;
	}
	const child = childWindows.get(broadcastWindowId);
	broadcastWindowId = null;
	child?.close();
}

function startBroadcastFlow(): { success: boolean; reason?: string } {
	const state = runtime.getRuntimeState();
	const { config, permissions, source } = state.broadcast;
	if (!hasGrantedBroadcastPermissions(permissions)) {
		runtime.setBroadcastStatus({
			status: "permissions_required",
			lastError: "Broadcast permissions are required before going live.",
			logs: ["Broadcast start blocked by missing permissions."],
		});
		return { success: false, reason: "permissions_required" };
	}
	if (!source.sessionId) {
		runtime.setBroadcastStatus({
			status: "idle",
			lastError: "No active agent gameplay session is available for broadcast.",
			logs: ["Broadcast start blocked by missing source session."],
		});
		return { success: false, reason: "no_source" };
	}
	if (!config.destinationUrl.trim()) {
		runtime.setBroadcastStatus({
			status: "error",
			lastError: "A custom RTMP destination URL is required.",
			logs: ["Broadcast start blocked by missing RTMP destination URL."],
		});
		return { success: false, reason: "missing_destination" };
	}
	if (!broadcastStreamKey) {
		runtime.setBroadcastStatus({
			status: "error",
			lastError: "A stream key is required.",
			logs: ["Broadcast start blocked by missing stream key."],
		});
		return { success: false, reason: "missing_stream_key" };
	}
	runtime.updateBroadcastConfig({
		enabled: true,
		streamKeyRef: maskStreamKey(broadcastStreamKey),
	});
	runtime.setBroadcastStatus({
		status: "starting",
		lastError: null,
		logs: ["Starting broadcast output."],
	});
	ensureBroadcastWindowVisible();
	const next = runtime.getRuntimeState().broadcast;
	broadcaster.updateConfig(next.config);
	broadcaster.setSource(next.source);
	broadcaster.start(next.config, next.source, broadcastStreamKey);
	return { success: true };
}

function stopBroadcastFlow(note = "Stopping broadcast output."): void {
	runtime.updateBroadcastConfig({ enabled: false });
	runtime.setBroadcastStatus({
		status: "stopping",
		lastError: null,
		logs: [note],
	});
	broadcaster.stop();
	closeBroadcastWindow();
}

function syncBroadcastSource(): void {
	const state = runtime.getRuntimeState();
	broadcaster.setSource(state.broadcast.source);
	if (
		(state.broadcast.status === "live" || state.broadcast.status === "starting") &&
		state.broadcast.source.sessionId === null
	) {
		stopBroadcastFlow("Broadcast source disappeared; stopping output.");
		return;
	}
	if (state.broadcast.status === "live" && state.broadcast.source.sessionId) {
		ensureBroadcastWindowVisible();
	}
}

function handleBroadcasterEvent(event: BroadcasterEvent): void {
	const currentStatus = runtime.getRuntimeState().broadcast.status;
	switch (event.type) {
		case "ready":
			runtime.setBroadcastStatus({
				status: currentStatus,
				logs: [event.log],
			});
			break;
		case "permissions":
			runtime.setBroadcastPermissions(event.permissions);
			runtime.setBroadcastStatus({
				status: hasGrantedBroadcastPermissions(event.permissions)
					? currentStatus
					: "permissions_required",
				logs: event.log ? [event.log] : [],
			});
			break;
		case "status":
			runtime.setBroadcastStatus({
				status: event.status,
				lastError: event.lastError ?? null,
				logs: event.log ? [event.log] : [],
			});
			if (event.status === "live") {
				ensureBroadcastWindowVisible();
			}
			if (event.status === "idle") {
				closeBroadcastWindow();
			}
			break;
		case "stats":
			runtime.setBroadcastStatus({
				status: currentStatus,
				health: event.health,
			});
			break;
		case "logs":
			runtime.setBroadcastStatus({
				status: currentStatus,
				logs: event.lines,
			});
			break;
		case "source":
			runtime.setBroadcastStatus({
				status: currentStatus,
				logs: event.log ? [event.log] : [],
			});
			if (runtime.getRuntimeState().broadcast.status === "live") {
				ensureBroadcastWindowVisible();
			}
			break;
	}
}

function handleNativeContextMenuSurface(kind: string, appId: string, persona: Persona): void {
	const surface = runtime.getSurface(appId);
	if (!surface) {
		return;
	}
	if (kind === "shell") {
		void launchWorkspaceWindowForSurface({
			appId,
			persona,
			launchedFrom: "native-context-menu",
		}).catch((error) => {
			reportSurfaceLaunchError(appId, error);
		});
		return;
	}
	if (kind === "split") {
		void launchWorkspaceWindowForSurface({
			appId,
			persona,
			launchedFrom: "native-context-menu",
			splitPlay: true,
		}).catch((error) => {
			reportSurfaceLaunchError(appId, error);
		});
		return;
	}
	if (kind === "window" || kind === "pip") {
		void launchWorkspaceWindowForSurface({
			appId,
			persona,
			launchedFrom: "native-context-menu",
			title: surface.displayName,
			pip: kind === "pip",
		}).catch((error) => {
			reportSurfaceLaunchError(appId, error);
		});
	}
}

Electrobun.events.on("context-menu-clicked", (evt) => {
	const event = evt as SurfaceContextMenuEvent;
	const action = event.data?.action;
	const data = event.data?.data;
	if (action === "cartridge:surface-copy" && typeof data?.text === "string") {
		Utils.clipboardWriteText(data.text);
		sendMainFeedMessage("Clipboard", "Copied from native Store menu.");
		return;
	}
	if (action === "cartridge:surface-launch" && data?.appId && data?.persona && data?.kind) {
		handleNativeContextMenuSurface(data.kind, data.appId, data.persona);
	}
});

function getRuntimeShellState(): RuntimeShellState {
	const state = runtime.getRuntimeState();
	const connectionStates: SurfaceConnectionState[] = surfaceConnections.snapshotFor(
		state.surfaces,
	);
	return {
		...state,
		workspaces: [...childWindows.keys()]
			.map((id) => getWorkspaceWindowInfo(id, state))
			.filter((workspace): workspace is WorkspaceWindowInfo => workspace !== null),
		host: readHostDiagnostics(),
		surfaceConnections: connectionStates,
	};
}

function getSessionForWindow(
	id: number,
	state: RuntimeState = runtime.getRuntimeState(),
): GameSessionRecord | null {
	const sessionId = childSessionIds.get(id);
	if (!sessionId) {
		return null;
	}

	return state.sessions.find((session) => session.sessionId === sessionId) ?? null;
}

function getWorkspaceWindowInfo(
	id: number,
	state: RuntimeState = runtime.getRuntimeState(),
): WorkspaceWindowInfo | null {
	const child = childWindows.get(id);
	const session = getSessionForWindow(id, state);
	if (!child || !session) {
		return null;
	}

	return {
		id,
		title: child.title,
		appId: session.appId,
		sessionId: session.sessionId,
		persona: session.persona,
		status: session.status,
	};
}

function buildChildSessionInfo(
	session: GameSessionRecord,
	state: RuntimeState,
): ChildWindowRPC["webview"]["messages"]["setSessionInfo"] {
	const agent =
		state.agents.find((entry) => entry.activeSessionId === session.sessionId) ??
		state.agents.find((entry) => entry.homeAppId === session.appId);
	const thread =
		state.chatThreads.find((entry) => entry.appId === session.appId) ??
		state.chatThreads.find((entry) => entry.threadId === runtime.getPreferredThreadId(session.appId));
	const screen =
		state.pipScreens.find((entry) => entry.appId === session.appId) ??
		state.pipScreens.find((entry) => entry.sessionId === session.sessionId);
	const liveStreams = state.streams
		.filter(
			(destination) =>
				destination.sessionId === session.sessionId &&
				destination.status !== "offline",
		)
		.map((destination) => `${destination.label} · ${destination.status}`);
	const leadStream =
		state.streams.find(
			(destination) =>
				destination.sessionId === session.sessionId && destination.status === "live",
		) ??
		state.streams.find(
			(destination) =>
				destination.sessionId === session.sessionId && destination.status === "standby",
		) ??
		null;
	const takeoverState =
		leadStream?.takeoverState ??
		screen?.takeoverState ??
		(session.persona === "user-gamer" ? "user-takeover" : "agent-active");
	const controlTransport =
		runtime.getSurface(session.appId)?.workspace?.controlTransport ?? null;

	return {
		sessionId: session.sessionId,
		persona: session.persona,
		status: session.status,
		viewer: session.viewer,
		suggestions: session.suggestions,
		controls: runtime.getOperatorSurface(session.appId)?.controls ?? [],
		agentName: agent?.displayName ?? "Unassigned",
		threadTitle: thread?.title ?? "Ops Bridge",
		screenTitle: screen?.title ?? session.displayName,
		liveStreams,
		streamScene: leadStream?.scene ?? null,
		streamCaptureMode: leadStream?.captureMode ?? "standard",
		takeoverState,
		controlTransport,
	};
}

function refreshChildWindowState(id: number, state = getRuntimeShellState()) {
	const child = childWindows.get(id);
	const session = getSessionForWindow(id, state);
	if (!child || !session) {
		return;
	}

	const childRpc = child.webview.rpc as RpcBridge<ChildWindowRPC["webview"]["messages"]> | undefined;
	childRpc?.send?.setSessionInfo?.(
		buildChildSessionInfo(session, state),
	);
}

function dispatchOperatorCommandToSession(
	sessionId: string,
	command: {
		commandId: string;
		control: string;
		payload: OperatorCommandPayload;
	},
): boolean {
	let dispatched = false;
	for (const [id, child] of childWindows.entries()) {
		if (childSessionIds.get(id) !== sessionId) {
			continue;
		}
		if ((childWindowKinds.get(id) ?? "workspace") !== "workspace") {
			continue;
		}
		const childRpc = child.webview.rpc as RpcBridge<
			ChildWindowRPC["webview"]["messages"]
		> | undefined;
		childRpc?.send?.dispatchOperatorCommand?.({
			sessionId,
			commandId: command.commandId,
			control: command.control,
			payload: command.payload,
		});
		dispatched = true;
	}
	return dispatched;
}

async function handleOperatorCommandDispatch(
	sessionId: string,
	appId: string,
	command: OperatorCommand,
): Promise<void> {
	const state = runtime.getRuntimeState();
	const session =
		state.sessions.find((entry) => entry.sessionId === sessionId) ?? null;
	const surface = runtime.getSurface(appId);
	if (!session || !surface) {
		return;
	}

	if (surface.appId === "kinema") {
		const dispatched = dispatchOperatorCommandToSession(sessionId, command);
		if (!dispatched) {
			runtime.markCommandResolved(sessionId, {
				commandId: command.commandId,
				status: "failed",
				result: "No Kinema workspace is connected to receive the control command.",
			});
		}
		return;
	}

	const result = await dispatchSurfaceControlCommand({
		surface,
		session,
		command,
	});
	if (result.frames && result.frames.length > 0) {
		runtime.appendTelemetry(sessionId, result.frames);
	}
	if (result.takeoverState) {
		runtime.setSessionTakeoverState(sessionId, result.takeoverState);
	}
	if (result.sessionNote) {
		runtime.addSessionNote(sessionId, result.sessionNote);
	}
	runtime.markCommandResolved(sessionId, {
		commandId: command.commandId,
		status: result.status,
		result: result.result,
	});
	if (result.status === "failed") {
		sendMainFeedMessage("Surface Control", `${surface.displayName}: ${result.result}`);
	}
}

function broadcastRuntimeState() {
	const state = getRuntimeShellState();
	syncMainWindowActivityTitle(state);
	const mainRpc = mainWindow.webview.rpc as RpcBridge<MainWindowRPC["webview"]["messages"]> | undefined;
	mainRpc?.send?.runtimeStateUpdated?.(state);
	for (const id of childWindows.keys()) {
		refreshChildWindowState(id, state);
	}
}

function sendMainFeedMessage(from: string, message: string) {
	const mainRpc = mainWindow.webview.rpc as RpcBridge<MainWindowRPC["webview"]["messages"]> | undefined;
	mainRpc?.send?.receiveMessage?.({ from, message });
}

function formatLaunchError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

function reportSurfaceLaunchError(appId: string, error: unknown): void {
	const surface = runtime.getSurface(appId);
	const label = surface?.displayName ?? appId;
	const body = formatLaunchError(error);
	surfaceConnections.noteLaunchFailure(appId, body);
	sendMainFeedMessage("Local Surface", `${label} launch failed: ${body}`);
	Utils.showNotification({
		title: "Cartridge",
		subtitle: `${label} launch failed`,
		body,
		silent: true,
	});
}

async function ensureSurfaceReadyForLaunch(appId: string): Promise<void> {
	const config = getLocalSurfaceDevConfig(appId);
	if (config) {
		surfaceConnections.noteLaunchStart(
			appId,
			`Preparing ${config.displayName} local install/build/dev flow.`,
		);
	}
	await localSurfaceRunner.ensureSurfaceReady(appId, sendMainFeedMessage);
	if (config) {
		surfaceConnections.noteLaunchReady(
			appId,
			`${config.displayName} ready at ${config.readyUrl}`,
		);
	}
}

async function launchWorkspaceWindowForSurface(params: {
	appId: string;
	persona: Persona;
	launchedFrom: string;
	title?: string;
	pip?: boolean;
	splitPlay?: boolean;
	operatorNote?: string;
	launchUrlOverride?: string;
}): Promise<{ id: number; sessionId: string }> {
	await ensureSurfaceReadyForLaunch(params.appId);
	const launched = openWorkspaceWindowForSurface(params);
	const state = runtime.getRuntimeState();
	const session =
		state.sessions.find((entry) => entry.sessionId === launched.sessionId) ?? null;
	const surface = runtime.getSurface(params.appId);
	if (session && surface && surface.appId !== "kinema") {
		try {
			const frames = await refreshSurfaceSessionTelemetry({ surface, session });
			if (frames.length > 0) {
				runtime.appendTelemetry(session.sessionId, frames);
			}
		} catch (error) {
			const message = formatLaunchError(error);
			runtime.addSessionNote(
				session.sessionId,
				`${surface.displayName} telemetry sync degraded: ${message}`,
			);
			sendMainFeedMessage(
				"Surface Control",
				`${surface.displayName} telemetry sync degraded: ${message}`,
			);
		}
	}
	broadcastRuntimeState();
	return launched;
}

function sendShellNavigate(tabOrMsg: string | ShellNavigateMessage): void {
	const msg: ShellNavigateMessage =
		typeof tabOrMsg === "string" ? { tab: tabOrMsg } : tabOrMsg;
	const mainRpc = mainWindow.webview.rpc as RpcBridge<MainWindowRPC["webview"]["messages"]> | undefined;
	mainRpc?.send?.shellNavigate?.(msg);
}

function syncMainWindowActivityTitle(state: RuntimeShellState): void {
	if (typeof mainWindow.setTitle !== "function") {
		return;
	}
	const live = state.workspaces.length;
	mainWindow.setTitle(live > 0 ? `${BASE_MAIN_TITLE} · ${live} live` : BASE_MAIN_TITLE);
}

function setWebviewZoom(win: BrowserWindow, mode: "in" | "out" | "reset"): void {
	if (
		typeof win.webview.getPageZoom !== "function" ||
		typeof win.webview.setPageZoom !== "function"
	) {
		console.warn("[Cartridge] WebKit zoom APIs unavailable.");
		return;
	}

	const zoom = win.webview.getPageZoom();
	if (mode === "reset") {
		win.webview.setPageZoom(1);
		return;
	}

	const nextZoom = mode === "in" ? Math.min(2.5, zoom + 0.1) : Math.max(0.5, zoom - 0.1);
	win.webview.setPageZoom(nextZoom);
}

async function applyCartridgeDeepLink(href: string): Promise<void> {
	const parsed = parseCartridgeDeepLink(href);
	if (!parsed) {
		sendMainFeedMessage("Deep link", `Unsupported URL: ${href}`);
		sendShellNavigate({ tab: "hub" });
		mainWindow.focus();
		return;
	}

	if (parsed.kind === "navigate") {
		sendShellNavigate({
			tab: parsed.tab === "studio" ? "hub" : parsed.tab,
			highlightAppId: parsed.highlightAppId,
		});
		sendMainFeedMessage("Deep link", `Navigate · ${parsed.tab}`);
		mainWindow.focus();
		return;
	}

	const surface = runtime.getSurface(parsed.appId);
	if (!surface) {
		Utils.showNotification({
			title: "Cartridge",
			subtitle: "Unknown surface",
			body: parsed.appId,
			silent: true,
		});
		sendMainFeedMessage("Deep link", `Unknown app id: ${parsed.appId}`);
		sendShellNavigate({ tab: "apps", highlightAppId: parsed.appId });
		mainWindow.focus();
		return;
	}

	let persona = parsed.persona;
	if (!surface.personas.includes(persona)) {
		persona = surface.personas[0] ?? "user-gamer";
	}

	const deepNote = `Opened from deep link (${parsed.mode}).`;
	if (parsed.mode === "shell") {
		await launchWorkspaceWindowForSurface({
			appId: parsed.appId,
			persona,
			launchedFrom: "deep-link",
			operatorNote: deepNote,
		});
	} else if (parsed.mode === "split") {
		await launchWorkspaceWindowForSurface({
			appId: parsed.appId,
			persona,
			launchedFrom: "deep-link",
			splitPlay: true,
			operatorNote: deepNote,
		});
	} else {
		await launchWorkspaceWindowForSurface({
			appId: parsed.appId,
			persona,
			launchedFrom: "deep-link",
			title: surface.displayName,
			pip: parsed.mode === "pip",
			operatorNote: deepNote,
		});
	}
	sendMainFeedMessage("Deep link", `${surface.displayName} · ${parsed.mode} · ${persona}`);
	Utils.showNotification({
		title: "Cartridge",
		subtitle: surface.displayName,
		body: `${parsed.mode} · ${persona}`,
	});
	sendShellNavigate({ tab: "apps", highlightAppId: parsed.appId });
	mainWindow.focus();
}

function installCartridgeElectrobunIntegration(win: BrowserWindow): void {
	const shellMenu: ApplicationMenuItemConfig[] = [
		{
			label: "Cartridge",
			submenu: [
				{ role: "about" },
				{ type: "separator" },
				{ role: "hide" },
				{ role: "hideOthers" },
				{ type: "separator" },
				{ role: "quit" },
			],
		},
		{
			label: "Shell",
			submenu: [
				{
					label: "Chat",
					action: "cartridge:navigate-tab",
					data: { tab: "chat" },
					accelerator: "CmdOrCtrl+1",
				},
				{
					label: "Store",
					action: "cartridge:navigate-tab",
					data: { tab: "apps" },
					accelerator: "CmdOrCtrl+2",
				},
			],
		},
		{
			label: "Edit",
			submenu: [
				{ label: "Read clipboard to feed", action: "cartridge:clipboard-read" },
				{ label: "Copy version string to clipboard", action: "cartridge:copy-version" },
			],
		},
		{
			label: "View",
			submenu: [
				{
					label: "Toggle Developer Tools",
					action: "cartridge:toggle-devtools",
					accelerator: "CmdOrCtrl+Alt+I",
				},
				{ label: "Zoom In", action: "cartridge:zoom-in" },
				{ label: "Zoom Out", action: "cartridge:zoom-out" },
				{ label: "Reset Zoom", action: "cartridge:zoom-reset" },
			],
		},
		{
			label: "Window",
			submenu: [{ role: "minimize" }, { role: "zoom" }],
		},
		{
			label: "Game",
			submenu: [
				{
					label: "Toggle WebGPU overlay (GpuWindow + WGPUView)",
					action: "cartridge:toggle-gpu-overlay",
					accelerator: "CmdOrCtrl+Shift+G",
				},
				{
					label: "Test desktop notification",
					action: "cartridge:test-notification",
				},
				{ type: "separator" },
				{ label: "Check for updates…", action: "cartridge:check-updates" },
				{ label: "Open file…", action: "cartridge:open-file" },
			],
		},
		{
			label: "Help",
			submenu: [
				{ label: "Electrobun documentation", action: "cartridge:open-docs" },
				{ label: "Log session cookie count", action: "cartridge:session-info" },
				{ label: "Demo native context menu…", action: "cartridge:show-native-context-menu" },
			],
		},
	];

	ApplicationMenu.setApplicationMenu(shellMenu);

	Electrobun.events.on("application-menu-clicked", (evt) => {
		const event = evt as SurfaceContextMenuEvent;
		const action = event.data?.action;
		if (
			handleCartridgeNativeMenuAction(action, win, nativePlatformContext())
		) {
			return;
		}
		const nav = event.data?.data;
		if (action === "cartridge:navigate-tab" && typeof nav?.tab === "string") {
			sendShellNavigate(nav.tab);
		}
		if (action === "cartridge:toggle-devtools") {
			win.webview.toggleDevTools();
		}
		if (action === "cartridge:zoom-in") {
			setWebviewZoom(win, "in");
		}
		if (action === "cartridge:zoom-out") {
			setWebviewZoom(win, "out");
		}
		if (action === "cartridge:zoom-reset") {
			setWebviewZoom(win, "reset");
		}
		if (action === "cartridge:test-notification") {
			Utils.showNotification({
				title: "Cartridge",
				body: "Electrobun Utils.showNotification — native desktop ping.",
			});
		}
	});

	Electrobun.events.on("open-url", (evt) => {
		const url = (evt as OpenUrlEvent).data?.url;
		if (typeof url === "string") {
			void applyCartridgeDeepLink(url).catch((error) => {
				sendMainFeedMessage("Deep link", `Launch failed: ${formatLaunchError(error)}`);
			});
		}
	});

	try {
		const tray = new Tray({ title: "Cartridge" });
		tray.setMenu([
			{ type: "normal", label: "Show Cartridge", action: "cartridge:show-main" },
			{ type: "separator" },
			{ type: "normal", label: "Open Store", action: "cartridge:show-apps" },
			{ type: "separator" },
			{ type: "normal", label: "Quit", role: "quit" },
		] as MenuItemConfig[]);
		tray.on("tray-clicked", (evt) => {
			const action = (evt as TrayClickEvent).data?.action;
			if (action === "cartridge:show-main") {
				win.focus();
				sendShellNavigate("chat");
			}
			if (action === "cartridge:show-apps") {
				win.focus();
				sendShellNavigate("apps");
			}
		});
	} catch (err) {
		console.warn("[Cartridge] Tray unavailable:", err);
	}

	installNativePlatformLayer(win, nativePlatformContext());
}

function resolveChildWindowFrame(pip: boolean, offset: number): WindowFrame {
	try {
		const primary = Screen.getPrimaryDisplay();
		if (pip) {
			const w = 420;
			const h = 300;
			return {
				width: w,
				height: h,
				x: Math.round(primary.workArea.x + primary.workArea.width - w - 20),
				y: Math.round(primary.workArea.y + 20),
			};
		}

		const w = Math.max(960, Math.round(primary.workArea.width * 0.92));
		const h = Math.max(640, Math.round(primary.workArea.height * 0.92));
		return {
			width: w,
			height: h,
			x: Math.round(primary.workArea.x + (primary.workArea.width - w) / 2),
			y: Math.round(primary.workArea.y + (primary.workArea.height - h) / 2),
		};
	} catch (err) {
		console.warn(
			pip
				? "[Cartridge] PIP screen frame unavailable, using fallback:"
				: "[Cartridge] workspace screen frame unavailable, using fallback:",
			err,
		);
		return pip
			? { width: 420, height: 300, x: 520 + offset, y: 112 + offset }
			: {
					width: 1280,
					height: 800,
					x: 520 + offset,
					y: 112 + offset,
				};
	}
}

console.log("Cartridge desktop host started.");
