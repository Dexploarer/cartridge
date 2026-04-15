import type {
	AgentProfile,
	AiLinkStatus,
	AiPlaneState,
	GameSessionRecord,
	ChatThread,
	ChatThreadKind,
	ConnectorState,
	DataStoreRecord,
	ExternalApiSlice,
	KnowledgeDocument,
	LocalModelSlice,
	PiPScreen,
	RuntimeState,
	StreamDestinationState,
} from "@cartridge/runtime";
import {
	ACTIVE_SURFACES,
	type GameAppManifest,
	type Persona,
} from "@cartridge/shared";
import Electrobun, { Electroview } from "electrobun/view";
import { mountOnboarding } from "./onboarding-mount.tsx";

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

type MainWindowRPC = {
	bun: {
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
	};
	webview: {
		requests: {};
		messages: {
			receiveMessage: { from: string; message: string };
			runtimeStateUpdated: RuntimeShellState;
			shellNavigate: { tab: string; highlightAppId?: string };
		};
	};
};

type TabId = "chat" | "apps";

function normalizeShellTab(raw: string): TabId {
	const t = raw === "studio" ? "hub" : raw;
	if (t === "apps" || t === "store") {
		return "apps";
	}
	return "chat";
}

const rpc = Electroview.defineRPC<MainWindowRPC>({
	maxRequestTime: 45000,
	handlers: {
		requests: {},
		messages: {
			receiveMessage: ({ from, message }) => {
				addSystemFeedEntry(from, message);
			},
			runtimeStateUpdated: (state) => {
				renderRuntimeShellState(state);
			},
			shellNavigate: ({ tab, highlightAppId }) => {
				switchToTab(normalizeShellTab(tab));
				if (highlightAppId) {
					queueMicrotask(() => {
						highlightStoreApp(highlightAppId!);
					});
				}
			},
		},
	},
});

const electrobun = new Electrobun.Electroview({ rpc });

const els = {
	personaSelect: document.getElementById("persona-select") as HTMLSelectElement,
	primaryApps: document.getElementById("primary-apps") as HTMLDivElement,
	supportApps: document.getElementById("support-apps") as HTMLDivElement,
	childList: document.getElementById("child-list") as HTMLDivElement,
	targetSelect: document.getElementById("target-window") as HTMLSelectElement,
	messageInput: document.getElementById("message-input") as HTMLInputElement,
	sendBtn: document.getElementById("send-btn") as HTMLButtonElement,
	messagesDiv: document.getElementById("messages") as HTMLDivElement,
	agentsList: document.getElementById("agents-list") as HTMLDivElement,
	connectorsList: document.getElementById("connectors-list") as HTMLDivElement,
	streamsList: document.getElementById("streams-list") as HTMLDivElement,
	pipGrid: document.getElementById("pip-grid") as HTMLDivElement,
	threadList: document.getElementById("thread-list") as HTMLDivElement,
	threadPanelTitle: document.getElementById("thread-panel-title") as HTMLHeadingElement,
	threadPanelSummary: document.getElementById("thread-panel-summary") as HTMLParagraphElement,
	chatMessages: document.getElementById("chat-messages") as HTMLDivElement,
	chatInput: document.getElementById("chat-input") as HTMLInputElement,
	sendChatBtn: document.getElementById("send-chat-btn") as HTMLButtonElement,
	runtimeLocation: document.getElementById("runtime-location") as HTMLSpanElement,
	runtimeCloud: document.getElementById("runtime-cloud") as HTMLSpanElement,
	runtimeSessions: document.getElementById("runtime-sessions") as HTMLSpanElement,
	runtimeConnectors: document.getElementById("runtime-connectors") as HTMLSpanElement,
	statKnowledgeCount: document.getElementById("stat-knowledge-count") as HTMLSpanElement,
	statDataCount: document.getElementById("stat-data-count") as HTMLSpanElement,
	dataPlaneHint: document.getElementById("data-plane-hint") as HTMLParagraphElement | null,
	catalogKv: document.getElementById("catalog-kv") as HTMLDListElement,
	knowledgeList: document.getElementById("knowledge-list") as HTMLDivElement,
	dataStoreList: document.getElementById("data-store-list") as HTMLDivElement,
	elizaDashLink: document.getElementById("eliza-dash-link") as HTMLAnchorElement,
	elizaCloudStatus: document.getElementById("eliza-cloud-status") as HTMLDivElement,
	elizaTokenInput: document.getElementById("eliza-token-input") as HTMLInputElement,
	btnElizaApply: document.getElementById("btn-eliza-apply") as HTMLButtonElement,
	btnElizaSignout: document.getElementById("btn-eliza-signout") as HTMLButtonElement,
	btnRefreshAi: document.getElementById("btn-refresh-ai") as HTMLButtonElement,
	externalAiList: document.getElementById("external-ai-list") as HTMLDivElement,
	localAiList: document.getElementById("local-ai-list") as HTMLDivElement,
	aiProbeError: document.getElementById("ai-probe-error") as HTMLParagraphElement,
	aiProviderSelect: document.getElementById("ai-provider-select") as HTMLSelectElement,
	aiModelSelect: document.getElementById("ai-model-select") as HTMLSelectElement,
	btnAiSave: document.getElementById("btn-ai-save") as HTMLButtonElement,
	appsSearch: document.getElementById("apps-search") as HTMLInputElement,
	appsRefresh: document.getElementById("apps-refresh") as HTMLButtonElement,
	appsActiveOnly: document.getElementById("apps-active-only") as HTMLButtonElement,
	appsCountPrimary: document.getElementById("apps-count-primary") as HTMLSpanElement,
	appsCountSupport: document.getElementById("apps-count-support") as HTMLSpanElement,
	storeFeaturedStrip: document.getElementById("store-featured-strip") as HTMLDivElement,
	btnHostDocs: document.getElementById("btn-host-docs") as HTMLButtonElement,
	btnHostClipboard: document.getElementById("btn-host-clipboard") as HTMLButtonElement,
	btnHostFile: document.getElementById("btn-host-file") as HTMLButtonElement,
	studioCommandDeck: document.getElementById("studio-command-deck") as HTMLDivElement,
	chatIntelStrip: document.getElementById("chat-intel-strip") as HTMLDivElement,
	threadFilterBar: document.getElementById("thread-filter-bar") as HTMLDivElement,
	elizaModelRail: document.getElementById("eliza-model-rail") as HTMLDivElement,
	elizaRailHint: document.getElementById("eliza-rail-hint") as HTMLParagraphElement,
	panelApps: document.getElementById("panel-apps") as HTMLElement,
};

