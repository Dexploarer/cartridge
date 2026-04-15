# 02 Runtime And Plugin Platform

**Use when**: You need the core runtime, API, registry, and plugin design that everything else will sit on.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/02-runtime-and-plugin-platform.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `00` and `01`

## Prompt

```md
You are a principal runtime engineer designing the Milady-shaped agent platform for a white-label gaming product.

Mission: define the runtime, plugin system, app registry, API layer, and event model required to support the target game apps, support surfaces, wallet, connectors, streaming, swarm, and cloud.

Locked truths:
- The platform must be event-driven and modular.
- Active game apps and support surfaces are already locked by the source-of-truth doc.
- Roblox and Minecraft remain secondary integration targets.
- Wallet, cloud, connectors, and swarm stay in scope.

Required references:
- `docs/gaming-milady/SHARED_CONTRACTS.md`
- `docs/gaming-milady/pairs/02-runtime-and-plugin-platform.plan.md`

Deliverables:
1. Runtime boot and config cascade.
2. Plugin categories and loading sequence.
3. App registry design.
4. API route groups and ownership.
5. Event bus and service lifecycle.
6. Risks around over-coupling or scope bleed.

Workflow:
1. Define runtime responsibilities and lifecycle stages.
2. Define plugin classes for app surfaces, connectors, wallet, cloud, and swarm.
3. Map `GameAppManifest`, `ConnectorBundleSpec`, `WalletProfileSpec`, and `SwarmProfile` into the platform.
4. Define the API groups and event flows needed for every subsystem.
5. Explain how the current shell evolves into this platform without a full repo clone.

Quality gates:
- No polling-first design.
- No ambiguous plugin ownership.
- No missing route groups for active product surfaces.

Return format:
1. Runtime architecture.
2. Plugin platform rules.
3. App registry contract usage.
4. API and event map.
5. Risks and sequencing notes.
```

## Testing Scenarios

1. A new game app can register through the platform without changing core runtime logic.
2. Wallet, cloud, and swarm attach as first-class subsystems.
3. The design keeps excluded product surfaces out of the plugin platform.

## Prompt Variations

- **Tight**: runtime, plugin, and API tables only.
- **Balanced**: runtime plus event map and risks.
- **Implementation-heavy**: include module ownership and interface boundaries.

## Usage

1. Run after architecture is locked.
2. Feed its output into the game app platform prompt and all subsystem implementation prompts.
