import type {
	AgentProfile,
	BroadcastAudioBus,
	BroadcastState,
	ChatThread,
	ChatThreadKind,
	ConnectorState,
	PiPScreen,
	StreamDestinationState,
} from "@cartridge/runtime";
import {
	ACTIVE_SURFACES,
	type AiLinkStatus,
	type AiPlaneState,
	type DataStoreRecord,
	type ExternalApiSlice,
	type KnowledgeDocument,
	type LocalModelSlice,
	type GameAppManifest,
	type Persona,
} from "@cartridge/shared";
import Electrobun, { Electroview } from "electrobun/view";
import { mountOnboarding, updateOnboarding } from "./onboarding-mount.tsx";
import {
	hasActiveSessionForApp,
	normalizeShellTab,
	shouldShowBabylonWallet,
	type TabId,
} from "./shell-navigation";
import type {
	BabylonAgentCreationInput,
	BabylonAgentCreationResult,
	BabylonOperatorSnapshot,
	ProtocolA2ARequestInput,
	ProtocolA2ARequestResult,
	ProtocolWorkbenchSnapshot,
	ProtocolWorkbenchX402Snapshot,
	ProtocolX402ProbeInput,
	RuntimeShellState,
	StewardAgentCreationInput,
	StewardAgentCreationResult,
	StewardApprovalActionInput,
	StewardWorkbenchSnapshot,
	SurfaceConnectionState,
	WorkspaceWindowInfo,
} from "../shared/runtime-shell-state";

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
				response: {
					status: "ok" | "error";
					approvalId: string;
					txId: string;
					resolvedStatus: string | null;
					txHash: string | null;
					detail: string;
				};
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
				response: {
					success: boolean;
					permissions: RuntimeShellState["broadcast"]["permissions"];
				};
			};
			updateBroadcastConfig: {
				params: {
					enabled?: boolean;
					destinationUrl?: string;
					streamKey?: string | null;
					videoProfile?: Partial<RuntimeShellState["broadcast"]["config"]["videoProfile"]>;
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
	streamStageShell: document.getElementById("stream-stage-shell") as HTMLElement,
	streamStageEyebrow: document.getElementById("stream-stage-eyebrow") as HTMLParagraphElement,
	streamStageTitle: document.getElementById("stream-stage-title") as HTMLHeadingElement,
	streamStageSummary: document.getElementById("stream-stage-summary") as HTMLParagraphElement,
	streamStageMeta: document.getElementById("stream-stage-meta") as HTMLDivElement,
	streamStageFrame: document.getElementById("stream-stage-frame") as HTMLIFrameElement,
	streamStageThread: document.getElementById("stream-stage-thread") as HTMLButtonElement,
	streamStageTheater: document.getElementById("stream-stage-theater") as HTMLButtonElement,
	broadcastConsoleSummary: document.getElementById("broadcast-console-summary") as HTMLParagraphElement,
	broadcastConsoleChips: document.getElementById("broadcast-console-chips") as HTMLDivElement,
	broadcastDestination: document.getElementById("broadcast-destination") as HTMLInputElement,
	broadcastStreamKey: document.getElementById("broadcast-stream-key") as HTMLInputElement,
	broadcastRequestPermissions: document.getElementById("broadcast-request-permissions") as HTMLButtonElement,
	broadcastStart: document.getElementById("broadcast-start") as HTMLButtonElement,
	broadcastStop: document.getElementById("broadcast-stop") as HTMLButtonElement,
	broadcastReveal: document.getElementById("broadcast-reveal") as HTMLButtonElement,
	broadcastRefreshLogs: document.getElementById("broadcast-refresh-logs") as HTMLButtonElement,
	broadcastBusAppEnabled: document.getElementById("broadcast-bus-app-enabled") as HTMLInputElement,
	broadcastBusAppMuted: document.getElementById("broadcast-bus-app-muted") as HTMLInputElement,
	broadcastBusAppGain: document.getElementById("broadcast-bus-app-gain") as HTMLInputElement,
	broadcastBusSystemEnabled: document.getElementById("broadcast-bus-system-enabled") as HTMLInputElement,
	broadcastBusSystemMuted: document.getElementById("broadcast-bus-system-muted") as HTMLInputElement,
	broadcastBusSystemGain: document.getElementById("broadcast-bus-system-gain") as HTMLInputElement,
	broadcastBusMicEnabled: document.getElementById("broadcast-bus-mic-enabled") as HTMLInputElement,
	broadcastBusMicMuted: document.getElementById("broadcast-bus-mic-muted") as HTMLInputElement,
	broadcastBusMicGain: document.getElementById("broadcast-bus-mic-gain") as HTMLInputElement,
	broadcastLogList: document.getElementById("broadcast-log-list") as HTMLDivElement,
	babylonWorkbench: document.getElementById("babylon-workbench") as HTMLElement,
	babylonWorkbenchSummary: document.getElementById("babylon-workbench-summary") as HTMLParagraphElement,
	babylonWorkbenchChips: document.getElementById("babylon-workbench-chips") as HTMLDivElement,
	babylonRefresh: document.getElementById("babylon-refresh") as HTMLButtonElement,
	babylonBalanceGrid: document.getElementById("babylon-balance-grid") as HTMLDivElement,
	babylonChartLabel: document.getElementById("babylon-chart-label") as HTMLSpanElement,
	babylonChart: document.getElementById("babylon-chart") as HTMLDivElement,
	babylonMarkets: document.getElementById("babylon-markets") as HTMLDivElement,
	babylonTrades: document.getElementById("babylon-trades") as HTMLDivElement,
	babylonTransactions: document.getElementById("babylon-transactions") as HTMLDivElement,
	babylonCreateForm: document.getElementById("babylon-create-form") as HTMLFormElement,
	babylonCreateSummary: document.getElementById("babylon-create-summary") as HTMLParagraphElement,
	babylonCreateId: document.getElementById("babylon-create-id") as HTMLInputElement,
	babylonCreateName: document.getElementById("babylon-create-name") as HTMLInputElement,
	babylonCreateDescription: document.getElementById("babylon-create-description") as HTMLInputElement,
	babylonCreate: document.getElementById("babylon-create") as HTMLButtonElement,
	babylonCreateResult: document.getElementById("babylon-create-result") as HTMLDivElement,
	stewardWorkbench: document.getElementById("steward-workbench") as HTMLElement,
	stewardWorkbenchSummary: document.getElementById("steward-workbench-summary") as HTMLParagraphElement,
	stewardWorkbenchChips: document.getElementById("steward-workbench-chips") as HTMLDivElement,
	stewardRefresh: document.getElementById("steward-refresh") as HTMLButtonElement,
	stewardBalanceGrid: document.getElementById("steward-balance-grid") as HTMLDivElement,
	stewardAgentSummary: document.getElementById("steward-agent-summary") as HTMLDivElement,
	stewardPolicies: document.getElementById("steward-policies") as HTMLDivElement,
	stewardApprovals: document.getElementById("steward-approvals") as HTMLDivElement,
	stewardTransactions: document.getElementById("steward-transactions") as HTMLDivElement,
	stewardTokens: document.getElementById("steward-tokens") as HTMLDivElement,
	stewardWebhooks: document.getElementById("steward-webhooks") as HTMLDivElement,
	stewardCreateForm: document.getElementById("steward-create-form") as HTMLFormElement,
	stewardCreateSummary: document.getElementById("steward-create-summary") as HTMLParagraphElement,
	stewardCreateId: document.getElementById("steward-create-id") as HTMLInputElement,
	stewardCreateName: document.getElementById("steward-create-name") as HTMLInputElement,
	stewardCreatePlatformId: document.getElementById("steward-create-platform-id") as HTMLInputElement,
	stewardCreateExpiresIn: document.getElementById("steward-create-expires-in") as HTMLInputElement,
	stewardCreate: document.getElementById("steward-create") as HTMLButtonElement,
	stewardCreateResult: document.getElementById("steward-create-result") as HTMLPreElement,
	protocolWorkbench: document.getElementById("protocol-workbench") as HTMLElement,
	protocolWorkbenchSummary: document.getElementById("protocol-workbench-summary") as HTMLParagraphElement,
	protocolWorkbenchChips: document.getElementById("protocol-workbench-chips") as HTMLDivElement,
	protocolRefresh: document.getElementById("protocol-refresh") as HTMLButtonElement,
	protocolA2ASummary: document.getElementById("protocol-a2a-summary") as HTMLDivElement,
	protocolIdentitySummary: document.getElementById("protocol-identity-summary") as HTMLDivElement,
	protocolA2AForm: document.getElementById("protocol-a2a-form") as HTMLFormElement,
	protocolA2ACardUrl: document.getElementById("protocol-a2a-card-url") as HTMLInputElement,
	protocolA2AMethod: document.getElementById("protocol-a2a-method") as HTMLInputElement,
	protocolA2AParams: document.getElementById("protocol-a2a-params") as HTMLTextAreaElement,
	protocolA2ASend: document.getElementById("protocol-a2a-send") as HTMLButtonElement,
	protocolA2AResult: document.getElementById("protocol-a2a-result") as HTMLPreElement,
	protocolX402Form: document.getElementById("protocol-x402-form") as HTMLFormElement,
	protocolX402Url: document.getElementById("protocol-x402-url") as HTMLInputElement,
	protocolX402Method: document.getElementById("protocol-x402-method") as HTMLSelectElement,
	protocolX402Headers: document.getElementById("protocol-x402-headers") as HTMLTextAreaElement,
	protocolX402Body: document.getElementById("protocol-x402-body") as HTMLTextAreaElement,
	protocolX402Probe: document.getElementById("protocol-x402-probe") as HTMLButtonElement,
	protocolX402Result: document.getElementById("protocol-x402-result") as HTMLPreElement,
	btnHostDocs: document.getElementById("btn-host-docs") as HTMLButtonElement,
	btnHostClipboard: document.getElementById("btn-host-clipboard") as HTMLButtonElement,
	btnHostFile: document.getElementById("btn-host-file") as HTMLButtonElement,
	studioCommandDeck: document.getElementById("studio-command-deck") as HTMLDivElement,
	chatIntelStrip: document.getElementById("chat-intel-strip") as HTMLDivElement,
	threadFilterBar: document.getElementById("thread-filter-bar") as HTMLDivElement,
	elizaModelRail: document.getElementById("eliza-model-rail") as HTMLDivElement,
	elizaRailHint: document.getElementById("eliza-rail-hint") as HTMLParagraphElement,
	panelApps: document.getElementById("panel-apps") as HTMLElement,
	panelStream: document.getElementById("panel-stream") as HTMLElement,
};

const PROVIDER_LABELS: Record<string, string> = {
	"eliza-cloud": "ElizaOS Cloud",
	openai: "OpenAI",
	anthropic: "Anthropic",
	"custom-openai": "Custom (OpenAI-compatible)",
	ollama: "Ollama",
	"lm-studio": "LM Studio",
};

let babylonSnapshot: BabylonOperatorSnapshot | null = null;
let babylonLoading = false;
let babylonCreating = false;
let babylonLastFetchedAt = 0;
let babylonRequestId = 0;
let babylonCreateResult: string | null = null;
let stewardSnapshot: StewardWorkbenchSnapshot | null = null;
let stewardLoading = false;
let stewardCreating = false;
let stewardLastFetchedAt = 0;
let stewardRequestId = 0;
let stewardCreateResult: string | null = null;
let stewardApprovalInFlightTxId: string | null = null;
let protocolSnapshot: ProtocolWorkbenchSnapshot | null = null;
let protocolLoading = false;
let protocolLastFetchedAt = 0;
let protocolRequestId = 0;
let protocolA2AInFlight = false;
let protocolX402InFlight = false;
let protocolA2AResult: string | null = null;
let protocolX402Result: string | null = null;

let currentState: RuntimeShellState | null = null;
let activeThreadId: string | null = null;
let appsSearchQuery = "";
let appsActiveOnly = false;
let chatThreadFilter: ChatThreadKind | "all" = "all";
let activeTab: TabId = "chat";
let streamTheaterMode = false;

function isWalletTabVisible(): boolean {
	return activeTab === "wallet";
}

function formatBabylonMoney(value: number | null | undefined): string {
	return value == null ? "n/a" : `$${value.toFixed(2)}`;
}

function formatBabylonSignedMoney(value: number | null | undefined): string {
	if (value == null) {
		return "n/a";
	}
	return `${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
}

function formatBabylonPercent(value: number | null | undefined): string {
	return value == null ? "n/a" : `${value.toFixed(1)}%`;
}

function buildBabylonChartSvg(points: BabylonOperatorSnapshot["chart"]["points"]): string {
	if (points.length === 0) {
		return '<div class="empty-state">No Babylon market history yet.</div>';
	}
	const width = 520;
	const height = 180;
	const padX = 14;
	const padY = 16;
	const min = Math.min(...points.map((point) => point.value));
	const max = Math.max(...points.map((point) => point.value));
	const range = max - min || 1;
	const coords = points.map((point, index) => {
		const x =
			padX +
			(index / Math.max(points.length - 1, 1)) * (width - padX * 2);
		const y =
			height -
			padY -
			((point.value - min) / range) * (height - padY * 2);
		return { x, y, value: point.value, label: point.label };
	});
	const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
	const area = [
		`${padX},${height - padY}`,
		...coords.map((point) => `${point.x},${point.y}`),
		`${width - padX},${height - padY}`,
	].join(" ");
	const last = coords[coords.length - 1]!;
	return `
		<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Babylon market chart">
			<defs>
				<linearGradient id="babylon-chart-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="rgba(196,30,42,0.42)" />
					<stop offset="100%" stop-color="rgba(196,30,42,0.02)" />
				</linearGradient>
			</defs>
			<line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
			<line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
			<polyline points="${area}" fill="url(#babylon-chart-fill)" stroke="none" />
			<polyline points="${line}" fill="none" stroke="rgba(196,30,42,0.92)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
			<circle cx="${last.x}" cy="${last.y}" r="4.5" fill="rgba(196,30,42,1)" />
			<text x="${padX}" y="${padY}" fill="rgba(255,255,255,0.44)" font-size="11">${escapeHtml(max.toFixed(2))}</text>
			<text x="${padX}" y="${height - padY + 14}" fill="rgba(255,255,255,0.36)" font-size="11">${escapeHtml(min.toFixed(2))}</text>
			<text x="${Math.max(last.x - 54, padX)}" y="${Math.max(last.y - 10, padY + 12)}" fill="rgba(255,255,255,0.72)" font-size="11">${escapeHtml(last.value.toFixed(2))}</text>
		</svg>
	`;
}

function renderProtocolSummaryRow(input: {
	label: string;
	value: string;
	sub?: string | null;
	aside?: string | null;
}): string {
	return `
		<div class="protocol-summary-row">
			<div class="protocol-summary-main">
				<p class="protocol-summary-label">${escapeHtml(input.label)}</p>
				<p class="protocol-summary-value">${escapeHtml(input.value)}</p>
				${
					input.sub
						? `<p class="protocol-summary-sub">${escapeHtml(input.sub)}</p>`
						: ""
				}
			</div>
			${input.aside ? `<div class="protocol-summary-aside">${escapeHtml(input.aside)}</div>` : ""}
		</div>
	`;
}

function renderProtocolWorkbench(snapshot: ProtocolWorkbenchSnapshot | null): void {
	const effectiveSnapshot =
		snapshot ??
		({
			a2a: {
				status: "unavailable",
				detail: "A2A agent-card discovery is waiting for data.",
				checkedAt: new Date().toISOString(),
				cardUrl: "https://babylon.market/.well-known/agent-card.json",
				endpointUrl: null,
				provider: null,
				protocolVersion: null,
				preferredTransport: null,
				interfaces: [],
				securitySchemes: [],
				skills: [],
			},
			identity: {
				status: "needs-config",
				detail:
					"Set BABYLON_AGENT_ID, BABYLON_AGENT_ADDRESS, and BABYLON_A2A_API_KEY to enable authenticated protocol calls from Cartridge.",
				agentId: null,
				walletAddress: null,
				chainId: null,
				tokenId: null,
				registrationMode: "unknown",
				authMode: "none",
				headers: [],
			},
			x402: {
				status: "idle",
				detail:
					"Provide an x402 endpoint URL to probe HTTP 402 payment requirements from Cartridge.",
				checkedAt: null,
				url: null,
				method: "GET",
				httpStatus: null,
				offers: [],
				paymentRequiredJson: null,
				paymentResponseJson: null,
				bodyPreview: null,
			},
			docs: {
				a2a: "https://a2a-protocol.org/latest/",
				x402: "https://docs.x402.org/",
				erc8004: "https://eips.ethereum.org/EIPS/eip-8004",
			},
		} satisfies ProtocolWorkbenchSnapshot);

	els.protocolWorkbench.hidden = false;
	els.protocolWorkbenchSummary.textContent = protocolLoading
		? "Refreshing A2A, x402, and ERC-8004 protocol state…"
		: [
				effectiveSnapshot.a2a.detail,
				effectiveSnapshot.identity.detail,
				effectiveSnapshot.x402.detail,
			]
				.filter(Boolean)
				.join(" ");
	els.protocolWorkbenchChips.innerHTML = [
		`<span class="chip ${
			effectiveSnapshot.a2a.status === "ready"
				? "ok"
				: effectiveSnapshot.a2a.status === "error"
					? "warn"
					: ""
		}">${escapeHtml(`A2A ${effectiveSnapshot.a2a.status}`)}</span>`,
		`<span class="chip ${
			effectiveSnapshot.identity.status === "onchain"
				? "ok"
				: effectiveSnapshot.identity.status === "needs-config"
					? "warn"
					: ""
		}">${escapeHtml(`ERC-8004 ${effectiveSnapshot.identity.status}`)}</span>`,
		`<span class="chip ${
			effectiveSnapshot.x402.status === "payment-required"
				? "accent"
				: effectiveSnapshot.x402.status === "ready"
					? "ok"
					: effectiveSnapshot.x402.status === "error"
						? "warn"
						: ""
		}">${escapeHtml(`x402 ${effectiveSnapshot.x402.status}`)}</span>`,
		effectiveSnapshot.a2a.provider
			? `<span class="chip">${escapeHtml(effectiveSnapshot.a2a.provider)}</span>`
			: "",
		effectiveSnapshot.identity.agentId
			? `<span class="chip accent">${escapeHtml(effectiveSnapshot.identity.agentId)}</span>`
			: "",
	]
		.filter(Boolean)
		.join("");

	els.protocolA2ASummary.innerHTML = [
		renderProtocolSummaryRow({
			label: "Card",
			value: effectiveSnapshot.a2a.cardUrl,
			sub: effectiveSnapshot.a2a.detail,
			aside: effectiveSnapshot.a2a.protocolVersion ?? null,
		}),
		renderProtocolSummaryRow({
			label: "Endpoint",
			value: effectiveSnapshot.a2a.endpointUrl ?? "No endpoint advertised",
			sub:
				effectiveSnapshot.a2a.interfaces.length > 0
					? effectiveSnapshot.a2a.interfaces
							.map((entry) =>
								`${entry.transport}${entry.protocolVersion ? ` ${entry.protocolVersion}` : ""} · ${entry.url}`,
							)
							.slice(0, 3)
							.join(" | ")
					: "No additional interfaces listed.",
			aside: effectiveSnapshot.a2a.preferredTransport ?? null,
		}),
		renderProtocolSummaryRow({
			label: "Security",
			value:
				effectiveSnapshot.a2a.securitySchemes.join(" | ") ||
				"No security schemes declared.",
			sub:
				effectiveSnapshot.a2a.skills.length > 0
					? effectiveSnapshot.a2a.skills
							.slice(0, 4)
							.map((skill) => skill.name)
							.join(" | ")
					: "No A2A skills advertised.",
		}),
	].join("");

	els.protocolIdentitySummary.innerHTML = [
		renderProtocolSummaryRow({
			label: "Registration",
			value: effectiveSnapshot.identity.status,
			sub: effectiveSnapshot.identity.detail,
			aside: effectiveSnapshot.identity.registrationMode,
		}),
		renderProtocolSummaryRow({
			label: "Agent",
			value: effectiveSnapshot.identity.agentId ?? "No agent id configured",
			sub:
				effectiveSnapshot.identity.chainId && effectiveSnapshot.identity.tokenId
					? `chain ${effectiveSnapshot.identity.chainId} · token ${effectiveSnapshot.identity.tokenId}`
					: effectiveSnapshot.identity.walletAddress
						? `wallet ${effectiveSnapshot.identity.walletAddress}`
						: "No wallet address configured.",
			aside: effectiveSnapshot.identity.authMode,
		}),
		renderProtocolSummaryRow({
			label: "Headers",
			value:
				effectiveSnapshot.identity.headers.join(" | ") ||
				"No Babylon auth headers are configured yet.",
			sub:
				"Babylon's current docs use x-agent-id, x-agent-address, x-agent-token-id, and X-Babylon-Api-Key.",
		}),
		renderProtocolSummaryRow({
			label: "x402",
			value:
				effectiveSnapshot.x402.offers.length > 0
					? effectiveSnapshot.x402.offers
							.map((offer) =>
								[
									offer.scheme,
									offer.price,
									offer.network,
									offer.payTo,
								]
									.filter(Boolean)
									.join(" · "),
							)
							.join(" | ")
					: effectiveSnapshot.x402.detail,
			sub:
				effectiveSnapshot.x402.url
					? `${effectiveSnapshot.x402.method} ${effectiveSnapshot.x402.url}`
					: "No x402 probe URL configured.",
			aside:
				effectiveSnapshot.x402.httpStatus != null
					? String(effectiveSnapshot.x402.httpStatus)
					: null,
		}),
	].join("");

	if (document.activeElement !== els.protocolA2ACardUrl) {
		els.protocolA2ACardUrl.value = effectiveSnapshot.a2a.cardUrl;
	}
	if (document.activeElement !== els.protocolX402Url) {
		els.protocolX402Url.value = effectiveSnapshot.x402.url ?? "";
	}
	els.protocolRefresh.disabled = protocolLoading;
	els.protocolA2ASend.disabled = protocolA2AInFlight;
	els.protocolX402Probe.disabled = protocolX402InFlight;

	const defaultA2AResult = protocolA2AResult ?? "A2A responses will appear here.";
	els.protocolA2AResult.textContent = defaultA2AResult;
	els.protocolA2AResult.classList.toggle(
		"empty-state",
		protocolA2AResult === null,
	);

	const defaultX402Result =
		protocolX402Result ??
		effectiveSnapshot.x402.paymentRequiredJson ??
		effectiveSnapshot.x402.paymentResponseJson ??
		effectiveSnapshot.x402.bodyPreview ??
		"Decoded x402 headers and body preview will appear here.";
	els.protocolX402Result.textContent = defaultX402Result;
	els.protocolX402Result.classList.toggle(
		"empty-state",
		protocolX402Result === null &&
			!effectiveSnapshot.x402.paymentRequiredJson &&
			!effectiveSnapshot.x402.paymentResponseJson &&
			!effectiveSnapshot.x402.bodyPreview,
	);
}