const PROVIDER_LABELS: Record<string, string> = {
	"eliza-cloud": "ElizaOS Cloud",
	openai: "OpenAI",
	anthropic: "Anthropic",
	"custom-openai": "Custom (OpenAI-compatible)",
	ollama: "Ollama",
	"lm-studio": "LM Studio",
};

let currentState: RuntimeShellState | null = null;
let activeThreadId: string | null = null;
let appsSearchQuery = "";
let appsActiveOnly = false;
let chatThreadFilter: ChatThreadKind | "all" = "all";

initTabs();

els.threadFilterBar.addEventListener("click", (e) => {
	const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-thread-filter]");
	const v = btn?.dataset["threadFilter"] as ChatThreadKind | "all" | undefined;
	if (!v || v === chatThreadFilter) {
		return;
	}
	chatThreadFilter = v;
	if (currentState) {
		const vis = filterThreads(currentState.chatThreads);
		if (!vis.some((t) => t.threadId === activeThreadId)) {
			activeThreadId = vis[0]?.threadId ?? null;
		}
		renderThreadFilterUi();
		renderThreads(vis);
		renderActiveThread();
	} else {
		renderThreadFilterUi();
	}
});

els.studioCommandDeck.addEventListener("click", (e) => {
	void handleStudioDeckClick(e);
});
els.elizaModelRail.addEventListener("click", (e) => {
	void handleElizaModelRailClick(e);
});

els.panelApps.addEventListener("contextmenu", (e) => {
	const row = (e.target as HTMLElement).closest("[data-store-app-id]") as HTMLElement | null;
	if (!row) {
		return;
	}
	e.preventDefault();
	const appId = row.dataset["storeAppId"];
	const displayName = row.dataset["storeDisplayName"] ?? "";
	const packageName = row.dataset["storePackage"] ?? "";
	if (!appId) {
		return;
	}
	void electrobun.rpc!.request.showSurfaceContextMenu({
		appId,
		persona: getSelectedPersona(),
		displayName,
		packageName,
	});
});

document.addEventListener("keydown", (e) => {
	if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
		const t = e.target as HTMLElement;
		if (t.closest("input, textarea, select, [contenteditable=true]")) {
			return;
		}
		e.preventDefault();
		switchToTab("apps");
		els.appsSearch.focus();
		els.appsSearch.select();
	}
});

renderAppsCatalog();
void hydrateRuntimeState();

els.personaSelect.addEventListener("change", () => {
	renderAppsCatalog();
});

els.sendBtn.addEventListener("click", async () => {
	const targetId = Number(els.targetSelect.value);
	const message = els.messageInput.value.trim();
	if (!targetId || !message) {
		return;
	}

	await electrobun.rpc!.request.sendToChild({ id: targetId, message });
	els.messageInput.value = "";
});

els.messageInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		els.sendBtn.click();
	}
});

els.sendChatBtn.addEventListener("click", async () => {
	const message = els.chatInput.value.trim();
	if (!message || !activeThreadId) {
		return;
	}

	await electrobun.rpc!.request.sendChatMessage({
		threadId: activeThreadId,
		message,
	});
	els.chatInput.value = "";
});

els.chatInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		els.sendChatBtn.click();
	}
});

els.btnRefreshAi.addEventListener("click", async () => {
	els.btnRefreshAi.disabled = true;
	try {
		await electrobun.rpc!.request.refreshAiPlane({});
	} finally {
		els.btnRefreshAi.disabled = false;
	}
});

els.btnElizaApply.addEventListener("click", async () => {
	const token = els.elizaTokenInput.value.trim();
	if (!token) {
		return;
	}
	await electrobun.rpc!.request.setElizaCloudSessionToken({ token });
	els.elizaTokenInput.value = "";
});

els.btnElizaSignout.addEventListener("click", async () => {
	await electrobun.rpc!.request.clearElizaCloudSession({});
	els.elizaTokenInput.value = "";
});

els.aiProviderSelect.addEventListener("change", () => {
	if (!currentState) {
		return;
	}
	populateModelSelectForProvider(currentState.aiPlane, els.aiProviderSelect.value);
});

els.btnAiSave.addEventListener("click", async () => {
	const providerId = els.aiProviderSelect.value || null;
	const modelId = els.aiModelSelect.value || null;
	await electrobun.rpc!.request.setActiveAiModel({
		providerId,
		modelId,
	});
});

els.btnHostDocs.addEventListener("click", async () => {
	const { success } = await electrobun.rpc!.request.openExternalUrl({
		url: "https://electrobun.dev",
	});
	addSystemFeedEntry("Host", success ? "Opened Electrobun docs in the system browser." : "openExternal blocked or failed.");
});

els.btnHostClipboard.addEventListener("click", async () => {
	const { text } = await electrobun.rpc!.request.readClipboardText({});
	addSystemFeedEntry("Clipboard", text ?? "(empty)");
});

els.btnHostFile.addEventListener("click", async () => {
	const { paths } = await electrobun.rpc!.request.openNativeFileDialog({});
	addSystemFeedEntry("File", paths.length ? paths.join(", ") : "(cancelled)");
});

els.appsSearch.addEventListener("input", () => {
	appsSearchQuery = els.appsSearch.value;
	renderAppsCatalog();
});

els.appsRefresh.addEventListener("click", () => {
	void hydrateRuntimeState();
});

els.appsActiveOnly.addEventListener("click", () => {
	appsActiveOnly = !appsActiveOnly;
	els.appsActiveOnly.classList.toggle("is-active", appsActiveOnly);
	renderAppsCatalog();
});

