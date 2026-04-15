# 13 Cloud And Whitelabel

**Use when**: You need the hosted-runtime and white-label design for the product.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/13-cloud-and-whitelabel.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `01`, `02`, and `12`

## Prompt

```md
You are a principal platform architect defining cloud usage and white-label seams for a Milady-shaped gaming derivative product.

Mission: specify how the product uses Eliza Cloud, brand/config aliases, environment sync, asset overrides, and package-level white-label behavior so the product can ship under a distinct gaming brand.

Locked truths:
- Cloud stays in scope.
- White-label seams are part of the core product architecture.
- Use `BrandingProfile`.

Deliverables:
1. Branding profile definition.
2. Cloud integration model.
3. Environment and header alias strategy.
4. Asset/package override strategy.
5. Shipping and acceptance criteria.

Workflow:
1. Define the `BrandingProfile`.
2. Define how cloud-managed runtime and local runtime interact.
3. Define environment alias sync, headers, and client identifiers.
4. Define how assets, packages, and docs are rebranded safely.
5. Define what must remain compatible with upstream concepts versus fully branded.

Quality gates:
- No vague branding model.
- No cloud ambiguity.
- No accidental reintroduction of excluded product areas.

Return format:
1. Branding profile.
2. Cloud architecture.
3. Alias and env strategy.
4. Override rules.
5. Acceptance checklist.
```

## Testing Scenarios

1. A branded derivative can change names, assets, and headers without breaking runtime behavior.
2. A hosted cloud agent can participate in the same product flows as a local desktop agent.
3. Wallet, swarm, and game-app surfaces still function under branded configuration.

## Prompt Variations

- **Tight**: branding and cloud tables only.
- **Balanced**: branding, cloud, and alias strategy.
- **Implementation-heavy**: include config modules, environment mapping, and asset ownership rules.

## Usage

1. Run before release planning or cloud-hosted rollout work.
2. Use the result as the canonical cloud and white-label spec.