async function refreshProtocolWorkbench(force = false): Promise<void> {
	if (!force && protocolSnapshot && Date.now() - protocolLastFetchedAt < 20_000) {
		renderProtocolWorkbench(protocolSnapshot);
		return;
	}
	const requestId = ++protocolRequestId;
	protocolLoading = true;
	renderProtocolWorkbench(protocolSnapshot);
	try {
		const snapshot = await electrobun.rpc!.request.getProtocolWorkbenchSnapshot({});
		if (requestId !== protocolRequestId) {
			return;
		}
		protocolSnapshot = snapshot;
		protocolLastFetchedAt = Date.now();
	} catch (error) {
		protocolSnapshot = {
			a2a: {
				status: "error",
				detail:
					error instanceof Error
						? error.message
						: "Failed to refresh the A2A workbench.",
				checkedAt: new Date().toISOString(),
				cardUrl: "https://babylon.market/.well-known/agent-card.json",
				endpointUrl: null,
				provider: null,
				protocolVersion: null,
				preferredTransport: null,
				interfaces: [],
				securitySchemes: [],
				skills: [],
			},
			identity: {
				status: "needs-config",
				detail:
					"Protocol refresh failed before identity details could be loaded.",
				agentId: null,
				walletAddress: null,
				chainId: null,
				tokenId: null,
				registrationMode: "unknown",
				authMode: "none",
				headers: [],
			},
			x402: {
				status: "error",
				detail:
					error instanceof Error
						? error.message
						: "Failed to refresh x402 diagnostics.",
				checkedAt: new Date().toISOString(),
				url: null,
				method: "GET",
				httpStatus: null,
				offers: [],
				paymentRequiredJson: null,
				paymentResponseJson: null,
				bodyPreview: null,
			},
			docs: {
				a2a: "https://a2a-protocol.org/latest/",
				x402: "https://docs.x402.org/",
				erc8004: "https://eips.ethereum.org/EIPS/eip-8004",
			},
		};
	} finally {
		if (requestId === protocolRequestId) {
			protocolLoading = false;
			renderProtocolWorkbench(protocolSnapshot);
		}
	}
}