function initTabs(): void {
	const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".nav-rail-btn"));
	const panels = Array.from(document.querySelectorAll<HTMLElement>(".tab-panel"));

	for (const btn of buttons) {
		btn.addEventListener("click", () => {
			const tab = btn.dataset["tab"] as TabId | undefined;
			if (!tab) {
				return;
			}

			for (const b of buttons) {
				b.classList.toggle("is-active", b === btn);
			}

			for (const panel of panels) {
				const match = panel.dataset["panel"] === tab;
				panel.hidden = !match;
				panel.classList.toggle("is-active", match);
			}
		});
	}
}

function switchToTab(tab: TabId): void {
	const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".nav-rail-btn"));
	const panels = Array.from(document.querySelectorAll<HTMLElement>(".tab-panel"));
	for (const b of buttons) {
		b.classList.toggle("is-active", b.dataset["tab"] === tab);
	}
	for (const panel of panels) {
		const match = panel.dataset["panel"] === tab;
		panel.hidden = !match;
		panel.classList.toggle("is-active", match);
	}
}

function highlightStoreApp(appId: string): void {
	const nodes = Array.from(document.querySelectorAll("[data-store-app-id]"));
	for (const node of nodes) {
		const el = node as HTMLElement;
		if (el.dataset["storeAppId"] === appId) {
			el.classList.add("store-app-highlight");
			el.scrollIntoView({ behavior: "smooth", block: "nearest" });
			window.setTimeout(() => el.classList.remove("store-app-highlight"), 2400);
			break;
		}
	}
	els.appsSearch.value = appId;
	appsSearchQuery = appId;
	renderAppsCatalog();
	els.appsSearch.focus();
}

function filterThreads(threads: ChatThread[]): ChatThread[] {
	if (chatThreadFilter === "all") {
		return threads;
	}
	return threads.filter((t) => t.kind === chatThreadFilter);
}

function renderThreadFilterUi(): void {
	const buttons = Array.from(
		els.threadFilterBar.querySelectorAll<HTMLButtonElement>("[data-thread-filter]"),
	);
	for (const btn of buttons) {
		const v = btn.dataset["threadFilter"];
		btn.classList.toggle("is-active", v === chatThreadFilter);
	}
}

function renderChatIntelStrip(plane: AiPlaneState): void {
	const eliza = plane.elizaCloud;
	const prov = plane.activeProviderId;
	const model = plane.activeModelId;
	const route =
		prov && model
			? `${PROVIDER_LABELS[prov] ?? prov} · ${model}`
			: "No model selected";
	const elizaShort = statusLabel(eliza.status);
	els.chatIntelStrip.innerHTML = `<div class="chat-intel-line">${escapeHtml(route)} · Eliza ${escapeHtml(elizaShort)}</div>`;
}

async function handleElizaModelRailClick(event: MouseEvent): Promise<void> {
	const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-eliza-model]");
	const id = btn?.dataset["elizaModel"];
	if (!id) {
		return;
	}
	await electrobun.rpc!.request.setActiveAiModel({
		providerId: "eliza-cloud",
		modelId: id,
	});
}

async function handleStudioDeckClick(event: MouseEvent): Promise<void> {
	const t = event.target as HTMLElement;
	const refresh = t.closest<HTMLButtonElement>("[data-studio-refresh-ai]");
	if (refresh) {
		refresh.disabled = true;
		try {
			await electrobun.rpc!.request.refreshAiPlane({});
		} finally {
			refresh.disabled = false;
		}
		return;
	}
	const nav = t.closest<HTMLElement>("[data-studio-nav]");
	const studioNav = nav?.dataset["studioNav"];
	if (studioNav) {
		switchToTab(studioNav === "apps" ? "apps" : "chat");
		return;
	}
	const sess = t.closest<HTMLButtonElement>("[data-session-action]");
	const action = sess?.dataset["sessionAction"];
	if (!action) {
		return;
	}
	if (action === "apps") {
		switchToTab("apps");
		return;
	}
	const appId = sess.dataset["appId"];
	const persona = sess.dataset["persona"] as Persona | undefined;
	if (!appId || !persona) {
		return;
	}
	if (action === "shell") {
		await electrobun.rpc!.request.openChildWindow({
			appId,
			persona,
			title: resolveSurfaceName(appId),
		});
		switchToTab("apps");
		return;
	}
	if (action === "split") {
		await electrobun.rpc!.request.launchInShell({ appId, persona, splitPlay: true });
		switchToTab("apps");
		return;
	}
	if (action === "pip") {
		const title = sess.dataset["displayName"] ?? resolveSurfaceName(appId);
		await electrobun.rpc!.request.openChildWindow({
			appId,
			persona,
			title,
			pip: true,
		});
	}
}

