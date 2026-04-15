import type { Persona } from "@cartridge/shared";

const PERSONAS: Persona[] = ["agent-gamer", "dev-gamer", "user-gamer"];

const OPEN_MODES = ["shell", "split", "window", "pip"] as const;
type CartridgeOpenMode = (typeof OPEN_MODES)[number];

const TAB_HOSTS: Record<string, string> = {
	chat: "chat",
	apps: "apps",
	store: "apps",
	hub: "hub",
	knowledge: "knowledge",
	data: "data",
	intelligence: "intelligence",
	connect: "connect",
	ops: "ops",
};

type CartridgeDeepLinkResult =
	| {
			kind: "open";
			appId: string;
			mode: CartridgeOpenMode;
			persona: Persona;
	  }
	| {
			kind: "navigate";
			tab: string;
			highlightAppId?: string;
	  };

function normalizePersona(raw: string | null): Persona {
	if (raw && PERSONAS.includes(raw as Persona)) {
		return raw as Persona;
	}
	return "user-gamer";
}

function normalizeOpenMode(raw: string | null): CartridgeOpenMode {
	const m = (raw ?? "shell").toLowerCase();
	return OPEN_MODES.includes(m as CartridgeOpenMode) ? (m as CartridgeOpenMode) : "shell";
}

/**
 * Parse `cartridge://` URLs registered via electrobun `urlSchemes`.
 *
 * Supported:
 * - `cartridge://open?app=<id>&mode=shell|split|window|pip&persona=user-gamer`
 * - `cartridge://open/<appId>?mode=...`
 * - `cartridge://apps`, `cartridge://store`, `cartridge://chat`, … optional `?app=<id>` to highlight in Store
 */
export function parseCartridgeDeepLink(href: string): CartridgeDeepLinkResult | null {
	let u: URL;
	try {
		u = new URL(href);
	} catch {
		return null;
	}
	if (u.protocol !== "cartridge:") {
		return null;
	}

	const host = (u.hostname || "").toLowerCase();
	const path = u.pathname.replace(/^\/+|\/+$/g, "");
	const appParam = u.searchParams.get("app") ?? u.searchParams.get("id");

	if (host === "open" || path === "open" || path.startsWith("open/")) {
		let appId = appParam;
		if (!appId && path.startsWith("open/")) {
			appId = path.slice("open/".length).split("/")[0] ?? null;
		}
		if (!appId) {
			return null;
		}
		const mode = normalizeOpenMode(u.searchParams.get("mode"));
		const persona = normalizePersona(u.searchParams.get("persona"));
		return { kind: "open", appId, mode, persona };
	}

	const tab = TAB_HOSTS[host] ?? (path ? TAB_HOSTS[path] : undefined);

	if (tab) {
		return { kind: "navigate", tab, highlightAppId: appParam ?? undefined };
	}

	if (appParam) {
		return { kind: "navigate", tab: "apps", highlightAppId: appParam };
	}

	return null;
}
