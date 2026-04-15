# 11 Game Integration Plugins

**Use when**: You need the integration design for Roblox and Minecraft as secondary game plugin targets.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/11-game-integration-plugins.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `02`, `03`, and `10`

## Prompt

```md
You are a principal integrations architect defining Roblox and Minecraft as secondary game-integration/plugin targets in a Milady-shaped gaming platform.

Mission: specify how Roblox and Minecraft connect into the runtime, app platform, telemetry model, and community surfaces without becoming built-in primary apps.

Locked truths:
- Roblox and Minecraft are secondary integration/plugin targets.
- They should validate extensibility of the platform.
- They must not displace the active built-in game apps.

Deliverables:
1. Integration role definition.
2. Auth and bridge model.
3. Event and command model.
4. Operator and telemetry model.
5. Acceptance criteria.

Workflow:
1. Define the plugin/integration pattern for external game ecosystems.
2. Map Roblox and Minecraft to bridge, command, and telemetry contracts.
3. Define how operators and communities interact with those integrations.
4. Define what is shared versus game-specific.
5. Define future expansion rules without reclassifying them as primary apps.

Quality gates:
- No promotion of Roblox or Minecraft to first-class built-in apps.
- No bespoke contracts that break the shared platform.
- Keep the design implementation-safe and game-specific.

Return format:
1. Integration role summary.
2. Bridge/auth contract.
3. Event/command model.
4. Operator/community notes.
5. Acceptance checklist.
```

## Testing Scenarios

1. A Minecraft bot integration can plug into the platform without adding a new primary app package.
2. A Roblox agent bridge can expose commands and telemetry through existing platform contracts.
3. Community and creator surfaces can observe or influence these integrations safely.

## Prompt Variations

- **Tight**: integration contracts only.
- **Balanced**: integration role plus operator and community notes.
- **Implementation-heavy**: include bridge services, event schemas, and failure handling.

## Usage

1. Run after the runtime and game-app platform are locked.
2. Use the output as the secondary-integration spec for external game ecosystems.
