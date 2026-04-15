# Milady Gaming Prompt Pack

This pack is a Claude-first prompt library plus atomic planning docs for converting the current ElectroBun template into a Milady-shaped white-label gaming product.

## Source Of Truth

- **Current template**: `/Users/home/Cartridge` is a minimal ElectroBun multi-window shell.
- **Milady app inventory basis**: current `eliza/apps/app-*` packages.
- **Primary target game apps**: Babylon, ClawVille, Defense of the Agents, and `'scape`.
- **Support surfaces**: Companion, Coding, Steward, Browser.
- **Excluded from target build**: Form, LifeOps, Shopify, Vincent.
- **Legacy/reference only**: 2004scape, Hyperscape, Dungeons, Hyperfy.

## Usage Order

1. Read [SHARED_CONTRACTS.md](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md).
2. Read [IMPLEMENTATION_PHASES.md](/Users/home/Cartridge/docs/gaming-milady/IMPLEMENTATION_PHASES.md).
3. If you want the already-generated outputs, read [generated/README.md](/Users/home/Cartridge/docs/gaming-milady/generated/README.md).
4. Start with `00-source-of-truth`.
5. Move through `01` to `03` before running any app-specific prompt.
6. Run app prompts `04` to `07`.
7. Run support/system prompts `08` to `14`.

## Catalog

| Pair | Purpose |
| --- | --- |
| `00-source-of-truth` | Inventory the template, Milady seams, active apps, connectors, and exclusions. |
| `01-target-product-architecture` | Lock the Milady-shaped target architecture and package boundaries. |
| `02-runtime-and-plugin-platform` | Define runtime boot, plugin platform, API layer, and event model. |
| `03-game-app-platform` | Define launch/session/viewer/native-window contracts for game apps. |
| `04-app-babylon` | Design and implement the Babylon game surface. |
| `05-app-clawville` | Design and implement the ClawVille game surface. |
| `06-app-defense-of-the-agents` | Design and implement the Defense of the Agents surface. |
| `07-app-scape` | Design and implement the `'scape` game surface. |
| `08-companion-browser-steward` | Align companion, browser, and steward wallet surfaces. |
| `09-coding-swarm` | Reproduce the branded coding swarm surface and orchestration. |
| `10-chat-connectors-and-streaming` | Add gamer/community connectors and creator streaming. |
| `11-game-integration-plugins` | Treat Roblox and Minecraft as secondary integration targets. |
| `12-wallet-identity-and-gamer-profiles` | Define dual-chain wallet, identity, and persona journeys. |
| `13-cloud-and-whitelabel` | Define Eliza Cloud and white-label seams for shipping. |
| `14-migration-execution` | Sequence the full migration and acceptance workflow. |

## Dependency Map

- `00` feeds every other pair.
- `01` must precede `02`, `03`, `08`, `09`, `12`, and `13`.
- `02` must precede all app and connector work.
- `03` must precede `04` to `08`.
- `12` must be available before finalizing Babylon, ClawVille, Companion, Browser, and Steward.
- `13` must be available before release or hosted deployment planning.
- `14` is the final execution prompt after all subsystem docs are agreed.

## Acceptance Standard

- Every prompt is Claude-optimized and advanced-mode.
- Every plan doc is decision-complete and atomic.
- Every artifact reuses the shared contracts and the app-scope rules above.