function renderStudioDeck(state: RuntimeShellState): void {
	const plane = state.aiPlane;
	const ec = plane.elizaCloud;
	const routeLabel =
		plane.activeProviderId && plane.activeModelId
			? `${PROVIDER_LABELS[plane.activeProviderId] ?? plane.activeProviderId} · ${plane.activeModelId}`
			: "No preferred route";

	const liveSessions = state.sessions.filter((s) => s.status !== "ended");

	const sessionCards =
		liveSessions.length === 0
			? '<p class="studio-deck-muted">No live sessions — launch from <strong>Apps</strong> or an agent card.</p>'
			: liveSessions
					.map((s) => {
						const cat =
							ACTIVE_SURFACES.find((x) => x.appId === s.appId)?.category ?? "game";
						return `
			<div class="studio-session-card">
				<div class="studio-session-top">
					<strong>${escapeHtml(s.displayName)}</strong>
					<span class="chip">${escapeHtml(s.status)}</span>
					<span class="chip">${escapeHtml(cat)}</span>
					<span class="chip accent">${escapeHtml(formatPersona(s.persona))}</span>
				</div>
				<div class="studio-session-actions">
					<button type="button" class="btn-primary" data-session-action="shell" data-app-id="${escapeHtml(s.appId)}" data-persona="${s.persona}">Workspace</button>
					<button type="button" class="btn-primary" data-session-action="split" data-app-id="${escapeHtml(s.appId)}" data-persona="${s.persona}">Split</button>
					<button type="button" class="btn-secondary" data-session-action="pip" data-app-id="${escapeHtml(s.appId)}" data-persona="${s.persona}" data-display-name="${escapeHtml(s.displayName)}">PIP</button>
					<button type="button" class="btn-secondary" data-session-action="apps">Focus Store</button>
				</div>
			</div>`;
					})
					.join("");

	els.studioCommandDeck.innerHTML = `
		<div class="studio-deck-grid">
			<div class="studio-deck-panel">
				<h3 class="studio-deck-heading">ElizaOS &amp; routing</h3>
				<div class="studio-pill-row">
					<span class="studio-pill ${ec.status === "ok" ? "is-live" : ""}">Cloud: ${escapeHtml(statusLabel(ec.status))}</span>
					<span class="studio-pill">${ec.authenticated ? "Token ready" : "No token"}</span>
					<span class="studio-pill studio-pill-route">${escapeHtml(routeLabel)}</span>
				</div>
				<div class="studio-quick-row">
					<button type="button" class="btn-primary" data-studio-refresh-ai>Refresh AI plane</button>
					<button type="button" class="btn-secondary" data-studio-nav="intelligence">Models &amp; Intel</button>
					<button type="button" class="btn-secondary" data-studio-nav="connect">Agents</button>
					<button type="button" class="btn-secondary" data-studio-nav="apps">Apps &amp; stage</button>
					<button type="button" class="btn-secondary" data-studio-nav="chat">Chat</button>
				</div>
			</div>
			<div class="studio-deck-panel studio-deck-sessions">
				<h3 class="studio-deck-heading">Live sessions</h3>
				<div class="studio-session-list">${sessionCards}</div>
			</div>
		</div>
	`;
}

function renderElizaModelRail(plane: AiPlaneState): void {
	const rail = els.elizaModelRail;
	const hint = els.elizaRailHint;
	const ids = plane.elizaCloud.modelIds;
	rail.innerHTML = "";
	if (ids.length === 0) {
		rail.hidden = true;
		hint.hidden = true;
		return;
	}
	rail.hidden = false;
	hint.hidden = false;
	const active = plane.activeProviderId === "eliza-cloud" ? plane.activeModelId : null;
	for (const id of ids.slice(0, 36)) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "model-chip" + (id === active ? " is-active" : "");
		btn.textContent = id;
		btn.dataset["elizaModel"] = id;
		rail.appendChild(btn);
	}
}

function hasActiveSessionForApp(state: RuntimeShellState, appId: string): boolean {
	return state.sessions.some((s) => s.appId === appId && s.status !== "ended");
}

function renderAppsCatalog(): void {
	const state = currentState;
	const selectedPersona = getSelectedPersona();
	const q = appsSearchQuery.trim().toLowerCase();
	const primary = ACTIVE_SURFACES.filter((surface) => surface.category === "game");
	const support = ACTIVE_SURFACES.filter((surface) => surface.category === "support");

	const filterFn = (surface: GameAppManifest): boolean => {
		if (!surface.personas.includes(selectedPersona)) {
			return false;
		}
		if (appsActiveOnly && state && !hasActiveSessionForApp(state, surface.appId)) {
			return false;
		}
		if (!q) {
			return true;
		}
		const hay = `${surface.displayName} ${surface.summary} ${surface.packageName}`.toLowerCase();
		return hay.includes(q);
	};

	const pf = primary.filter(filterFn);
	const sf = support.filter(filterFn);

	renderStoreFeatured(els.storeFeaturedStrip, pf.slice(0, 3), state);
	renderSurfaceGrid(els.primaryApps, pf, state);
	renderSurfaceGrid(els.supportApps, sf, state);
	els.appsCountPrimary.textContent = String(pf.length);
	els.appsCountSupport.textContent = String(sf.length);
}

function iconGradientCss(appId: string): string {
	let h = 0;
	for (let i = 0; i < appId.length; i++) {
		h = (h * 31 + appId.charCodeAt(i)) >>> 0;
	}
	const hue = h % 360;
	const hue2 = (hue + 52) % 360;
	return `linear-gradient(145deg, hsl(${hue} 58% 42%), hsl(${hue2} 62% 28%))`;
}

function attachSurfaceLaunchHandlers(
	root: HTMLElement,
	surface: GameAppManifest,
	selectedPersona: Persona,
): void {
	const launchAllowed = surface.personas.includes(selectedPersona);

	const shellBtn = root.querySelector('[data-action="shell"]') as HTMLButtonElement | null;
	const shellSplitBtn = root.querySelector('[data-action="shell-split"]') as HTMLButtonElement | null;
	const popBtn = root.querySelector('[data-action="popout"]') as HTMLButtonElement | null;
	const pipBtn = root.querySelector('[data-action="pip"]') as HTMLButtonElement | null;

	for (const b of [shellBtn, shellSplitBtn, popBtn, pipBtn]) {
		if (b) {
			b.disabled = !launchAllowed;
		}
	}

	shellBtn?.addEventListener("click", async () => {
		if (!launchAllowed) {
			return;
		}
		await electrobun.rpc!.request.launchInShell({
			appId: surface.appId,
			persona: selectedPersona,
		});
		switchToTab("apps");
	});

	shellSplitBtn?.addEventListener("click", async () => {
		if (!launchAllowed) {
			return;
		}
		await electrobun.rpc!.request.launchInShell({
			appId: surface.appId,
			persona: selectedPersona,
			splitPlay: true,
		});
		switchToTab("apps");
	});

	popBtn?.addEventListener("click", async () => {
		if (!launchAllowed) {
			return;
		}
		await electrobun.rpc!.request.openChildWindow({
			appId: surface.appId,
			persona: selectedPersona,
			title: surface.displayName,
		});
	});

	pipBtn?.addEventListener("click", async () => {
		if (!launchAllowed) {
			return;
		}
		await electrobun.rpc!.request.openChildWindow({
			appId: surface.appId,
			persona: selectedPersona,
			title: surface.displayName,
			pip: true,
		});
	});
}