function renderBabylonWorkbench(snapshot: BabylonOperatorSnapshot | null): void {
	const surface = getCatalogSurfaces(currentState).find((entry) => entry.appId === "babylon");
	const visible = Boolean(surface) && shouldShowBabylonWallet(currentState);
	els.babylonWorkbench.hidden = !visible;
	if (!visible) {
		return;
	}
	const effectiveSnapshot =
		snapshot ??
		({
			status: "unavailable",
			source: "none",
			detail: "Babylon workbench is waiting for data.",
			checkedAt: new Date().toISOString(),
			agent: {
				id: null,
				name: null,
				state: null,
				walletAddress: null,
				totalTrades: null,
				winRate: null,
				reputationScore: null,
			},
			balances: {
				wallet: null,
				trading: null,
				deposited: null,
				withdrawn: null,
				lifetimePnl: null,
			},
			positions: {
				predictions: 0,
				perpetuals: 0,
				totalValue: null,
				totalUnrealizedPnl: null,
			},
			markets: [],
			chart: { marketId: null, label: null, points: [] },
			recentTrades: [],
			transactions: [],
			creation: {
				supported: false,
				authEnvKey: "CARTRIDGE_BABYLON_AUTH_TOKEN",
				detail: "Set CARTRIDGE_BABYLON_AUTH_TOKEN to enable Babylon agent creation from Cartridge.",
			},
		} satisfies BabylonOperatorSnapshot);

	els.babylonWorkbenchSummary.textContent = babylonLoading
		? "Refreshing Babylon operator data…"
		: effectiveSnapshot.detail;
	els.babylonWorkbenchChips.innerHTML = [
		`<span class="chip ${effectiveSnapshot.status === "ready" ? "ok" : effectiveSnapshot.status === "error" ? "warn" : ""}">${escapeHtml(effectiveSnapshot.status)}</span>`,
		`<span class="chip">${escapeHtml(effectiveSnapshot.source)}</span>`,
		effectiveSnapshot.agent.id
			? `<span class="chip accent">${escapeHtml(effectiveSnapshot.agent.id)}</span>`
			: "",
		effectiveSnapshot.agent.state
			? `<span class="chip">${escapeHtml(effectiveSnapshot.agent.state)}</span>`
			: "",
		effectiveSnapshot.agent.walletAddress
			? `<span class="chip">${escapeHtml(effectiveSnapshot.agent.walletAddress)}</span>`
			: "",
	]
		.filter(Boolean)
		.join("");

	els.babylonBalanceGrid.innerHTML = [
		{
			label: "Wallet",
			value: formatBabylonMoney(effectiveSnapshot.balances.wallet),
			sub: `Trading ${formatBabylonMoney(effectiveSnapshot.balances.trading)}`,
		},
		{
			label: "Deposits",
			value: formatBabylonMoney(effectiveSnapshot.balances.deposited),
			sub: `Withdrawn ${formatBabylonMoney(effectiveSnapshot.balances.withdrawn)}`,
		},
		{
			label: "Live PnL",
			value: formatBabylonSignedMoney(effectiveSnapshot.balances.lifetimePnl),
			sub: `Assets ${formatBabylonMoney(effectiveSnapshot.positions.totalValue)}`,
		},
		{
			label: "Agent stats",
			value: `${effectiveSnapshot.agent.totalTrades ?? 0} trades`,
			sub: `Win ${formatBabylonPercent(effectiveSnapshot.agent.winRate)} · Rep ${effectiveSnapshot.agent.reputationScore ?? "n/a"}`,
		},
	]
		.map(
			(stat) => `
				<div class="babylon-stat">
					<p class="babylon-stat-label">${escapeHtml(stat.label)}</p>
					<p class="babylon-stat-value">${escapeHtml(stat.value)}</p>
					<p class="babylon-stat-sub">${escapeHtml(stat.sub)}</p>
				</div>
			`,
		)
		.join("");

	els.babylonChartLabel.textContent = effectiveSnapshot.chart.label ?? "Market history";
	els.babylonChart.innerHTML = buildBabylonChartSvg(effectiveSnapshot.chart.points);
	els.babylonMarkets.innerHTML =
		effectiveSnapshot.markets.length > 0
			? effectiveSnapshot.markets
					.map(
						(market) => `
							<div class="babylon-row">
								<div class="babylon-row-main">
									<p class="babylon-row-title">${escapeHtml(market.title)}</p>
									<p class="babylon-row-meta">${escapeHtml(
										`${market.status} · YES ${market.yesPrice?.toFixed(2) ?? "n/a"} · NO ${market.noPrice?.toFixed(2) ?? "n/a"} · Vol ${formatBabylonMoney(market.volume)}`,
									)}</p>
								</div>
								<div class="babylon-row-value">${escapeHtml(market.category ?? "market")}</div>
							</div>
						`,
					)
					.join("")
			: '<div class="empty-state">No markets loaded.</div>';
	els.babylonTrades.innerHTML =
		effectiveSnapshot.recentTrades.length > 0
			? effectiveSnapshot.recentTrades
					.map(
						(trade) => `
							<div class="babylon-row">
								<div class="babylon-row-main">
									<p class="babylon-row-title">${escapeHtml(trade.summary)}</p>
									<p class="babylon-row-meta">${escapeHtml(new Date(trade.timestamp).toLocaleString())}</p>
								</div>
								<div class="babylon-row-value">${escapeHtml(formatBabylonSignedMoney(trade.pnl))}</div>
							</div>
						`,
					)
					.join("")
			: '<div class="empty-state">No recent trades yet.</div>';
	els.babylonTransactions.innerHTML =
		effectiveSnapshot.transactions.length > 0
			? effectiveSnapshot.transactions
					.map(
						(tx) => `
							<div class="babylon-row">
								<div class="babylon-row-main">
									<p class="babylon-row-title">${escapeHtml(tx.type)}</p>
									<p class="babylon-row-meta">${escapeHtml(new Date(tx.timestamp).toLocaleString())}</p>
								</div>
								<div class="babylon-row-value">${escapeHtml(formatBabylonSignedMoney(tx.amount))}</div>
							</div>
						`,
					)
					.join("")
			: '<div class="empty-state">No transactions yet.</div>';

	els.babylonCreateSummary.textContent = effectiveSnapshot.creation.detail;
	els.babylonCreate.disabled = !effectiveSnapshot.creation.supported || babylonCreating;
	els.babylonRefresh.disabled = babylonLoading;
	els.babylonCreateResult.textContent =
		babylonCreateResult ?? "New Babylon agent credentials will appear here.";
	els.babylonCreateResult.classList.toggle(
		"empty-state",
		babylonCreateResult === null,
	);
}

