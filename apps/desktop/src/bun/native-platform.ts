/** Electrobun host surface: windows, shortcuts, sessions, menus, and engine bundles. */
import Electrobun, {
	type BrowserView,
	type BrowserWindow,
	ContextMenu,
	GlobalShortcut,
	GpuWindow,
	Screen,
	Session,
	Socket,
	Updater,
	Utils,
	type UpdateStatusEntry,
} from "electrobun/bun";

type JsonPrimitive = string | number | boolean | null;

type JsonObject = {
	[key: string]: JsonValue | undefined;
};

type JsonArray = ReadonlyArray<JsonPrimitive | JsonObject | JsonArray>;

type JsonValue = JsonPrimitive | JsonObject | JsonArray;

type ShellNavigateArg = string | { tab: string; highlightAppId?: string };

type ContextMenuClickEvent = JsonObject & {
	data?: JsonObject & {
		action?: string;
	};
};

export type NativePlatformContext = {
	sendFeed: (from: string, message: string) => void;
	focusMain: () => void;
	sendShellNavigate: (arg: ShellNavigateArg) => void;
};

/** Navigation rules: deny all first, then allow Cartridge and local/dev URLs. */
export const CARTRIDGE_NAVIGATION_RULES: string[] = [
	"^*",
	"views://*",
	"cartridge://*",
	"file:///*",
	"https://*",
	"http://localhost:*",
	"http://127.0.0.1:*",
	// Allow LAN dev servers because game URLs may point at machines on the local network.
	"http://10.*:*",
	"http://192.168.*:*",
	"about:*",
];

export function applyCartridgeNavigationRules(webview: BrowserView): void {
	if (typeof webview.setNavigationRules !== "function") {
		throw new Error("BrowserView.setNavigationRules is unavailable");
	}
	webview.setNavigationRules(CARTRIDGE_NAVIGATION_RULES);
}

/** Allow only safe schemes from renderer `openExternal` RPC. */
export function isAllowedExternalUrl(url: string): boolean {
	try {
		const u = new URL(url);
		return (
			u.protocol === "https:" ||
			u.protocol === "http:" ||
			u.protocol === "mailto:" ||
			u.protocol === "cartridge:"
		);
	} catch {
		return false;
	}
}

let gpuOverlay: GpuWindow | null = null;

function notifyCartridgeUpdater(entry: UpdateStatusEntry): void {
	const { status, message } = entry;
	try {
		if (status === "update-available") {
			Utils.showNotification({
				title: "Cartridge update available",
				body: message,
			});
			return;
		}
		if (status === "download-complete" || status === "complete") {
			Utils.showNotification({
				title: "Cartridge",
				subtitle: "Update ready",
				body: message,
			});
			return;
		}
		if (status === "error") {
			Utils.showNotification({
				title: "Cartridge update",
				body: message,
				silent: true,
			});
		}
	} catch (error) {
		console.warn("[Cartridge] Update notification unavailable:", error);
	}
}

/** Global shortcut to focus the main window and Chat. */
const FOCUS_ACCEL = "CommandOrControl+Shift+.";

function summarizeForFeed(evt: JsonValue, max = 420): string {
	try {
		const raw =
			typeof evt === "object" && evt !== null && !Array.isArray(evt) && "data" in evt
				? JSON.stringify((evt as JsonObject)["data"] ?? evt)
				: JSON.stringify(evt);
		return raw.length > max ? `${raw.slice(0, max)}…` : raw;
	} catch {
		return String(evt);
	}
}

function toggleGpuOverlay(ctx: NativePlatformContext): void {
	if (gpuOverlay) {
		gpuOverlay.close();
		gpuOverlay = null;
		ctx.sendFeed("GPU", "WebGPU overlay window closed.");
		return;
	}
	try {
		const primary = Screen.getPrimaryDisplay();
		const w = 420;
		const h = 280;
		const x = Math.round(primary.workArea.x + primary.workArea.width - w - 24);
		const y = Math.round(primary.workArea.y + 24);
		const win = new GpuWindow({
			title: "Cartridge · GPU overlay",
			frame: { x, y, width: w, height: h },
			titleBarStyle: "default",
			transparent: false,
		});
		win.setAlwaysOnTop(true);
		win.on("close", () => {
			gpuOverlay = null;
		});
		gpuOverlay = win;
		ctx.sendFeed(
			"GPU",
			`GpuWindow #${win.id} · WGPUView #${win.wgpuViewId} (native WebGPU overlay).`,
		);
	} catch (e) {
		ctx.sendFeed(
			"GPU",
			`GpuWindow failed: ${String(e)}. Set build.mac.bundleWGPU in electrobun.config and rebuild.`,
		);
	}
}

