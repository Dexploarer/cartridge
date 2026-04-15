# Atomic Plan: Game Integration Plugins

**Goal**
- Define Roblox and Minecraft as secondary integration/plugin targets that connect into the platform without becoming primary built-in apps.

**Dependencies**
- `02-runtime-and-plugin-platform`
- `03-game-app-platform`
- `10-chat-connectors-and-streaming`

**Locked Decisions**
- Roblox and Minecraft are integration/plugin targets only.
- They must reuse platform contracts where possible.
- They should validate extensibility of the gaming platform.

## Phase Plan

1. Define the plugin/integration role of Roblox and Minecraft.
2. Define connection, auth, event, and command patterns.
3. Define operator, telemetry, and community hooks.
4. Define acceptance criteria and future expansion rules.

## Verification

- [ ] Roblox and Minecraft are not treated as built-in primary apps.
- [ ] They fit platform rules without special-case drift.
- [ ] Their operator and telemetry contracts are clear.

## Exit Criteria

The product has a clear secondary-integration pattern for external game ecosystems.

## Defaults

- Use plugin/integration language consistently.
- Favor bridge/service patterns over new first-class app packages.
