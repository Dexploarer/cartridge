# 00 Source Of Truth

**Use when**: You need the definitive migration inventory before architecture or implementation work.  
**Mode**: Claude advanced  
**Primary inputs**: local repo, Milady app inventory, [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/00-source-of-truth.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md)

## Prompt

```md
You are a principal repo auditor and product systems architect.

Mission: produce the canonical source-of-truth inventory for a Milady-shaped gaming fork starting from the current `/Users/home/Cartridge` template.

Locked truths:
- The current repo is a minimal ElectroBun shell, not the target architecture.
- Active primary game apps: `@elizaos/app-babylon`, `@clawville/app-clawville`, `@elizaos/app-defense-of-the-agents`, `@elizaos/app-scape`.
- Support surfaces: `@elizaos/app-companion`, `@elizaos/app-coding`, `@elizaos/app-steward`, `@elizaos/app-browser`.
- Secondary integration/plugin targets: Roblox and Minecraft.
- Excluded from target build: `@elizaos/app-form`, `@elizaos/app-lifeops`, `@elizaos/app-shopify`, `@elizaos/app-vincent`.
- Legacy/reference only: `@elizaos/app-2004scape`, `@elizaos/app-hyperscape`, `@elizaos/app-dungeons`, `@elizaos/app-hyperfy`.
- Preserve wallet, coding swarm, cloud, and white-label seams.

Required references:
- `docs/gaming-milady/SHARED_CONTRACTS.md`
- `docs/gaming-milady/pairs/00-source-of-truth.plan.md`

Deliverables:
1. Current template audit.
2. Active target app inventory.
3. Support surface inventory.
4. Secondary integration inventory.
5. Exclusion list.
6. Legacy/reference list.
7. Risks where inventory confusion could cause incorrect implementation.

Workflow:
1. Audit the local repo and describe the current shell objectively.
2. Reconstruct the Milady target inventory using only the locked truths above.
3. Map every in-scope app to a `GameAppManifest` or support classification.
4. Map connector, streaming, wallet, and swarm assumptions to the shared contracts.
5. Flag any implementation traps caused by historical app references.

Quality gates:
- Do not re-add excluded or legacy apps to active scope.
- Keep Roblox and Minecraft secondary.
- Use the shared contract names exactly.
- Be explicit about what is source of truth versus reference only.

Return format:
1. Executive inventory summary.
2. Active target matrix.
3. Support surface matrix.
4. Exclusions and legacy notes.
5. Migration risk notes.
```

## Testing Scenarios

1. The response correctly excludes `app-2004scape` even if the repo still contains it.
2. The response distinguishes primary game apps from support surfaces.
3. The response does not treat Hyperscape or Dungeons as current target apps.

## Prompt Variations

- **Tight**: inventory tables only, minimal narrative.
- **Balanced**: inventory plus risk notes.
- **Implementation-heavy**: inventory plus direct mapping into package/module responsibilities.

## Usage

1. Open the paired plan and shared contracts.
2. Paste this prompt into Claude with the current repo context.
3. Use the output to validate all later subsystem prompts before implementation.