function renderStoreFeatured(
	container: HTMLDivElement,
	surfaces: GameAppManifest[],
	state: RuntimeShellState | null,
): void {
	container.innerHTML = "";
	const selectedPersona = getSelectedPersona();
	const withSessions = (appId: string): boolean =>
		state ? hasActiveSessionForApp(state, appId) : false;

	if (surfaces.length === 0) {
		container.hidden = true;
		return;
	}

	container.hidden = false;
	for (const surface of surfaces) {
		const live = withSessions(surface.appId);
		const card = document.createElement("article");
		card.className = "store-hero-card";
		card.dataset["storeAppId"] = surface.appId;
		card.dataset["storeDisplayName"] = surface.displayName;
		card.dataset["storePackage"] = surface.packageName;
		card.style.setProperty("--hero-grad", iconGradientCss(surface.appId));
		card.innerHTML = `
			<div class="store-hero-shine" aria-hidden="true"></div>
			<div class="store-hero-body">
				<span class="store-hero-eyebrow">${live ? "Playing now" : "Featured"} · ElizaOS-ready</span>
				<h3 class="store-hero-name">${escapeHtml(surface.displayName)}</h3>
				<p class="store-hero-desc">${escapeHtml(surface.summary)}</p>
				<div class="store-hero-meta">
					<span class="store-hero-pill">${escapeHtml(surface.session.mode)}</span>
					<span class="store-hero-pill muted">${escapeHtml(surface.category)}</span>
				</div>
				<div class="store-hero-actions">
					<button type="button" class="store-pill-btn store-pill-btn-primary" data-action="shell">Open</button>
					<button type="button" class="store-pill-btn store-pill-btn-ghost" data-action="shell-split">Split</button>
					<button type="button" class="store-pill-btn store-pill-btn-ghost" data-action="popout">Window</button>
					<button type="button" class="store-pill-btn store-pill-btn-ghost" data-action="pip">PIP</button>
				</div>
			</div>
			<div class="store-hero-icon-wrap" aria-hidden="true">
				<div class="store-hero-icon" style="background:${iconGradientCss(surface.appId)}"></div>
			</div>
		`;
		attachSurfaceLaunchHandlers(card, surface, selectedPersona);
		container.appendChild(card);
	}
}

function renderSurfaceGrid(
	container: HTMLDivElement,
	surfaces: GameAppManifest[],
	state: RuntimeShellState | null,
): void {
	container.innerHTML = "";
	const selectedPersona = getSelectedPersona();
	const withSessions = (appId: string): boolean =>
		state ? hasActiveSessionForApp(state, appId) : false;

	if (surfaces.length === 0) {
		container.innerHTML = '<div class="store-empty">No apps match filters.</div>';
		return;
	}

	for (const surface of surfaces) {
		const live = withSessions(surface.appId);
		const card = document.createElement("article");
		card.className = "store-app-row";
		card.dataset["storeAppId"] = surface.appId;
		card.dataset["storeDisplayName"] = surface.displayName;
		card.dataset["storePackage"] = surface.packageName;
		const capShort = surface.capabilities.slice(0, 2).join(" · ");
		card.innerHTML = `
			<div class="store-app-icon" style="background:${iconGradientCss(surface.appId)}" aria-hidden="true"></div>
			<div class="store-app-info">
				<div class="store-app-title-line">
					<h4 class="store-app-name">${escapeHtml(surface.displayName)}</h4>
					${live ? '<span class="store-live-dot" title="Active session"></span>' : ""}
				</div>
				<p class="store-app-subtitle">${escapeHtml(surface.summary)}</p>
				<p class="store-app-publisher">${escapeHtml(surface.packageName)}</p>
				${capShort ? `<p class="store-app-caps">${escapeHtml(capShort)}</p>` : ""}
			</div>
			<div class="store-app-cta">
				<button type="button" class="store-pill-btn store-pill-btn-primary store-pill-compact" data-action="shell">Open</button>
				<div class="store-app-more">
					<button type="button" class="store-icon-btn" data-action="shell-split" title="Split play">◫</button>
					<button type="button" class="store-icon-btn" data-action="popout" title="Workspace">▢</button>
					<button type="button" class="store-icon-btn" data-action="pip" title="PIP">⬚</button>
				</div>
			</div>
		`;
		attachSurfaceLaunchHandlers(card, surface, selectedPersona);
		container.appendChild(card);
	}
}

async function hydrateRuntimeState(): Promise<void> {
	const state = await electrobun.rpc!.request.getRuntimeState({});
	renderRuntimeShellState(state);
}

function renderRuntimeShellState(state: RuntimeShellState): void {
	currentState = state;
	const visibleThreads = filterThreads(state.chatThreads);
	const threadExists = visibleThreads.some((thread) => thread.threadId === activeThreadId);
	if (!threadExists) {
		activeThreadId = visibleThreads[0]?.threadId ?? state.chatThreads[0]?.threadId ?? null;
	}

	renderRuntimeSnapshot(state.runtime);
	renderCatalogSummary(state.catalog);
	renderKnowledge(state.knowledge);
	renderDataStores(state.dataStores);
	renderAgents(state.agents);
	renderConnectors(state.connectors);
	renderStreams(state.streams);
	renderPiPScreens(state.pipScreens);
	renderAiPlane(state.aiPlane);
	renderChatIntelStrip(state.aiPlane);
	renderStudioDeck(state);
	renderAppsCatalog();
	renderThreadFilterUi();
	renderThreads(visibleThreads);
	renderActiveThread();
	renderWorkspaces(state.workspaces);
}

function renderRuntimeSnapshot(snapshot: RuntimeShellState["runtime"]): void {
	els.runtimeLocation.textContent = snapshot.runtimeLocation;
	els.runtimeCloud.textContent = snapshot.cloudEnabled ? "enabled" : "disabled";
	els.runtimeSessions.textContent = `${snapshot.activeSessionCount} / ${snapshot.totalSessionCount}`;
	els.runtimeConnectors.textContent = `${snapshot.connectorCount} / ${snapshot.streamingDestinationCount}`;

	const hint = els.dataPlaneHint;
	if (hint) {
		const err = snapshot.dataPlaneSyncError;
		if (err) {
			hint.hidden = false;
			hint.textContent = `Remote data plane: ${err}`;
		} else {
			hint.hidden = true;
			hint.textContent = "";
		}
	}
}

