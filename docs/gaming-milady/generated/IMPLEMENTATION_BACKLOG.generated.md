# Implementation Backlog

This is the actionable backlog synthesized from all generated subsystem briefs.

## Epic 1: Convert The Template Into A Workspace

- Create workspace root structure for `apps/` and `packages/`
- Move the current ElectroBun shell into `apps/desktop`
- Add shared TypeScript and tooling config for multi-package development
- Preserve existing desktop boot while topology changes

## Epic 2: Install Shared Contracts And Platform Layers

- Add `packages/shared` for contract definitions and branding config
- Add `packages/runtime` for runtime boot and event bus
- Add `packages/app-platform` for app registry, viewer rules, and operator surfaces
- Add REST and WebSocket API layering

## Epic 3: Add The Dashboard And Support Surfaces

- Build `apps/dashboard`
- Add Companion surface package
- Add Browser workspace package
- Add Steward wallet support package
- Add Coding swarm package

## Epic 4: Implement The Primary Game Apps

### Babylon
- implement manifest, viewer, operator dashboard, and wallet-aware prediction actions

### ClawVille
- implement world viewer, identity flow, skill-learning telemetry, and operator controls

### Defense of the Agents
- implement strategy operator surface, lane telemetry, and command queue

### `'scape`
- implement autonomous loop, journal continuity, operator steering, and pause/resume

## Epic 5: Add Community And Creator Distribution

- Add Discord connector
- Add Twitch chat/events connector
- Add Telegram connector
- Add Twitch streaming
- Add YouTube streaming
- Add X streaming
- Add custom RTMP support
- Add overlays and TTS controls

## Epic 6: Add Wallet And Identity

- implement `WalletProfileSpec` support for all three personas
- route approvals through Steward
- expose wallet presence in Companion
- support browser-based linking where needed

## Epic 7: Add Cloud And White-Labeling

- implement `BrandingProfile`
- add environment/header alias sync
- add asset pack override system
- add hosted runtime and local/cloud status model

## Epic 8: Add Secondary Game Integrations

- implement Roblox bridge/plugin
- implement Minecraft bridge/plugin
- connect both to operator and telemetry surfaces

## Validation Gates

- Desktop still launches after workspace conversion
- Shared contracts compile before app work begins
- Each game app validates session, telemetry, and control behavior before moving on
- Wallet and identity validate before release
- Connectors and streaming validate moderation and control hooks before release
- Cloud and white-label config validate before packaging
