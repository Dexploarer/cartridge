import {
	CartridgeRuntime,
	type RuntimeState,
} from "@cartridge/runtime";
import { type GameSessionRecord, type Persona } from "@cartridge/shared";
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

const childWindows = new Map<number, BrowserWindow>();
const childSessionIds = new Map<number, string>();
let nextChildId = 1;
const runtime = new CartridgeRuntime();

type WindowFrame = { x: number; y: number; width: number; height: number };

type WorkspaceWindowInfo = {
	id: number;
	title: string;
	appId: string;
	sessionId: string;
	persona: Persona;
	status: GameSessionRecord["status"];
};

type RuntimeShellState = RuntimeState & {
	workspaces: WorkspaceWindowInfo[];
};

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
			setGameEmbed: {
				embedUrl: string;
				splitPlay: boolean;
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
			};
		};
	}>;
};

const mainRPC = BrowserView.defineRPC<MainWindowRPC>({
	maxRequestTime: 45000,
	handlers: {
		requests: {
			openChildWindow: ({ appId, persona, title, pip }) =>
				openWorkspaceWindowForSurface({
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
			launchInShell: ({ appId, persona, splitPlay }) => {
				const { sessionId } = openWorkspaceWindowForSurface({
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
void runtime.refreshDataPlaneFromApis().then(() => {
	broadcastRuntimeState();
});
void runtime
	.refreshAiPlaneProbes()
	.then(() => {
		broadcastRuntimeState();
	});
runtime.subscribe("app.session.started", () => {
	broadcastRuntimeState();
});
runtime.subscribe("app.session.updated", () => {
	broadcastRuntimeState();
});
runtime.subscribe("app.session.ended", () => {
	broadcastRuntimeState();
});

mainWindow.webview.on("dom-ready", () => {
	broadcastRuntimeState();
});

function createChildWindow(
	id: number,
	session: GameSessionRecord,
	title: string,
	opts?: { pip?: boolean; splitPlay?: boolean },
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

	applyCartridgeNavigationRules(child.webview);

	child.webview.on("dom-ready", () => {
		const rawUrl = surface.launchUrl?.trim() ?? "";
		const embedUrl = rawUrl.length > 0 ? rawUrl : "about:blank";
		const splitPlay = opts?.splitPlay === true;
		const visualFitMode = surface.appId === "scape" ? "topBand" : "none";
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
		childRpc?.send?.setGameEmbed?.({
			embedUrl,
			splitPlay,
			visualFitMode,
		});
		refreshChildWindowState(id);
	});

	attachWebviewMonitor(child.webview, nativePlatformContext());

	child.on("close", () => {
		const liveSession = getSessionForWindow(id);
		if (liveSession && liveSession.status !== "ended") {
			runtime.endSession(
				liveSession.sessionId,
				`${surface.displayName} workspace closed`,
			);
		}

		childWindows.delete(id);
		childSessionIds.delete(id);
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
}): { id: number; sessionId: string } {
	runtime.clearShellEmbed();
	const surface = runtime.getSurface(params.appId);
	if (!surface) {
		throw new Error(`Unknown surface: ${params.appId}`);
	}
	const session = runtime.launchSurface({
		appId: params.appId,
		persona: params.persona,
		launchedFrom: params.launchedFrom,
		viewer: "native-window",
	});
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
		splitPlay: params.splitPlay === true,
	});
	const note =
		params.operatorNote ??
		(params.splitPlay
			? `Workspace ${id} opened (split: open another window or use OS tiling for side-by-side).`
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

function handleNativeContextMenuSurface(kind: string, appId: string, persona: Persona): void {
	const surface = runtime.getSurface(appId);
	if (!surface) {
		return;
	}
	if (kind === "shell") {
		openWorkspaceWindowForSurface({ appId, persona, launchedFrom: "native-context-menu" });
		return;
	}
	if (kind === "split") {
		openWorkspaceWindowForSurface({
			appId,
			persona,
			launchedFrom: "native-context-menu",
			splitPlay: true,
		});
		return;
	}
	if (kind === "window" || kind === "pip") {
		openWorkspaceWindowForSurface({
			appId,
			persona,
			launchedFrom: "native-context-menu",
			title: surface.displayName,
			pip: kind === "pip",
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
	return {
		...runtime.getRuntimeState(),
		workspaces: [...childWindows.keys()]
			.map((id) => getWorkspaceWindowInfo(id))
			.filter((workspace): workspace is WorkspaceWindowInfo => workspace !== null),
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
				destination.appId === session.appId && destination.status !== "offline",
		)
		.map((destination) => `${destination.label} · ${destination.status}`);

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

function applyCartridgeDeepLink(href: string): void {
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
		openWorkspaceWindowForSurface({
			appId: parsed.appId,
			persona,
			launchedFrom: "deep-link",
			operatorNote: deepNote,
		});
	} else if (parsed.mode === "split") {
		openWorkspaceWindowForSurface({
			appId: parsed.appId,
			persona,
			launchedFrom: "deep-link",
			splitPlay: true,
			operatorNote: deepNote,
		});
	} else {
		openWorkspaceWindowForSurface({
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
			applyCartridgeDeepLink(url);
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