function renderCatalogSummary(catalog: RuntimeShellState["catalog"]): void {
	els.catalogKv.innerHTML = `
		<dt>Total surfaces</dt><dd>${catalog.totalApps}</dd>
		<dt>Games</dt><dd>${catalog.games}</dd>
		<dt>Support</dt><dd>${catalog.support}</dd>
		<dt>Operator surfaces</dt><dd>${catalog.operatorSurfaces}</dd>
		<dt>Persona coverage</dt><dd>agent ${catalog.personaCoverage["agent-gamer"]} · dev ${catalog.personaCoverage["dev-gamer"]} · user ${catalog.personaCoverage["user-gamer"]}</dd>
	`;
}

function renderKnowledge(docs: KnowledgeDocument[]): void {
	els.statKnowledgeCount.textContent = String(docs.length);
	els.knowledgeList.innerHTML = "";

	if (docs.length === 0) {
		els.knowledgeList.innerHTML = '<div class="empty-state">No indexed documents.</div>';
		return;
	}

	for (const doc of docs) {
		const card = document.createElement("article");
		card.className = "doc-card";
		card.innerHTML = `
			<h4>${doc.title}</h4>
			<p>${doc.excerpt}</p>
			<div class="doc-meta">
				<span>${doc.source}</span>
				<span>scope:${doc.scope}</span>
				<span>~${doc.tokensApprox} tok</span>
				<span>${doc.embeddingModel}</span>
			</div>
		`;
		els.knowledgeList.appendChild(card);
	}
}

function renderDataStores(stores: DataStoreRecord[]): void {
	els.statDataCount.textContent = String(stores.length);
	els.dataStoreList.innerHTML = "";

	for (const store of stores) {
		const card = document.createElement("article");
		card.className = "store-card";
		card.innerHTML = `
			<div class="kind">${store.kind}</div>
			<h4>${store.label}</h4>
			<div class="store-rows">
				<span>Status: <strong>${store.status}</strong></span>
				<span>Region: ${store.region}</span>
				<span>~${store.recordsApprox.toLocaleString()} rows</span>
				<span>Cartridge sync: ${store.syncedWithCartridge ? "yes" : "no"}</span>
			</div>
		`;
		els.dataStoreList.appendChild(card);
	}
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/"/g, "&quot;");
}

function statusLabel(status: AiLinkStatus): string {
	switch (status) {
		case "ok":
			return "Connected";
		case "unknown":
			return "Unknown";
		case "auth_required":
			return "Auth required";
		case "error":
			return "Error";
		case "offline":
			return "Offline";
		default:
			return status;
	}
}

function statusChipClass(status: AiLinkStatus): string {
	switch (status) {
		case "ok":
			return "chip ok";
		case "error":
		case "offline":
			return "chip warn";
		default:
			return "chip";
	}
}

function getModelsForProvider(plane: AiPlaneState, providerId: string): string[] {
	if (providerId === "eliza-cloud") {
		return plane.elizaCloud.modelIds;
	}
	const ext = plane.external.find((e) => e.id === providerId);
	if (ext) {
		return ext.modelIds;
	}
	const loc = plane.local.find((l) => l.id === providerId);
	return loc?.modelIds ?? [];
}

function populateModelSelectForProvider(plane: AiPlaneState, providerId: string): void {
	const models = getModelsForProvider(plane, providerId);
	els.aiModelSelect.innerHTML = "";
	if (models.length === 0) {
		const opt = document.createElement("option");
		opt.value = "";
		opt.textContent = "— no models —";
		els.aiModelSelect.appendChild(opt);
		return;
	}
	for (const id of models) {
		const opt = document.createElement("option");
		opt.value = id;
		opt.textContent = id;
		els.aiModelSelect.appendChild(opt);
	}
}

function populateAiProviderModelSelects(plane: AiPlaneState): void {
	els.aiProviderSelect.innerHTML = "";
	const order: { id: string; label: string }[] = [
		{ id: "eliza-cloud", label: PROVIDER_LABELS["eliza-cloud"]! },
	];
	for (const e of plane.external) {
		order.push({ id: e.id, label: PROVIDER_LABELS[e.id] ?? e.label });
	}
	for (const l of plane.local) {
		order.push({ id: l.id, label: PROVIDER_LABELS[l.id] ?? l.label });
	}

	for (const o of order) {
		const opt = document.createElement("option");
		opt.value = o.id;
		opt.textContent = o.label;
		els.aiProviderSelect.appendChild(opt);
	}

	const wantProv =
		plane.activeProviderId && order.some((o) => o.id === plane.activeProviderId)
			? plane.activeProviderId
			: (order[0]?.id ?? "");
	els.aiProviderSelect.value = wantProv;

	populateModelSelectForProvider(plane, wantProv);

	const models = getModelsForProvider(plane, wantProv);
	const wantModel =
		plane.activeModelId && models.includes(plane.activeModelId)
			? plane.activeModelId
			: (models[0] ?? "");
	els.aiModelSelect.value = wantModel;
}

function renderExternalSlice(slice: ExternalApiSlice): string {
	return `
		<div class="intel-row">
			<div class="intel-row-top">
				<strong>${escapeHtml(slice.label)}</strong>
				<span class="${statusChipClass(slice.status)}">${statusLabel(slice.status)}</span>
			</div>
			<div class="intel-row-meta">
				${slice.configured ? "API key set (env)" : "No API key"} ·
				<span class="intel-mono">${escapeHtml(slice.baseUrl)}</span> ·
				${slice.modelIds.length} models probed
			</div>
			${slice.lastError ? `<div class="intel-err">${escapeHtml(slice.lastError)}</div>` : ""}
		</div>
	`;
}

function renderLocalSlice(slice: LocalModelSlice): string {
	return `
		<div class="intel-row">
			<div class="intel-row-top">
				<strong>${escapeHtml(slice.label)}</strong>
				<span class="${statusChipClass(slice.status)}">${statusLabel(slice.status)}</span>
			</div>
			<div class="intel-row-meta">
				<span class="intel-mono">${escapeHtml(slice.baseUrl)}</span> ·
				${slice.modelIds.length} models probed
			</div>
			${slice.lastError ? `<div class="intel-err">${escapeHtml(slice.lastError)}</div>` : ""}
		</div>
	`;
}