async function refreshBabylonWorkbench(force = false): Promise<void> {
	if (!shouldShowBabylonWallet(currentState)) {
		els.babylonWorkbench.hidden = true;
		return;
	}
	if (!force && babylonSnapshot && Date.now() - babylonLastFetchedAt < 20_000) {
		renderBabylonWorkbench(babylonSnapshot);
		return;
	}
	const requestId = ++babylonRequestId;
	babylonLoading = true;
	renderBabylonWorkbench(babylonSnapshot);
	try {
		const snapshot = await electrobun.rpc!.request.getBabylonOperatorSnapshot({});
		if (requestId !== babylonRequestId) {
			return;
		}
		babylonSnapshot = snapshot;
		babylonLastFetchedAt = Date.now();
	} catch (error) {
		babylonSnapshot = {
			status: "error",
			source: "none",
			detail:
				error instanceof Error
					? error.message
					: "Failed to refresh Babylon operator data.",
			checkedAt: new Date().toISOString(),
			agent: {
				id: null,
				name: null,
				state: null,
				walletAddress: null,
				totalTrades: null,
				winRate: null,
				reputationScore: null,
			},
			balances: {
				wallet: null,
				trading: null,
				deposited: null,
				withdrawn: null,
				lifetimePnl: null,
			},
			positions: {
				predictions: 0,
				perpetuals: 0,
				totalValue: null,
				totalUnrealizedPnl: null,
			},
			markets: [],
			chart: { marketId: null, label: null, points: [] },
			recentTrades: [],
			transactions: [],
			creation: {
				supported: false,
				authEnvKey: "CARTRIDGE_BABYLON_AUTH_TOKEN",
				detail: "Set CARTRIDGE_BABYLON_AUTH_TOKEN to enable Babylon agent creation from Cartridge.",
			},
		};
	} finally {
		if (requestId === babylonRequestId) {
			babylonLoading = false;
			renderBabylonWorkbench(babylonSnapshot);
		}
	}
}

