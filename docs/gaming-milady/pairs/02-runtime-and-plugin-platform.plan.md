# Atomic Plan: Runtime And Plugin Platform

**Goal**
- Define the runtime boot sequence, plugin platform, app registry, role model, API surfaces, and event-driven orchestration rules.

**Dependencies**
- `00-source-of-truth`
- `01-target-product-architecture`
- [SHARED_CONTRACTS.md](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md)

**Locked Decisions**
- Runtime is Milady-shaped and event-driven.
- App surfaces must register through stable manifests and registry contracts.
- Wallet, cloud, connectors, and swarm must plug into the same platform.

## Phase Plan

1. Define runtime boot, config cascade, and service lifecycle.
2. Define plugin categories and loading rules.
3. Define app registry and manifest resolution.
4. Define API surface groups for chat, apps, streaming, wallet, cloud, and diagnostics.

## Verification

- [ ] Runtime responsibilities are explicit.
- [ ] Plugin/app loading rules are stable.
- [ ] API groups align with active product surfaces.

## Exit Criteria

An implementer can build the runtime and plugin layer without making interface decisions.

## Defaults

- Use shared contracts directly.
- Keep plugin loading explicit and category-driven.
