# 00 Source Of Truth

## Current Template Audit

The current `/Users/home/Cartridge` repo is a minimal ElectroBun desktop shell:
- `package.json` defines a single-package app with `electrobun` and TypeScript.
- `electrobun.config.ts` configures one Bun entrypoint and two browser views.
- `src/bun/index.ts` implements multi-window orchestration with RPC between a main window and child windows.
- `src/mainview/*` and `src/childview/*` provide a simple window UI for RPC messaging.

What is reusable:
- Desktop bootstrapping through ElectroBun.
- Native window creation and RPC patterns.
- The minimal desktop shell as the seed for a Milady-like desktop host.

What is not the target architecture:
- Single-package structure.
- Demo RPC semantics.
- No runtime/plugin/app registry separation.
- No wallet, connectors, cloud, or game-session orchestration.

## Active Product Inventory

### Primary target game apps

| App | Role | Notes |
| --- | --- | --- |
| `@elizaos/app-babylon` | prediction-market game surface | Wallet-aware, social, game-first framing |
| `@clawville/app-clawville` | multi-agent 3D world | Skill-learning, Solana-aware |
| `@elizaos/app-defense-of-the-agents` | strategy/operator game | Strong telemetry and steering |
| `@elizaos/app-scape` | autonomous RuneScape-like world | Journal, operator steering, persistent loop |

### Support surfaces

| Surface | Role |
| --- | --- |
| `@elizaos/app-companion` | immersive VRM/avatar and in-world control surface |
| `@elizaos/app-coding` | coding swarm and terminal experience |
| `@elizaos/app-steward` | wallet approvals, transaction UX, finance support |
| `@elizaos/app-browser` | controlled browser workspace and game/web bridge |

### Secondary integration/plugin targets

| Integration | Role |
| --- | --- |
| Roblox | external game bridge and agent gameplay integration |
| Minecraft | external game bridge and agent gameplay integration |

## Exclusions

These surfaces do not belong in the active target build:
- `@elizaos/app-form`
- `@elizaos/app-lifeops`
- `@elizaos/app-shopify`
- `@elizaos/app-vincent`

## Legacy Or Reference Only

These can inform contracts or migration notes, but must not re-enter active scope:
- `@elizaos/app-2004scape`
- `@elizaos/app-hyperscape`
- `@elizaos/app-dungeons`
- `@elizaos/app-hyperfy`

## Locked Platform Assumptions

- The target product is a shipped white-label gaming platform, not a demo.
- The migration posture is selective borrowing from Milady, not wholesale cloning.
- Wallet remains in scope with dual-chain Solana + EVM support.
- Coding swarm remains in scope as a dev-gamer/operator surface.
- Community and creator distribution remains in scope through Discord, Twitch, Telegram, YouTube/Twitch/X streaming, and custom RTMP.

## Migration Risks

- Historical game-app references can cause scope drift if not treated as legacy only.
- The current template is too small to imply package boundaries; architecture decisions must come from the prompt pack, not the existing shell.
- Babylon can drift into a finance product if its game framing is not enforced.
- ClawVille can drift into a Solana-only architecture if the dual-chain wallet rule is ignored.
- Roblox and Minecraft can accidentally become first-class apps if the secondary-integration rule is not enforced.
