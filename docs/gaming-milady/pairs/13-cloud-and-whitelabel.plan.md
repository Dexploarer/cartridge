# Atomic Plan: Cloud And Whitelabel

**Goal**
- Define how the branded gaming fork uses Eliza Cloud and implements white-label seams for branding, config aliases, environments, and derivative packaging.

**Dependencies**
- `01-target-product-architecture`
- `02-runtime-and-plugin-platform`
- `12-wallet-identity-and-gamer-profiles`

**Locked Decisions**
- Cloud remains in scope.
- White-label behavior is first-class.
- Use `BrandingProfile` as the shared contract.

## Phase Plan

1. Define brand/config seams and environment aliasing.
2. Define hosted runtime and cloud-control integration.
3. Define asset, package, and header alias behavior.
4. Define acceptance criteria for shipping a derivative product.

## Verification

- [ ] Branding profile is explicit.
- [ ] Cloud responsibilities are clear.
- [ ] White-label rules do not leak Milady-specific assumptions into the branded product.

## Exit Criteria

An implementer can ship a branded derivative product with explicit cloud and white-label rules.

## Defaults

- Keep environment alias sync explicit.
- Make brand overrides configuration-driven wherever possible.