function renderStewardWorkbench(snapshot: StewardWorkbenchSnapshot | null): void {
	const surface = getCatalogSurfaces(currentState).find((entry) => entry.appId === "steward");
	els.stewardWorkbench.hidden = !surface;
	if (!surface) {
		return;
	}
	const effectiveSnapshot =
		snapshot ??
		({
			status: "unavailable",
			mode: "unconfigured",
			detail: "Steward workbench is waiting for data.",
			checkedAt: new Date().toISOString(),
			context: {
				apiBase: null,
				compatBase: null,
				proxyUrl: null,
				authMode: "none",
				agentId: null,
				tenantId: null,
				chainId: 8453,
			},
			agent: {
				id: null,
				name: null,
				tenantId: null,
				createdAt: null,
				walletEvm: null,
				walletSolana: null,
			},
			balances: {
				nativeRaw: null,
				nativeFormatted: null,
				symbol: null,
				chainId: 8453,
				tokenCount: 0,
			},
			spend: {
				todayFormatted: null,
				thisWeekFormatted: null,
				thisMonthFormatted: null,
				pendingApprovals: 0,
				recentTransactions: 0,
			},
			approvalStats: {
				pending: 0,
				approved: 0,
				rejected: 0,
				total: 0,
				avgWaitSeconds: null,
			},
			policies: [],
			approvals: [],
			recentTransactions: [],
			tokens: [],
			webhooks: [],
			creation: {
				supported: false,
				authEnvKey: "STEWARD_API_KEY",
				detail:
					"Point Cartridge at STEWARD_API_URL and provide STEWARD_API_KEY to create Steward agents.",
			},
			docs: {
				overview: "https://docs.steward.fi/introduction",
				api: "https://docs.steward.fi/api-reference/overview",
				localMode: "https://docs.steward.fi/guides/local-mode",
				eliza: "https://docs.steward.fi/guides/eliza-plugin",
			},
		} satisfies StewardWorkbenchSnapshot);

	els.stewardWorkbenchSummary.textContent = stewardLoading
		? "Refreshing Steward wallet, approval, and policy state…"
		: effectiveSnapshot.detail;
	els.stewardWorkbenchChips.innerHTML = [
		`<span class="chip ${
			effectiveSnapshot.status === "ready"
				? "ok"
				: effectiveSnapshot.status === "error"
					? "warn"
					: effectiveSnapshot.status === "needs-auth"
						? "accent"
						: ""
		}">${escapeHtml(effectiveSnapshot.status)}</span>`,
		`<span class="chip">${escapeHtml(effectiveSnapshot.mode)}</span>`,
		`<span class="chip">${escapeHtml(effectiveSnapshot.context.authMode)}</span>`,
		effectiveSnapshot.context.agentId
			? `<span class="chip accent">${escapeHtml(effectiveSnapshot.context.agentId)}</span>`
			: "",
		effectiveSnapshot.context.tenantId
			? `<span class="chip">${escapeHtml(effectiveSnapshot.context.tenantId)}</span>`
			: "",
		effectiveSnapshot.context.proxyUrl
			? `<span class="chip">${escapeHtml(effectiveSnapshot.context.proxyUrl)}</span>`
			: "",
	]
		.filter(Boolean)
		.join("");

	els.stewardBalanceGrid.innerHTML = [
		{
			label: "Native balance",
			value:
				effectiveSnapshot.balances.nativeFormatted && effectiveSnapshot.balances.symbol
					? `${effectiveSnapshot.balances.nativeFormatted} ${effectiveSnapshot.balances.symbol}`
					: "n/a",
			sub: `Chain ${effectiveSnapshot.balances.chainId ?? "n/a"}`,
		},
		{
			label: "Spend today",
			value: effectiveSnapshot.spend.todayFormatted ?? "n/a",
			sub: `Week ${effectiveSnapshot.spend.thisWeekFormatted ?? "n/a"}`,
		},
		{
			label: "Pending approvals",
			value: String(
				Math.max(
					effectiveSnapshot.approvalStats.pending,
					effectiveSnapshot.spend.pendingApprovals,
				),
			),
			sub: `Resolved ${effectiveSnapshot.approvalStats.approved + effectiveSnapshot.approvalStats.rejected}`,
		},
		{
			label: "Policies",
			value: `${effectiveSnapshot.policies.length}`,
			sub: `${effectiveSnapshot.tokens.length} token${effectiveSnapshot.tokens.length === 1 ? "" : "s"} tracked`,
		},
	]
		.map(
			(stat) => `
				<div class="babylon-stat">
					<p class="babylon-stat-label">${escapeHtml(stat.label)}</p>
					<p class="babylon-stat-value">${escapeHtml(stat.value)}</p>
					<p class="babylon-stat-sub">${escapeHtml(stat.sub)}</p>
				</div>
			`,
		)
		.join("");

	els.stewardAgentSummary.innerHTML = [
		renderProtocolSummaryRow({
			label: "Agent",
			value:
				effectiveSnapshot.agent.id ??
				effectiveSnapshot.context.agentId ??
				"No agent selected",
			sub:
				effectiveSnapshot.agent.name ??
				(effectiveSnapshot.context.authMode === "tenant-key"
					? "Tenant-level Steward access is available."
					: "Set STEWARD_AGENT_ID to focus the shell on one wallet."),
		}),
		renderProtocolSummaryRow({
			label: "Tenant",
			value: effectiveSnapshot.agent.tenantId ?? effectiveSnapshot.context.tenantId ?? "n/a",
			sub:
				effectiveSnapshot.agent.createdAt
					? `Created ${new Date(effectiveSnapshot.agent.createdAt).toLocaleString()}`
					: effectiveSnapshot.context.apiBase ?? effectiveSnapshot.context.compatBase ?? "No API base configured",
		}),
		renderProtocolSummaryRow({
			label: "EVM wallet",
			value: effectiveSnapshot.agent.walletEvm ?? "n/a",
			sub: effectiveSnapshot.context.proxyUrl
				? `Proxy ${effectiveSnapshot.context.proxyUrl}`
				: "Proxy URL not configured.",
		}),
		renderProtocolSummaryRow({
			label: "Solana wallet",
			value: effectiveSnapshot.agent.walletSolana ?? "n/a",
			sub: `Local mode docs: ${effectiveSnapshot.docs.localMode}`,
		}),
	].join("");

	els.stewardPolicies.innerHTML =
		effectiveSnapshot.policies.length > 0
			? effectiveSnapshot.policies
					.map((policy) =>
						renderProtocolSummaryRow({
							label: policy.type,
							value: policy.enabled ? "enabled" : "disabled",
							sub: `${policy.summary} ${policy.configPreview}`,
						}),
					)
					.join("")
			: '<div class="empty-state">No Steward policies loaded.</div>';

	els.stewardApprovals.innerHTML =
		effectiveSnapshot.approvals.length > 0
			? effectiveSnapshot.approvals
					.map((approval) => {
						const busy = stewardApprovalInFlightTxId === approval.txId;
						const canResolve = approval.status === "pending";
						return `
							<div class="babylon-row">
								<div class="babylon-row-main">
									<p class="babylon-row-title">${escapeHtml(approval.agentName ?? approval.agentId ?? approval.txId)}</p>
									<p class="babylon-row-meta">${escapeHtml(
										[
											approval.toAddress ? `To ${approval.toAddress}` : null,
											approval.value ? `Value ${approval.value}` : null,
											approval.chainId != null ? `Chain ${approval.chainId}` : null,
											approval.requestedAt
												? new Date(approval.requestedAt).toLocaleString()
												: null,
										]
											.filter(Boolean)
											.join(" · "),
									)}</p>
								</div>
								<div class="steward-row-actions">
									<span class="chip ${approval.status === "pending" ? "accent" : ""}">${escapeHtml(approval.status)}</span>
									${
										canResolve
											? `
												<button
													type="button"
													class="btn-secondary steward-action-btn"
													data-steward-action="deny"
													data-steward-approval-id="${escapeHtml(approval.id)}"
													data-steward-tx-id="${escapeHtml(approval.txId)}"
													data-steward-agent-id="${escapeHtml(approval.agentId ?? "")}"
													${busy ? "disabled" : ""}
												>
													Deny
												</button>
												<button
													type="button"
													class="btn-primary steward-action-btn"
													data-steward-action="approve"
													data-steward-approval-id="${escapeHtml(approval.id)}"
													data-steward-tx-id="${escapeHtml(approval.txId)}"
													data-steward-agent-id="${escapeHtml(approval.agentId ?? "")}"
													${busy ? "disabled" : ""}
												>
													Approve
												</button>
											`
											: ""
									}
								</div>
							</div>
						`;
					})
					.join("")
			: '<div class="empty-state">No Steward approvals waiting.</div>';

	els.stewardTransactions.innerHTML =
		effectiveSnapshot.recentTransactions.length > 0
			? effectiveSnapshot.recentTransactions
					.map(
						(tx) => `
							<div class="babylon-row">
								<div class="babylon-row-main">
									<p class="babylon-row-title">${escapeHtml(tx.summary)}</p>
									<p class="babylon-row-meta">${escapeHtml(
										[
											tx.status,
											tx.txHash ?? null,
											tx.createdAt ? new Date(tx.createdAt).toLocaleString() : null,
										]
											.filter(Boolean)
											.join(" · "),
									)}</p>
								</div>
								<div class="babylon-row-value">${escapeHtml(tx.value ?? "n/a")}</div>
							</div>
						`,
					)
					.join("")
			: '<div class="empty-state">No Steward transaction history loaded.</div>';

	els.stewardTokens.innerHTML =
		effectiveSnapshot.tokens.length > 0
			? effectiveSnapshot.tokens
					.map((token) =>
						renderProtocolSummaryRow({
							label: token.symbol,
							value: token.formatted ?? token.balance,
							sub: [token.name, token.address, token.valueUsd ? `$${token.valueUsd}` : null]
								.filter(Boolean)
								.join(" · "),
						}),
					)
					.join("")
			: '<div class="empty-state">No Steward token balances loaded.</div>';

	els.stewardWebhooks.innerHTML =
		effectiveSnapshot.webhooks.length > 0
			? effectiveSnapshot.webhooks
					.map(
						(event) => `
							<div class="babylon-row">
								<div class="babylon-row-main">
									<p class="babylon-row-title">${escapeHtml(event.event)}</p>
									<p class="babylon-row-meta">${escapeHtml(
										event.timestamp ? new Date(event.timestamp).toLocaleString() : "No timestamp",
									)}</p>
								</div>
								<div class="babylon-row-value">${escapeHtml(event.summary)}</div>
							</div>
						`,
					)
					.join("")
			: '<div class="empty-state">No Steward webhook events available.</div>';

	els.stewardCreateSummary.textContent = effectiveSnapshot.creation.detail;
	els.stewardCreate.disabled =
		!effectiveSnapshot.creation.supported || stewardCreating;
	els.stewardRefresh.disabled = stewardLoading;
	els.stewardCreateResult.textContent =
		stewardCreateResult ?? "New Steward agent credentials will appear here.";
	els.stewardCreateResult.classList.toggle(
		"empty-state",
		stewardCreateResult === null,
	);
}

