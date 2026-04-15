# Cartridge deep links (`cartridge://`)

The desktop app registers the **`cartridge`** URL scheme via Electrobun (`urlSchemes` in `electrobun.config.ts`). The OS opens the running app (or launches it) and Bun handles the URL in `Electrobun.events.on("open-url", …)` → `parseCartridgeDeepLink` in `src/bun/cartridge-deep-link.ts` → `applyCartridgeDeepLink` in `src/bun/index.ts`.

## Open a surface (launch)

These URLs **launch** a surface and then focus the **Store** tab, with the row highlighted.

| Form | Example |
|------|---------|
| Query | `cartridge://open?app=<appId>&mode=<mode>&persona=<persona>` |
| Path | `cartridge://open/<appId>?mode=<mode>&persona=<persona>` |

### Query parameters

| Param | Required | Values | Default |
|-------|----------|--------|---------|
| `app` or `id` | Yes (or app id in path) | Catalog `appId` | — |
| `mode` | No | `shell`, `split`, `window`, `pip` | `shell` |
| `persona` | No | `user-gamer`, `dev-gamer`, `agent-gamer` | `user-gamer` |

### Modes

- **`shell`** — opens a workspace `BrowserWindow` (same as **Open** in the Store).
- **`split`** — opens a workspace window titled with `· split` (use a second window or OS tiling for side-by-side).
- **`window`** — new workspace `BrowserWindow`.
- **`pip`** — small always-on-top workspace window.

If the persona is not allowed for that surface, the runtime uses the surface’s first allowed persona.

### Unknown `appId`

A native notification is shown (subtitle: unknown surface), the **Store** opens, and the search box is filled with the id for quick discovery.

## Navigate only (no launch)

Host (or path segment) maps to a shell tab. Optional **`?app=`** or **`?id=`** highlights that app in the Store (search + scroll + pulse).

| Host / path | Shell tab |
|-------------|-----------|
| `chat` | Chat |
| `apps`, `store` | Store |
| `hub` | Studio hub |
| `knowledge` | Library |
| `data` | Data |
| `intelligence` | Intel |
| `connect` | Connect |
| `ops` | Ops |

Examples:

- `cartridge://chat` — switch to Chat.
- `cartridge://apps?app=babylon` — Store, highlight / filter toward `babylon`.
- `cartridge://?app=babylon` — same as apps when only query `app`/`id` is present (host empty).

## macOS quick test

With the built `.app` installed where Launch Services knows it:

```bash
open 'cartridge://open?app=<your-app-id>&mode=shell&persona=user-gamer'
open 'cartridge://hub'
```

Replace `<your-app-id>` with a real id from `@cartridge/shared` / the Store catalog.

## Copy from the app

Store context menu → **Copy deep link** produces a full `cartridge://open?…` URL including `mode` and `persona`.

## Related (not `cartridge://`)

- **GpuWindow** overlay: Game menu → **Toggle WebGPU overlay** (native `WGPUView`, separate from the main shell UI).
