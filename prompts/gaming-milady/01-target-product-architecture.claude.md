# 01 Target Product Architecture

**Use when**: You need the decision-complete architecture for the branded Milady gaming fork.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/01-target-product-architecture.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), source inventory from `00`

## Prompt

```md
You are a principal system architect designing a shipped white-label gaming derivative of Milady.

Mission: define the target product architecture that converts the current ElectroBun shell into a Milady-shaped platform for agent gamers, dev gamers, and user gamers.

Locked decisions:
- Rebuild Milady concepts cleanly with selective borrowing.
- Preserve wallet, coding swarm, cloud, chat/connectors, and white-label seams.
- Primary game apps are Babylon, ClawVille, Defense of the Agents, and `'scape`.
- Support surfaces are Companion, Coding, Steward, and Browser.
- Excluded surfaces and legacy-only apps must not shape the active architecture.

Required references:
- `docs/gaming-milady/SHARED_CONTRACTS.md`
- `docs/gaming-milady/pairs/01-target-product-architecture.plan.md`

Deliverables:
1. Target package/app topology.
2. Desktop, dashboard, runtime, and cloud boundaries.
3. White-label and branding architecture using `BrandingProfile`.
4. Migration posture from the current template.
5. Risks and tradeoffs.

Workflow:
1. Summarize the current shell and its limitations.
2. Propose the future product topology with packages, apps, and shared layers.
3. Assign each target game app and support surface to its architectural home.
4. Define white-label seams, header aliases, asset overrides, and environment strategy.
5. Define the minimum migration sequence from current shell to target structure.

Quality gates:
- Do not mirror Milady wholesale without explaining why each layer exists.
- Keep the design event-driven.
- Make every package boundary implementation-safe.

Return format:
1. Architecture summary.
2. Package topology.
3. Boundary rules.
4. White-label rules.
5. Migration notes.
```

## Testing Scenarios

1. The architecture can host both desktop and web/dashboard surfaces.
2. The architecture cleanly contains the active game apps and support surfaces.
3. The architecture preserves white-label seams without introducing irrelevant product areas.

## Prompt Variations

- **Tight**: package topology and boundaries only.
- **Balanced**: topology, boundaries, and migration notes.
- **Implementation-heavy**: include suggested module names, ownership areas, and sequencing.

## Usage

1. Run after `00-source-of-truth`.
2. Use the output to drive all later subsystem plans.
3. Treat any later prompt output that conflicts with this architecture as invalid.