async function refreshStewardWorkbench(force = false): Promise<void> {
	if (!force && stewardSnapshot && Date.now() - stewardLastFetchedAt < 20_000) {
		renderStewardWorkbench(stewardSnapshot);
		return;
	}
	const requestId = ++stewardRequestId;
	stewardLoading = true;
	renderStewardWorkbench(stewardSnapshot);
	try {
		const snapshot = await electrobun.rpc!.request.getStewardWorkbenchSnapshot({});
		if (requestId !== stewardRequestId) {
			return;
		}
		stewardSnapshot = snapshot;
		stewardLastFetchedAt = Date.now();
	} catch (error) {
		stewardSnapshot = {
			status: "error",
			mode: "unconfigured",
			detail:
				error instanceof Error
					? error.message
					: "Failed to refresh Steward state.",
			checkedAt: new Date().toISOString(),
			context: {
				apiBase: null,
				compatBase: null,
				proxyUrl: null,
				authMode: "none",
				agentId: null,
				tenantId: null,
				chainId: 8453,
			},
			agent: {
				id: null,
				name: null,
				tenantId: null,
				createdAt: null,
				walletEvm: null,
				walletSolana: null,
			},
			balances: {
				nativeRaw: null,
				nativeFormatted: null,
				symbol: null,
				chainId: 8453,
				tokenCount: 0,
			},
			spend: {
				todayFormatted: null,
				thisWeekFormatted: null,
				thisMonthFormatted: null,
				pendingApprovals: 0,
				recentTransactions: 0,
			},
			approvalStats: {
				pending: 0,
				approved: 0,
				rejected: 0,
				total: 0,
				avgWaitSeconds: null,
			},
			policies: [],
			approvals: [],
			recentTransactions: [],
			tokens: [],
			webhooks: [],
			creation: {
				supported: false,
				authEnvKey: "STEWARD_API_KEY",
				detail: "Set STEWARD_API_KEY to create Steward agents from Cartridge.",
			},
			docs: {
				overview: "https://docs.steward.fi/introduction",
				api: "https://docs.steward.fi/api-reference/overview",
				localMode: "https://docs.steward.fi/guides/local-mode",
				eliza: "https://docs.steward.fi/guides/eliza-plugin",
			},
		};
	} finally {
		if (requestId === stewardRequestId) {
			stewardLoading = false;
			renderStewardWorkbench(stewardSnapshot);
		}
	}
}

initTabs();
els.babylonCreateId.value = "cartridge-babylon-agent";
els.babylonCreateName.value = "Cartridge Market Pilot";
els.babylonCreateDescription.value =
	"Prediction-market pilot routed through Cartridge.";
renderBabylonWorkbench(null);
els.stewardCreateId.value = "cartridge-steward-agent";
els.stewardCreateName.value = "Cartridge Steward Agent";
els.stewardCreatePlatformId.value = "cartridge";
els.stewardCreateExpiresIn.value = "30d";
renderStewardWorkbench(null);
els.protocolA2ACardUrl.value = "https://babylon.market/.well-known/agent-card.json";
els.protocolA2AMethod.value = "a2a.getBalance";
els.protocolA2AParams.value = "{}";
els.protocolX402Method.value = "GET";
els.protocolX402Headers.value = "{}";
els.protocolX402Body.value = "";
renderProtocolWorkbench(null);

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
	if (e.key === "Escape" && streamTheaterMode) {
		streamTheaterMode = false;
		if (currentState) {
			renderStreamStage(currentState);
		}
		return;
	}
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

els.babylonRefresh.addEventListener("click", () => {
	void refreshBabylonWorkbench(true);
});

els.stewardRefresh.addEventListener("click", () => {
	void refreshStewardWorkbench(true);
});

els.protocolRefresh.addEventListener("click", () => {
	void refreshProtocolWorkbench(true);
});

els.babylonCreateForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	babylonCreating = true;
	babylonCreateResult = null;
	renderBabylonWorkbench(babylonSnapshot);
	try {
		const payload: BabylonAgentCreationInput = {
			externalId: els.babylonCreateId.value.trim(),
			name: els.babylonCreateName.value.trim(),
			description: els.babylonCreateDescription.value.trim(),
		};
		const result = await electrobun.rpc!.request.createBabylonAgent(payload);
		babylonCreateResult = [
			`AGENT_ID=${result.agentId}`,
			result.apiKey ? `BABYLON_A2A_API_KEY=${result.apiKey}` : null,
			result.secret ? `BABYLON_AGENT_SECRET=${result.secret}` : null,
			result.walletAddress ? `BABYLON_AGENT_ADDRESS=${result.walletAddress}` : null,
			"",
			result.detail,
		]
			.filter((line): line is string => Boolean(line))
			.join("\n");
		await refreshBabylonWorkbench(true);
	} catch (error) {
		babylonCreateResult =
			error instanceof Error
				? error.message
				: "Failed to create Babylon agent.";
		renderBabylonWorkbench(babylonSnapshot);
	} finally {
		babylonCreating = false;
		renderBabylonWorkbench(babylonSnapshot);
	}
});

els.stewardCreateForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	stewardCreating = true;
	stewardCreateResult = null;
	renderStewardWorkbench(stewardSnapshot);
	try {
		const payload: StewardAgentCreationInput = {
			agentId: els.stewardCreateId.value.trim(),
			name: els.stewardCreateName.value.trim(),
			platformId: els.stewardCreatePlatformId.value.trim(),
			tokenExpiresIn: els.stewardCreateExpiresIn.value.trim(),
		};
		const result = await electrobun.rpc!.request.createStewardAgent(payload);
		stewardCreateResult = [
			`STEWARD_AGENT_ID=${result.agentId}`,
			result.token ? `STEWARD_AGENT_TOKEN=${result.token}` : null,
			result.evmAddress ? `STEWARD_AGENT_EVM=${result.evmAddress}` : null,
			result.solanaAddress ? `STEWARD_AGENT_SOLANA=${result.solanaAddress}` : null,
			result.tenantId ? `STEWARD_TENANT_ID=${result.tenantId}` : null,
			"",
			result.detail,
		]
			.filter((line): line is string => Boolean(line))
			.join("\n");
		await refreshStewardWorkbench(true);
	} catch (error) {
		stewardCreateResult =
			error instanceof Error
				? error.message
				: "Failed to create Steward agent.";
		renderStewardWorkbench(stewardSnapshot);
	} finally {
		stewardCreating = false;
		renderStewardWorkbench(stewardSnapshot);
	}
});

els.stewardApprovals.addEventListener("click", async (event) => {
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
		"[data-steward-action]",
	);
	if (!button) {
		return;
	}
	const action = button.dataset["stewardAction"] as "approve" | "deny" | undefined;
	const approvalId = button.dataset["stewardApprovalId"]?.trim() ?? "";
	const txId = button.dataset["stewardTxId"]?.trim() ?? "";
	const agentId = button.dataset["stewardAgentId"]?.trim() ?? "";
	if (!action || !approvalId) {
		return;
	}
	const reason =
		action === "deny"
			? window.prompt("Reason for denying this Steward transaction?", "Denied from Cartridge")
			: null;
	if (action === "deny" && reason === null) {
		return;
	}
	stewardApprovalInFlightTxId = txId || approvalId;
	renderStewardWorkbench(stewardSnapshot);
	try {
		await electrobun.rpc!.request.resolveStewardApprovalAction({
			action,
			approvalId,
			txId,
			agentId: agentId || undefined,
			reason: reason?.trim() || undefined,
		});
		await refreshStewardWorkbench(true);
	} finally {
		stewardApprovalInFlightTxId = null;
		renderStewardWorkbench(stewardSnapshot);
	}
});

els.protocolA2AForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	protocolA2AInFlight = true;
	protocolA2AResult = null;
	renderProtocolWorkbench(protocolSnapshot);
	try {
		const result = await electrobun.rpc!.request.callA2AEndpoint({
			cardUrl: els.protocolA2ACardUrl.value.trim(),
			method: els.protocolA2AMethod.value.trim(),
			paramsJson: els.protocolA2AParams.value.trim(),
		});
		protocolA2AResult = [result.detail, "", result.responseJson]
			.filter((entry) => entry.trim().length > 0)
			.join("\n");
		await refreshProtocolWorkbench(true);
	} catch (error) {
		protocolA2AResult =
			error instanceof Error ? error.message : "Failed to call the A2A endpoint.";
		renderProtocolWorkbench(protocolSnapshot);
	} finally {
		protocolA2AInFlight = false;
		renderProtocolWorkbench(protocolSnapshot);
	}
});

els.protocolX402Form.addEventListener("submit", async (event) => {
	event.preventDefault();
	protocolX402InFlight = true;
	protocolX402Result = null;
	renderProtocolWorkbench(protocolSnapshot);
	try {
		const result = await electrobun.rpc!.request.probeX402Endpoint({
			url: els.protocolX402Url.value.trim(),
			method: els.protocolX402Method.value as ProtocolX402ProbeInput["method"],
			headersJson: els.protocolX402Headers.value.trim(),
			bodyJson: els.protocolX402Body.value.trim(),
		});
		protocolX402Result = [
			result.detail,
			result.paymentRequiredJson,
			result.paymentResponseJson,
			result.bodyPreview,
		]
			.filter((entry): entry is string => Boolean(entry))
			.join("\n\n");
		protocolSnapshot = protocolSnapshot
			? { ...protocolSnapshot, x402: result }
			: {
					a2a: {
						status: "unavailable",
						detail: "A2A agent-card discovery is waiting for data.",
						checkedAt: new Date().toISOString(),
						cardUrl: els.protocolA2ACardUrl.value.trim() || "https://babylon.market/.well-known/agent-card.json",
						endpointUrl: null,
						provider: null,
						protocolVersion: null,
						preferredTransport: null,
						interfaces: [],
						securitySchemes: [],
						skills: [],
					},
					identity: {
						status: "needs-config",
						detail:
							"Set BABYLON_AGENT_ID, BABYLON_AGENT_ADDRESS, and BABYLON_A2A_API_KEY to enable authenticated protocol calls from Cartridge.",
						agentId: null,
						walletAddress: null,
						chainId: null,
						tokenId: null,
						registrationMode: "unknown",
						authMode: "none",
						headers: [],
					},
					x402: result,
					docs: {
						a2a: "https://a2a-protocol.org/latest/",
						x402: "https://docs.x402.org/",
						erc8004: "https://eips.ethereum.org/EIPS/eip-8004",
					},
				};
		renderProtocolWorkbench(protocolSnapshot);
	} catch (error) {
		protocolX402Result =
			error instanceof Error ? error.message : "Failed to probe the x402 endpoint.";
		renderProtocolWorkbench(protocolSnapshot);
	} finally {
		protocolX402InFlight = false;
		renderProtocolWorkbench(protocolSnapshot);
	}
});

