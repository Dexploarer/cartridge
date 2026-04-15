import Electrobun, { Electroview } from "electrobun/view";

const WORKSPACE_TOP_BAND_FRACTION = 0.38;
const WORKSPACE_EMBED_MAX_SCALE = 3.25;

type VisualFitMode = "none" | "topBand";

type ChildWindowRPC = {
	bun: {
		requests: {
			sendToMain: {
				params: { message: string };
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
			setGameEmbed: {
				embedUrl: string;
				splitPlay: boolean;
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
			};
		};
	};
};

let workspaceFitObserver: ResizeObserver | null = null;

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

const windowTitleEl = document.getElementById("window-title") as HTMLHeadingElement;
const surfaceSummaryEl = document.getElementById("surface-summary") as HTMLParagraphElement;
const surfaceMetaEl = document.getElementById("surface-meta") as HTMLDivElement;
const gameViewportEl = document.getElementById("game-viewport") as HTMLDivElement;
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

const rpc = Electroview.defineRPC<ChildWindowRPC>({
	maxRequestTime: 5000,
	handlers: {
		requests: {},
		messages: {
			receiveMessage: ({ from, message }) => {
				addMessage(from, message);
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
				surfaceSummaryEl.textContent = `${title} · ${category} · ${summary}`;
				surfaceMetaEl.innerHTML = [
					`<span class="chip">app:${appId}</span>`,
					...capabilities.map((capability) => `<span class="chip">${capability}</span>`),
					...personas.map((persona) => `<span class="chip">${persona}</span>`),
				].join("");
			},
			setGameEmbed: ({ embedUrl, splitPlay, visualFitMode }) => {
				const wantsSplit = splitPlay === true;
				const url =
					embedUrl.trim().length > 0 ? embedUrl.trim() : "about:blank";
				const fitMode: VisualFitMode =
					visualFitMode === "topBand" ? "topBand" : "none";
				gameFrameAEl.src = url;
				if (wantsSplit) {
					gameFrameBEl.src = url;
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
					gameFrameBEl.src = "about:blank";
					gamePaneBEl.hidden = true;
					gameViewportEl.dataset["split"] = "false";
					mountWorkspaceVisualFit(
						gameViewportEl,
						[{ frame: gameFrameAEl, pane: gamePaneAEl }],
						fitMode,
					);
				}
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
			}) => {
				sessionSummaryEl.textContent = `Session ${sessionId} is ${status} in ${viewer} mode for ${persona}.`;
				sessionMetaEl.innerHTML = [
					`<span class="chip">persona:${persona}</span>`,
					`<span class="chip">status:${status}</span>`,
					`<span class="chip">viewer:${viewer}</span>`,
				].join("");
				sessionControlsEl.innerHTML = [
					...controls.map((control) => `<span class="chip">${control}</span>`),
					...suggestions.map((suggestion) => `<span class="chip">${suggestion}</span>`),
				].join("");
				sessionRouteEl.textContent = `Assigned agent: ${agentName}. Chat route: ${threadTitle}. PiP screen: ${screenTitle}.`;
				sessionStreamsEl.innerHTML =
					liveStreams.length > 0
						? liveStreams.map((stream) => `<span class="chip">${stream}</span>`).join("")
						: '<span class="chip">No live streams routed</span>';
			},
		},
	},
});

const electrobun = new Electrobun.Electroview({ rpc });

toggleDetailsBtn.addEventListener("click", () => {
	const willOpen = detailsDrawer.hidden;
	detailsDrawer.hidden = !willOpen;
	toggleDetailsBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
});

sendBtn.addEventListener("click", async () => {
	const message = messageInput.value.trim();
	if (!message) return;

	await electrobun.rpc!.request.sendToMain({ message });
	addMessage("You", message);
	messageInput.value = "";
});

messageInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") sendBtn.click();
});

function addMessage(from: string, message: string) {
	const emptyState = messagesDiv.querySelector(".empty-state");
	if (emptyState) emptyState.remove();

	const entry = document.createElement("div");
	entry.className = "message-entry";
	entry.innerHTML = `<span class="from">${from}:</span> ${message}`;
	messagesDiv.appendChild(entry);
	messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