/** Log navigation and download events for a webview. */
export function attachWebviewMonitor(webview: BrowserView, ctx: NativePlatformContext): void {
	webview.on("will-navigate", (evt) => {
		ctx.sendFeed("Navigation", summarizeForFeed(evt as JsonValue));
	});
	webview.on("download-started", (evt) => {
		ctx.sendFeed("Download", `started: ${summarizeForFeed(evt as JsonValue)}`);
	});
	webview.on("download-completed", (evt) => {
		ctx.sendFeed("Download", `completed: ${summarizeForFeed(evt as JsonValue)}`);
	});
	webview.on("download-failed", (evt) => {
		ctx.sendFeed("Download", `failed: ${summarizeForFeed(evt as JsonValue)}`);
	});
}

/**
 * Menu actions for `installCartridgeElectrobunIntegration` — return true if handled.
 */
export function handleCartridgeNativeMenuAction(
	action: string | undefined,
	_win: BrowserWindow,
	ctx: NativePlatformContext,
): boolean {
	switch (action) {
		case "cartridge:toggle-gpu-overlay":
			toggleGpuOverlay(ctx);
			return true;
		case "cartridge:check-updates":
			void Updater.checkForUpdate().then((info) => {
				ctx.sendFeed("Updater", JSON.stringify(info, null, 2));
			});
			return true;
		case "cartridge:open-docs":
			Utils.openExternal("https://electrobun.dev");
			ctx.sendFeed("Shell", "Opened Electrobun docs (external browser).");
			return true;
		case "cartridge:clipboard-read": {
			const t = Utils.clipboardReadText();
			ctx.sendFeed("Clipboard", t ?? "(empty)");
			return true;
		}
		case "cartridge:copy-version":
			Utils.clipboardWriteText("Cartridge desktop · shell version (see package.json)");
			ctx.sendFeed("Clipboard", "Copied version string to system clipboard.");
			return true;
		case "cartridge:open-file":
			void Utils.openFileDialog({ canChooseFiles: true, canChooseDirectory: false }).then(
				(paths) => {
					ctx.sendFeed("File", paths.length ? paths.join(", ") : "(cancelled)");
				},
			);
			return true;
		case "cartridge:session-info": {
			const n = Session.defaultSession.cookies.get().length;
			ctx.sendFeed("Session", `cookies in default partition: ${n}`);
			return true;
		}
		case "cartridge:show-native-context-menu":
			ContextMenu.showContextMenu([
				{ label: "Paste clipboard to feed", action: "cartridge:ctx-paste" },
				{ type: "separator" },
				{ label: "Open Electrobun docs", action: "cartridge:ctx-docs" },
			]);
			return true;
		default:
			return false;
	}
}

export function installNativePlatformLayer(
	win: BrowserWindow,
	ctx: NativePlatformContext,
): void {
	// Keep the bundled engine exports in the build.
	void Electrobun.three.REVISION;
	void Electrobun.babylon;

	console.log(
		`[Cartridge] Electrobun RPC WebSocket bridge port ${Socket.rpcPort} (${Socket.rpcServer?.url ?? "n/a"})`,
	);

	try {
		win.maximize();
	} catch (e) {
		console.warn("[Cartridge] Window maximize failed, centering:", e);
		try {
			const frame = win.getFrame();
			const primary = Screen.getPrimaryDisplay();
			const nx = Math.round(
				primary.workArea.x + (primary.workArea.width - frame.width) / 2,
			);
			const ny = Math.round(
				primary.workArea.y + (primary.workArea.height - frame.height) / 2,
			);
			win.setFrame(nx, ny, frame.width, frame.height);
		} catch (e2) {
			console.warn("[Cartridge] Screen center:", e2);
		}
	}

	try {
		const n = Session.defaultSession.cookies.get().length;
		console.log(`[Cartridge] default session cookie count: ${n}`);
	} catch (e) {
		console.warn("[Cartridge] Session:", e);
	}

	Updater.onStatusChange((entry: UpdateStatusEntry) => {
		console.log(`[Cartridge] updater [${entry.status}] ${entry.message}`);
		notifyCartridgeUpdater(entry);
	});

	applyCartridgeNavigationRules(win.webview);

	attachWebviewMonitor(win.webview, ctx);

	GlobalShortcut.register(FOCUS_ACCEL, () => {
		ctx.focusMain();
		ctx.sendShellNavigate("chat");
	});

	Electrobun.events.on("before-quit", () => {
		GlobalShortcut.unregister(FOCUS_ACCEL);
	});

	ContextMenu.on("context-menu-clicked", (evt) => {
		const action = (evt as ContextMenuClickEvent).data?.action;
		if (action === "cartridge:ctx-paste") {
			const t = Utils.clipboardReadText();
			ctx.sendFeed("Clipboard", t ?? "(empty)");
		}
		if (action === "cartridge:ctx-docs") {
			Utils.openExternal("https://electrobun.dev");
		}
	});
}
