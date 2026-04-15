## Learned User Preferences

- Brand the product as Cartridge; primary visual identity is black, grey, and deep red (not generic neon gaming defaults).
- Aim for functional and layout parity with the Milady AI desktop app (user references a local install at `~/milady`): agent chat UI, apps page layout like Milady, iframe-based surfaces, and avoid treating the shell as a simplified substitute unless scope is explicitly narrowed.
- Support Eliza OS Cloud login and cloud services, plus other external model providers and local models, while keeping the product focused on gaming-specific Milady/ElizaOS-style capabilities.
- Prefer iframe (or equivalent) views for agents playing games, with the ability to pop those views out for picture-in-picture.
- For a full gaming hub on Electrobun, plan to use the broader API surface where it helps (e.g. GpuWindow/WGPUView, GlobalShortcut, Screen, session/cookies, ContextMenu, Updater, Utils such as openExternal/clipboard/file dialogs, webview events, Socket, Three/Babylon bundles); evaluate split-screen or side-by-side layouts in one window for user and agent.
- Keep the main Cartridge shell minimal: primary navigation is Chat and the app store; prefer a modern minimalist flat chat (thin dividers, generous whitespace, minimal marketing chrome).
- Prefer an opaque or low-transparency host window and shell chrome over strong see-through or desktop bleed-through glass effects.
- On launch, open the main window maximized to the work area (not exclusive fullscreen); keep it user-resizable and draggable.
- Prefer unified page templates and a coherent design system across Store and Chat; avoid redundant nested containers that fight Milady-style layouts.

## Learned Workspace Facts

- Cartridge is a Bun monorepo: Electrobun desktop host under `apps/desktop`, with `packages/runtime`, `packages/shared`, and `packages/app-platform` backing the operator shell and runtime state.
- Game `launchUrl` defaults should match the Milady monorepo at `~/milady/eliza` (not the older autonomous-only tree): e.g. **`'scape`** (`@elizaos/app-scape`, not 2004scape) uses the same default xRSPS client as `apps/app-scape/src/index.ts` (`resolveLaunchUrl` → `https://scape-client-2sqyc.kinsta.page`, override `SCAPE_CLIENT_URL` in Milady). Cartridge accepts `CARTRIDGE_LAUNCH_URL_SCAPE` first, then falls back to `SCAPE_CLIENT_URL`, then the catalog default. Babylon local dev still matches `packages/app-core/.../registry-client-app-meta.ts` (`http://localhost:3000`). Support surfaces embed `BRANDING_PROFILE.elizaCloudDashboardUrl` so the shell always has a loadable URL.
- Branding uses Cartridge naming; HTTP headers expose `x-cartridge-*` with Eliza-compatible aliases, and legacy `x-gaming-milady-*` header aliases remain mapped for compatibility.
- Planned follow-ups called out by the user: point `docsUrl` / `appUrl` / `cloudUrl` at real hosts; plug real vector/DB backends into knowledge and data-plane builders when APIs exist; optional rename of npm scope from `@gaming-milady/*` to `@cartridge/*` if package names should match the brand.
- On macOS, the main `BrowserWindow` uses `titleBarStyle: "hiddenInset"` with `transparent: false` so the host paints an opaque shell (no desktop bleed-through).
- At startup, the desktop host maximizes the main window to the primary display work area when `Screen` APIs succeed (`native-platform` path), with centered sizing as fallback; the window stays resizable (not kiosk fullscreen).
- The native Application Menu `Shell` submenu lists only Chat and Store, matching the minimal in-app nav.
- In minimal shell mode (`.shell-minimal`), Chat and Store panels (`#panel-chat`, `#panel-apps`) drop `max-width` gutters and span the full main column; the nav rail uses `-webkit-app-region: drag` with interactive controls exempted via `no-drag`.
- When a user launches an app or game, open it in an Electrobun child window and make the game surface fullscreen inside that child window (not as an embedded panel in the store layout).
