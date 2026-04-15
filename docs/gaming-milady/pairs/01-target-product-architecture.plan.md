# Atomic Plan: Target Product Architecture

**Goal**
- Define the Milady-shaped target product structure, package boundaries, white-label seams, and migration posture from the current ElectroBun shell.

**Dependencies**
- `00-source-of-truth`
- [SHARED_CONTRACTS.md](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md)

**Locked Decisions**
- Rebuild concepts cleanly in the template with selective borrowing.
- Optimize for a shipped white-label gaming product, not a demo.
- The architecture must support desktop, dashboard/web, runtime/API, and cloud.

## Phase Plan

1. Define the future package and app topology.
2. Define desktop, dashboard, runtime, and cloud responsibilities.
3. Define branding and white-label seams with `BrandingProfile`.
4. Define migration boundaries between reusable template code and new Milady-shaped systems.

## Verification

- [ ] The future topology is explicit.
- [ ] White-label seams are first-class.
- [ ] Support surfaces and game apps have clear homes.

## Exit Criteria

An implementer can scaffold the target repository shape without deciding package boundaries themselves.

## Defaults

- Desktop-first shell with full-product parity target.
- Cloud remains in scope from day one.