function renderAiPlane(plane: AiPlaneState): void {
	els.elizaDashLink.href = plane.elizaCloud.dashboardUrl;
	const ec = plane.elizaCloud;
	els.elizaCloudStatus.innerHTML = `
		<div class="chips">
			<span class="${statusChipClass(ec.status)}">${statusLabel(ec.status)}</span>
			<span class="chip">${ec.authenticated ? "Token / key ready" : "No token"}</span>
			<span class="chip">${ec.authSource === "env" ? "from env" : ec.authSource === "session" ? "session" : "none"}</span>
			<span class="chip">${ec.modelIds.length} models</span>
			${plane.lastProbeAt ? `<span class="chip">probed ${new Date(plane.lastProbeAt).toLocaleString()}</span>` : ""}
		</div>
		<p class="card-muted" style="margin-top:10px;margin-bottom:0">
			API: <span class="intel-mono">${escapeHtml(ec.apiBaseUrl)}</span> ·
			${ec.scopeNote === "gaming-surfaces-only" ? "Gaming surfaces only" : escapeHtml(ec.scopeNote)}
		</p>
		${ec.lastError ? `<p class="intel-err" style="margin-top:8px">${escapeHtml(ec.lastError)}</p>` : ""}
	`;

	els.externalAiList.innerHTML =
		plane.external.length === 0
			? '<div class="empty-state">No external providers in branding.</div>'
			: plane.external.map((s) => renderExternalSlice(s)).join("");

	els.localAiList.innerHTML =
		plane.local.length === 0
			? '<div class="empty-state">No local endpoints in branding.</div>'
			: plane.local.map((s) => renderLocalSlice(s)).join("");

	if (plane.aggregateProbeError) {
		els.aiProbeError.hidden = false;
		els.aiProbeError.textContent = plane.aggregateProbeError;
	} else {
		els.aiProbeError.hidden = true;
		els.aiProbeError.textContent = "";
	}

	populateAiProviderModelSelects(plane);
	renderElizaModelRail(plane);
}

function renderAgents(agents: AgentProfile[]): void {
	els.agentsList.innerHTML = "";
	for (const agent of agents) {
		const item = document.createElement("div");
		item.className = "stack-item";
		const home = agent.homeAppId;
		const threadId = agent.threadIds[0] ?? null;
		item.innerHTML = `
			<div class="stack-head">
				<span class="stack-title">${escapeHtml(agent.displayName)}</span>
				<span class="chip ${agent.status === "streaming" ? "ok" : ""}">${escapeHtml(agent.status)}</span>
			</div>
			<p class="stack-body">${escapeHtml(agent.role)}. ${escapeHtml(agent.summary)}</p>
			<div class="chips">
				<span class="chip accent">${escapeHtml(formatPersona(agent.persona))}</span>
				${agent.currentAppId ? `<span class="chip">${escapeHtml(resolveSurfaceName(agent.currentAppId))}</span>` : ""}
				${agent.streamDestination ? `<span class="chip">${escapeHtml(agent.streamDestination)}</span>` : ""}
			</div>
			<div class="agent-studio-actions">
				<button type="button" class="btn-secondary btn-tiny" data-agent-thread="${threadId ? escapeHtml(threadId) : ""}" ${threadId ? "" : "disabled"}>Thread</button>
				<button type="button" class="btn-primary btn-tiny" data-agent-shell data-app-id="${home ? escapeHtml(home) : ""}" data-persona="${agent.persona}" ${home ? "" : "disabled"}>Shell</button>
				<button type="button" class="btn-primary btn-tiny" data-agent-split data-app-id="${home ? escapeHtml(home) : ""}" data-persona="${agent.persona}" ${home ? "" : "disabled"}>Split</button>
				<button type="button" class="btn-secondary btn-tiny" data-agent-pip data-app-id="${home ? escapeHtml(home) : ""}" data-persona="${agent.persona}" data-display-name="${escapeHtml(agent.displayName)}" ${home ? "" : "disabled"}>PIP</button>
			</div>
		`;

		const threadBtn = item.querySelector<HTMLButtonElement>("[data-agent-thread]");
		threadBtn?.addEventListener("click", () => {
			if (!threadId) {
				return;
			}
			activeThreadId = threadId;
			chatThreadFilter = "all";
			if (currentState) {
				renderThreadFilterUi();
				renderThreads(filterThreads(currentState.chatThreads));
				renderActiveThread();
			}
			switchToTab("chat");
		});

		const shellBtn = item.querySelector<HTMLButtonElement>("[data-agent-shell]");
		shellBtn?.addEventListener("click", async () => {
			if (!home) {
				return;
			}
			await electrobun.rpc!.request.launchInShell({ appId: home, persona: agent.persona });
			switchToTab("apps");
		});

		const splitBtn = item.querySelector<HTMLButtonElement>("[data-agent-split]");
		splitBtn?.addEventListener("click", async () => {
			if (!home) {
				return;
			}
			await electrobun.rpc!.request.launchInShell({
				appId: home,
				persona: agent.persona,
				splitPlay: true,
			});
			switchToTab("apps");
		});

		const pipBtn = item.querySelector<HTMLButtonElement>("[data-agent-pip]");
		pipBtn?.addEventListener("click", async () => {
			if (!home) {
				return;
			}
			await electrobun.rpc!.request.openChildWindow({
				appId: home,
				persona: agent.persona,
				title: agent.displayName,
				pip: true,
			});
		});

		els.agentsList.appendChild(item);
	}
}

function renderConnectors(connectors: ConnectorState[]): void {
	els.connectorsList.innerHTML = "";
	for (const connector of connectors) {
		const item = document.createElement("div");
		item.className = "stack-item";
		item.innerHTML = `
			<div class="stack-head">
				<span class="stack-title">${connector.label}</span>
				<span class="chip ${connector.status === "connected" ? "ok" : ""}">${connector.status}</span>
			</div>
			<p class="stack-body">${connector.channels.join(" · ")}</p>
			<div class="chips">
				<span class="chip">${connector.mode}</span>
				<span class="chip">${connector.latencyMs}ms</span>
			</div>
		`;
		els.connectorsList.appendChild(item);
	}
}

