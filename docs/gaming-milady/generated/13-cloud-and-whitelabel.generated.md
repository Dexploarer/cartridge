# 13 Cloud And Whitelabel

## BrandingProfile Outcome

The product should ship with one canonical `BrandingProfile` that defines:
- brand name and org
- package scope
- docs/app/cloud URLs
- branded headers and client identifiers
- asset pack for icons, avatars, overlays, and companion visuals
- override policy for env aliases and package naming

## Cloud Model

- local desktop runtime remains supported
- hosted agents run through Eliza Cloud-compatible control semantics
- cloud services expose runtime location, health, logs, backups, and capability toggles
- cloud-hosted and local agents should appear in the same operator product model

## Alias Strategy

- branded headers map back to core runtime headers
- branded environment variables can alias core config keys
- asset overrides are configuration-driven, not hardcoded

## Packaging Rules

- package and asset branding happen at product boundaries
- runtime logic stays neutral where possible
- docs and URLs can be swapped by profile

## Acceptance Criteria

- The derivative can ship under a new brand without invasive runtime rewrites.
- Cloud and local agents coexist in one product model.
- Wallet, swarm, and game apps still function under branded config.
