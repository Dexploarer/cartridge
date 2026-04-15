# 14 Migration Execution

## Ordered Migration Sequence

### Phase 1: Workspace conversion
- convert the current single-package repo into a workspace
- preserve the current ElectroBun shell as the seed of `apps/desktop`

### Phase 2: Shared contracts and architecture
- add `packages/shared`
- add `packages/runtime`
- add `packages/app-platform`
- wire the shared contract shapes first

### Phase 3: Dashboard and support surfaces
- add `apps/dashboard`
- add support packages for Companion, Browser, Steward, and Coding

### Phase 4: Primary game apps
- implement Babylon
- implement ClawVille
- implement Defense of the Agents
- implement `'scape`

### Phase 5: Connectors and streaming
- implement Discord, Twitch, Telegram
- implement Twitch/YouTube/X/custom RTMP destinations

### Phase 6: Wallet and identity
- implement persona-aware wallet profiles
- route all approvals through Steward

### Phase 7: Cloud and white-label
- add branding profile system
- add cloud bridge and hosted-runtime controls

### Phase 8: Secondary game integrations
- add Roblox and Minecraft bridge/plugin integrations

### Phase 9: Hardening and release
- validate desktop flows
- validate dashboard and support surfaces
- validate each game app
- validate wallet, connectors, swarm, and cloud

## Validation Gates

- after workspace conversion: desktop shell still boots
- after runtime/app-platform work: contracts compile and surface boundaries are stable
- after each game app: session, telemetry, operator controls, and wallet touchpoints work
- after connectors/streaming: route and moderation behavior work
- after wallet/cloud: approvals and hosted/local runtime visibility work

## Release Checklist

- desktop host works
- dashboard works
- Babylon, ClawVille, Defense of the Agents, and `'scape` are live
- Companion, Browser, Steward, and Coding are coherent
- connectors and streaming are active
- wallet and identity flows are safe
- cloud and white-label config are ready

## Rollback And Risk Notes

- keep phases reviewable and reversible
- never reintroduce excluded or legacy apps as active scope
- lock platform contracts before app-specific implementation
- validate wallet and identity early to avoid expensive rework later