function renderStreams(streams: StreamDestinationState[]): void {
	els.streamsList.innerHTML = "";
	for (const stream of streams) {
		const item = document.createElement("div");
		item.className = "stack-item";
		item.innerHTML = `
			<div class="stack-head">
				<span class="stack-title">${stream.label}</span>
				<span class="chip ${stream.status === "live" ? "ok" : ""}">${stream.status}</span>
			</div>
			<p class="stack-body">${stream.scene} · ${stream.outputLabel}</p>
			<div class="chips">
				<span class="chip">${stream.destinationType}</span>
				<span class="chip">${stream.viewerCount} viewers</span>
			</div>
		`;
		els.streamsList.appendChild(item);
	}
}

function renderPiPScreens(screens: PiPScreen[]): void {
	els.pipGrid.innerHTML = "";
	for (const screen of screens) {
		const card = document.createElement("div");
		card.className = "pip-screen";
		card.innerHTML = `
			<div class="pip-inner">
				<div class="pip-top">
					<span class="pip-title">${screen.title}</span>
					<span class="chip ${screen.state === "live" ? "ok" : screen.state === "watching" ? "accent" : ""}">${screen.state}</span>
				</div>
				<div class="pip-sub">${screen.subtitle}</div>
				<div class="pip-sub">Focus: ${screen.focus}</div>
				<div class="pip-metrics">
					${screen.metrics
						.map(
							(m) => `
						<div class="metric">
							${m.label}
							<b>${m.value}</b>
						</div>
					`,
						)
						.join("")}
				</div>
			</div>
		`;
		els.pipGrid.appendChild(card);
	}
}

function renderThreads(threads: ChatThread[]): void {
	els.threadList.innerHTML = "";
	for (const thread of threads) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `thread-button${thread.threadId === activeThreadId ? " active" : ""}`;
		const latest = thread.messages[thread.messages.length - 1];
		const previewRaw = String(latest?.body ?? thread.summary ?? "");
		const preview =
			previewRaw.length > 120 ? `${previewRaw.slice(0, 120)}…` : previewRaw;
		button.innerHTML = `
			<div class="thread-item-title">${escapeHtml(thread.title)}</div>
			<div class="thread-preview">${escapeHtml(preview)}</div>
			<div class="thread-item-meta"><span>${escapeHtml(thread.kind)}</span><span>${thread.messages.length}</span></div>
		`;
		button.addEventListener("click", () => {
			activeThreadId = thread.threadId;
			renderThreads(threads);
			renderActiveThread();
		});
		els.threadList.appendChild(button);
	}
}

function renderActiveThread(): void {
	const state = currentState;
	const thread =
		state?.chatThreads.find((entry) => entry.threadId === activeThreadId) ?? null;
	if (!thread) {
		els.threadPanelTitle.textContent = "Chat";
		els.threadPanelSummary.textContent = "";
		els.chatMessages.innerHTML = '<div class="empty-state empty-state-minimal">Choose a thread.</div>';
		els.sendChatBtn.disabled = true;
		return;
	}

	els.sendChatBtn.disabled = false;
	els.threadPanelTitle.textContent = thread.title;
	els.threadPanelSummary.textContent = thread.summary;
	els.chatMessages.innerHTML = "";

	for (const message of thread.messages) {
		const entry = document.createElement("div");
		entry.className = `chat-message${message.author === "System" ? " system" : ""}`;
		entry.innerHTML = `
			<div class="chat-author">${message.author}</div>
			<div>${message.body}</div>
			<div class="chat-stamp">${new Date(message.sentAt).toLocaleTimeString()}</div>
		`;
		els.chatMessages.appendChild(entry);
	}

	els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function renderWorkspaces(workspaces: WorkspaceWindowInfo[]): void {
	els.childList.innerHTML = "";
	els.targetSelect.innerHTML = '<option value="">Select workspace…</option>';

	if (workspaces.length === 0) {
		els.childList.innerHTML = '<div class="empty-state">No workspaces open.</div>';
		return;
	}

	for (const workspace of workspaces) {
		const surface = ACTIVE_SURFACES.find((entry) => entry.appId === workspace.appId);
		const item = document.createElement("div");
		item.className = "child-item";
		item.innerHTML = `
			<div>
				<strong>${workspace.title}</strong>
				<div class="chips" style="margin-top:6px">
					<span class="chip accent">${formatPersona(workspace.persona)}</span>
					<span class="chip">${workspace.status}</span>
					${surface ? `<span class="chip">${surface.category}</span>` : ""}
				</div>
			</div>
			<button type="button" class="btn-danger">Close</button>
		`;

		const closeBtn = item.querySelector("button") as HTMLButtonElement;
		closeBtn.addEventListener("click", async () => {
			await electrobun.rpc!.request.closeChildWindow({ id: workspace.id });
		});

		els.childList.appendChild(item);

		const option = document.createElement("option");
		option.value = String(workspace.id);
		option.textContent = workspace.title;
		els.targetSelect.appendChild(option);
	}
}

function addSystemFeedEntry(from: string, message: string): void {
	const emptyState = els.messagesDiv.querySelector(".empty-state");
	if (emptyState) {
		emptyState.remove();
	}

	const entry = document.createElement("div");
	entry.className = "feed-entry";
	entry.innerHTML = `<span class="from">${from}:</span>${message}`;
	els.messagesDiv.appendChild(entry);
	els.messagesDiv.scrollTop = els.messagesDiv.scrollHeight;
}

function resolveSurfaceName(appId: string): string {
	return ACTIVE_SURFACES.find((surface) => surface.appId === appId)?.displayName ?? appId;
}

function formatPersona(persona: Persona): string {
	return persona
		.split("-")
		.map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
		.join(" ");
}

function getSelectedPersona(): Persona {
	return els.personaSelect.value as Persona;
}

mountOnboarding();