els.streamStageThread.addEventListener("click", () => {
	if (!currentState) {
		return;
	}
	const streamThread = currentState.chatThreads.find((thread) => thread.kind === "stream");
	if (!streamThread) {
		return;
	}
	chatThreadFilter = "stream";
	activeThreadId = streamThread.threadId;
	renderThreadFilterUi();
	renderThreads(filterThreads(currentState.chatThreads));
	renderActiveThread();
	switchToTab("chat");
});

els.streamStageTheater.addEventListener("click", () => {
	streamTheaterMode = !streamTheaterMode;
	if (currentState) {
		renderStreamStage(currentState);
	}
});

async function persistBroadcastConfig(): Promise<void> {
	const nextStreamKey = els.broadcastStreamKey.value.trim();
	await electrobun.rpc!.request.updateBroadcastConfig({
		destinationUrl: els.broadcastDestination.value.trim(),
		streamKey: nextStreamKey.length > 0 ? nextStreamKey : undefined,
	});
}

async function pushBroadcastAudioBus(bus: BroadcastAudioBus): Promise<void> {
	const map = {
		app: {
			enabled: els.broadcastBusAppEnabled.checked,
			muted: els.broadcastBusAppMuted.checked,
			gainPct: Number(els.broadcastBusAppGain.value),
		},
		system: {
			enabled: els.broadcastBusSystemEnabled.checked,
			muted: els.broadcastBusSystemMuted.checked,
			gainPct: Number(els.broadcastBusSystemGain.value),
		},
		mic: {
			enabled: els.broadcastBusMicEnabled.checked,
			muted: els.broadcastBusMicMuted.checked,
			gainPct: Number(els.broadcastBusMicGain.value),
		},
	} as const;
	await electrobun.rpc!.request.setBroadcastAudioBus({
		bus,
		...map[bus],
	});
}

els.broadcastDestination.addEventListener("change", () => {
	void persistBroadcastConfig();
});
els.broadcastStreamKey.addEventListener("change", () => {
	void persistBroadcastConfig();
});
els.broadcastRequestPermissions.addEventListener("click", async () => {
	await electrobun.rpc!.request.requestBroadcastPermissions({});
});
els.broadcastStart.addEventListener("click", async () => {
	await persistBroadcastConfig();
	await electrobun.rpc!.request.startBroadcast({});
});
els.broadcastStop.addEventListener("click", async () => {
	await electrobun.rpc!.request.stopBroadcast({});
});
els.broadcastReveal.addEventListener("click", async () => {
	await electrobun.rpc!.request.revealBroadcastWindow({});
});
els.broadcastRefreshLogs.addEventListener("click", async () => {
	const { lines } = await electrobun.rpc!.request.readBroadcastLogs({});
	renderBroadcastLogs(lines);
});
for (const [bus, inputs] of [
	[
		"app",
		[
			els.broadcastBusAppEnabled,
			els.broadcastBusAppMuted,
			els.broadcastBusAppGain,
		],
	],
	[
		"system",
		[
			els.broadcastBusSystemEnabled,
			els.broadcastBusSystemMuted,
			els.broadcastBusSystemGain,
		],
	],
	[
		"mic",
		[
			els.broadcastBusMicEnabled,
			els.broadcastBusMicMuted,
			els.broadcastBusMicGain,
		],
	],
] as const) {
	for (const input of inputs) {
		input.addEventListener("change", () => {
			void pushBroadcastAudioBus(bus);
		});
	}
}

function initTabs(): void {
	const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".nav-rail-btn"));

	for (const btn of buttons) {
		btn.addEventListener("click", () => {
			const tab = btn.dataset["tab"] as TabId | undefined;
			if (!tab) {
				return;
			}
			switchToTab(tab);
		});
	}
}

function switchToTab(tab: TabId): void {
	activeTab = tab;
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
	if (tab === "wallet") {
		void refreshBabylonWorkbench();
		void refreshStewardWorkbench();
		void refreshProtocolWorkbench();
	}
	if (tab === "stream" && currentState) {
		renderStreamStage(currentState);
		renderBroadcastConsole(currentState.broadcast);
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
					<button type="button" class="btn-secondary" data-studio-nav="apps">Store</button>
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

function renderAppsCatalog(): void {
	const state = currentState;
	const selectedPersona = getSelectedPersona();
	const q = appsSearchQuery.trim().toLowerCase();
	const surfaces = getCatalogSurfaces(state);
	const primary = surfaces.filter((surface) => surface.category === "game");
	const support = surfaces.filter((surface) => surface.category === "support");

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

function getCatalogSurfaces(
	state: RuntimeShellState | null = currentState,
): GameAppManifest[] {
	return state?.surfaces ?? ACTIVE_SURFACES;
}

function getSurfaceConnection(
	state: RuntimeShellState | null,
	appId: string,
): SurfaceConnectionState | null {
	return state?.surfaceConnections.find((connection) => connection.appId === appId) ?? null;
}

function connectionChipClass(
	status: SurfaceConnectionState["status"],
): string {
	switch (status) {
		case "ready":
			return "chip ok";
		case "offline":
		case "error":
			return "chip warn";
		case "starting":
			return "chip accent";
		default:
			return "chip";
	}
}

function formatSurfaceConnectionStatus(
	status: SurfaceConnectionState["status"],
): string {
	return status.replace(/-/g, " ");
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
		const connection = getSurfaceConnection(state, surface.appId);
		const card = document.createElement("article");
		card.className = "store-hero-card";
		card.dataset["storeAppId"] = surface.appId;
		card.dataset["storeDisplayName"] = surface.displayName;
		card.dataset["storePackage"] = surface.packageName;
		card.style.setProperty("--hero-grad", iconGradientCss(surface.appId));
		card.innerHTML = `
			<div class="store-hero-shine" aria-hidden="true"></div>
			<div class="store-hero-body">
				<span class="store-hero-eyebrow">${live ? "Live now" : "Launch ready"}</span>
				<h3 class="store-hero-name">${escapeHtml(surface.displayName)}</h3>
				<p class="store-hero-desc">${escapeHtml(surface.summary)}</p>
				<div class="store-hero-meta">
					<span class="store-hero-pill">${escapeHtml(surface.session.mode)}</span>
					${connection ? `<span class="${connectionChipClass(connection.status)}">${escapeHtml(formatSurfaceConnectionStatus(connection.status))}</span>` : ""}
				</div>
				<div class="store-hero-actions">
					<button type="button" class="store-pill-btn store-pill-btn-primary" data-action="shell">Open</button>
					<button type="button" class="store-pill-btn store-pill-btn-ghost" data-action="shell-split">Split</button>
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
		const connection = getSurfaceConnection(state, surface.appId);
		const card = document.createElement("article");
		card.className = "store-app-row";
		card.dataset["storeAppId"] = surface.appId;
		card.dataset["storeDisplayName"] = surface.displayName;
		card.dataset["storePackage"] = surface.packageName;
		card.innerHTML = `
			<div class="store-app-icon" style="background:${iconGradientCss(surface.appId)}" aria-hidden="true"></div>
			<div class="store-app-info">
				<div class="store-app-title-line">
					<h4 class="store-app-name">${escapeHtml(surface.displayName)}</h4>
					${live ? '<span class="store-live-dot" title="Active session"></span>' : ""}
					${connection ? `<span class="${connectionChipClass(connection.status)}">${escapeHtml(formatSurfaceConnectionStatus(connection.status))}</span>` : ""}
				</div>
				<p class="store-app-subtitle">${escapeHtml(surface.summary)}</p>
				${
					connection && connection.status !== "ready"
						? `<p class="store-app-caps">${escapeHtml(connection.detail)}</p>`
						: ""
				}
			</div>
			<div class="store-app-cta">
				<button type="button" class="store-pill-btn store-pill-btn-primary store-pill-compact" data-action="shell">Open</button>
				<button type="button" class="store-pill-btn store-pill-btn-ghost store-pill-compact" data-action="shell-split">Split</button>
			</div>
		`;
		attachSurfaceLaunchHandlers(card, surface, selectedPersona);
		container.appendChild(card);
	}
}

function getLeadStream(streams: StreamDestinationState[]): StreamDestinationState | null {
	return (
		streams.find((stream) => stream.status === "live") ??
		streams.find((stream) => stream.status === "standby") ??
		null
	);
}

function renderStreamStage(state: RuntimeShellState): void {
	const leadStream = getLeadStream(state.streams);
	if (!leadStream || !leadStream.appId) {
		streamTheaterMode = false;
		els.panelStream.classList.remove("is-stream-theater");
		els.streamStageShell.hidden = true;
		els.streamStageFrame.src = "about:blank";
		return;
	}

	const catalogSurface =
		getCatalogSurfaces(state).find((entry) => entry.appId === leadStream.appId) ?? null;
	const session =
		state.sessions.find((entry) => entry.sessionId === leadStream.sessionId) ??
		state.sessions.find((entry) => entry.appId === leadStream.appId && entry.status !== "ended") ??
		null;
	const agent =
		state.agents.find((entry) => entry.activeSessionId === leadStream.sessionId) ??
		state.agents.find((entry) => entry.homeAppId === leadStream.appId) ??
		null;
	const connection = getSurfaceConnection(state, leadStream.appId);
	const embedUrl =
		session?.manifest.launchUrl?.trim() ||
		catalogSurface?.launchUrl?.trim() ||
		connection?.launchUrl?.trim() ||
		"about:blank";
	if (els.streamStageFrame.src !== embedUrl) {
		els.streamStageFrame.src = embedUrl;
	}

	els.streamStageShell.hidden = false;
	els.panelStream.classList.toggle("is-stream-theater", streamTheaterMode);
	els.streamStageEyebrow.textContent = `${leadStream.label} · ${leadStream.status}`;
	els.streamStageTitle.textContent = leadStream.scene;
	els.streamStageSummary.textContent =
		catalogSurface && session
			? `${catalogSurface.displayName} is filling the live stage from ${agent?.displayName ?? "the assigned agent"} in ${formatPersona(session.persona)} mode (${leadStream.sourceViewRole ?? "agent"} pane, ${leadStream.takeoverState ?? "agent-active"}).`
			: leadStream.outputLabel;
	els.streamStageMeta.innerHTML = [
		`<span class="chip ${leadStream.status === "live" ? "ok" : ""}">${escapeHtml(leadStream.outputLabel)}</span>`,
		agent ? `<span class="chip accent">${escapeHtml(agent.displayName)}</span>` : "",
		session ? `<span class="chip">${escapeHtml(formatPersona(session.persona))}</span>` : "",
		session ? `<span class="chip">${escapeHtml(session.viewer)}</span>` : "",
		leadStream.sourceViewRole
			? `<span class="chip">${escapeHtml(leadStream.sourceViewRole)} pane</span>`
			: "",
		leadStream.takeoverState
			? `<span class="chip">${escapeHtml(leadStream.takeoverState)}</span>`
			: "",
		`<span class="chip">${escapeHtml(leadStream.destinationType)}</span>`,
		`<span class="chip">${leadStream.viewerCount} viewers</span>`,
		`<span class="chip">${escapeHtml(leadStream.captureMode)}</span>`,
		connection
			? `<span class="${connectionChipClass(connection.status)}">${escapeHtml(formatSurfaceConnectionStatus(connection.status))}</span>`
			: "",
	]
		.filter(Boolean)
		.join("");
	els.streamStageThread.disabled = !state.chatThreads.some((thread) => thread.kind === "stream");
	els.streamStageTheater.textContent = streamTheaterMode ? "Exit Theater" : "Theater";
}

function formatPermissionGate(value: BroadcastState["permissions"]["screen"]): string {
	return value.replace(/_/g, " ");
}

function renderBroadcastLogs(lines: string[]): void {
	els.broadcastLogList.innerHTML = "";
	if (lines.length === 0) {
		els.broadcastLogList.innerHTML =
			'<div class="empty-state">Broadcaster logs will appear here.</div>';
		return;
	}
	for (const line of lines) {
		const entry = document.createElement("div");
		entry.className = "broadcast-log-entry";
		entry.textContent = line;
		els.broadcastLogList.appendChild(entry);
	}
}

function renderBroadcastConsole(broadcast: BroadcastState): void {
	const sourceName = broadcast.source.displayName ?? "No agent source";
	const permissionSummary = [
		`screen ${formatPermissionGate(broadcast.permissions.screen)}`,
		`system ${formatPermissionGate(broadcast.permissions.systemAudio)}`,
		`mic ${formatPermissionGate(broadcast.permissions.microphone)}`,
	].join(" · ");

	els.broadcastConsoleSummary.textContent = `${sourceName} · ${broadcast.source.outputLabel} · ${broadcast.source.viewRole ?? "idle"} pane · ${broadcast.source.takeoverState ?? "idle"}. ${permissionSummary}.`;
	els.broadcastConsoleChips.innerHTML = [
		`<span class="chip ${broadcast.status === "live" ? "ok" : broadcast.status === "error" ? "warn" : ""}">${escapeHtml(broadcast.status)}</span>`,
		`<span class="chip">${escapeHtml(sourceName)}</span>`,
		`<span class="chip">${broadcast.health.fps} fps</span>`,
		`<span class="chip">${broadcast.health.bitrateKbps} kbps</span>`,
		`<span class="chip">${broadcast.health.droppedFrames} drops</span>`,
		broadcast.lastError
			? `<span class="chip warn">${escapeHtml(broadcast.lastError)}</span>`
			: "",
	]
		.filter(Boolean)
		.join("");

	if (document.activeElement !== els.broadcastDestination) {
		els.broadcastDestination.value = broadcast.config.destinationUrl;
	}
	els.broadcastStreamKey.placeholder = broadcast.config.streamKeyRef
		? `Saved ${broadcast.config.streamKeyRef}`
		: "Paste stream key";

	els.broadcastBusAppEnabled.checked = broadcast.config.audioBuses.app.enabled;
	els.broadcastBusAppMuted.checked = broadcast.config.audioBuses.app.muted;
	els.broadcastBusAppGain.value = String(broadcast.config.audioBuses.app.gainPct);
	els.broadcastBusSystemEnabled.checked = broadcast.config.audioBuses.system.enabled;
	els.broadcastBusSystemMuted.checked = broadcast.config.audioBuses.system.muted;
	els.broadcastBusSystemGain.value = String(broadcast.config.audioBuses.system.gainPct);
	els.broadcastBusMicEnabled.checked = broadcast.config.audioBuses.mic.enabled;
	els.broadcastBusMicMuted.checked = broadcast.config.audioBuses.mic.muted;
	els.broadcastBusMicGain.value = String(broadcast.config.audioBuses.mic.gainPct);

	els.broadcastStart.disabled =
		broadcast.status === "live" || broadcast.status === "starting";
	els.broadcastStop.disabled =
		broadcast.status === "idle" || broadcast.status === "stopping";
	els.broadcastReveal.disabled = broadcast.source.sessionId === null;

	renderBroadcastLogs(broadcast.recentLogs);
}

async function hydrateRuntimeState(): Promise<void> {
	const state = await electrobun.rpc!.request.getRuntimeState({});
	renderRuntimeShellState(state);
}

function renderRuntimeShellState(state: RuntimeShellState): void {
	currentState = state;
	updateOnboarding(state);
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
	renderStreamStage(state);
	renderBroadcastConsole(state.broadcast);
	renderBabylonWorkbench(babylonSnapshot);
	renderStewardWorkbench(stewardSnapshot);
	renderProtocolWorkbench(protocolSnapshot);
	renderAppsCatalog();
	renderThreadFilterUi();
	renderThreads(visibleThreads);
	renderActiveThread();
	renderWorkspaces(state.workspaces);
	if (
		isWalletTabVisible() &&
		shouldShowBabylonWallet(state) &&
		(!babylonSnapshot || Date.now() - babylonLastFetchedAt > 30_000)
	) {
		void refreshBabylonWorkbench();
	}
	if (
		isWalletTabVisible() &&
		(!stewardSnapshot || Date.now() - stewardLastFetchedAt > 30_000)
	) {
		void refreshStewardWorkbench();
	}
	if (
		isWalletTabVisible() &&
		(!protocolSnapshot || Date.now() - protocolLastFetchedAt > 30_000)
	) {
		void refreshProtocolWorkbench();
	}
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

const AI_LINK_STATUS_PRESENTATION: Record<
	AiLinkStatus,
	{ label: string; chipClass: string }
> = {
	ok: { label: "Connected", chipClass: "chip ok" },
	configured: { label: "Configured", chipClass: "chip" },
	unconfigured: { label: "Unconfigured", chipClass: "chip" },
	auth_required: { label: "Auth required", chipClass: "chip" },
	error: { label: "Error", chipClass: "chip warn" },
	offline: { label: "Offline", chipClass: "chip warn" },
};

function statusLabel(status: AiLinkStatus): string {
	return AI_LINK_STATUS_PRESENTATION[status].label;
}

function statusChipClass(status: AiLinkStatus): string {
	return AI_LINK_STATUS_PRESENTATION[status].chipClass;
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
				${stream.sourceViewRole ? `<span class="chip">${stream.sourceViewRole} pane</span>` : ""}
				${stream.takeoverState ? `<span class="chip">${stream.takeoverState}</span>` : ""}
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
				<div class="pip-sub">Focus: ${screen.focus}${screen.liveViewRole ? ` · ${screen.liveViewRole} pane` : ""}${screen.takeoverState ? ` · ${screen.takeoverState}` : ""}</div>
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
		const surface = getCatalogSurfaces(currentState).find(
			(entry) => entry.appId === workspace.appId,
		);
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
	return (
		getCatalogSurfaces(currentState).find((surface) => surface.appId === appId)
			?.displayName ?? appId
	);
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
