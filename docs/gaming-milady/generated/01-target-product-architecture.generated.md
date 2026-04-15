# 01 Target Product Architecture

## Target Topology

The target repository should evolve from a single ElectroBun package into a Milady-shaped workspace with clear surface boundaries:

### Apps
- `apps/desktop`: ElectroBun desktop host, native windows, menuing, shell lifecycle
- `apps/dashboard`: web operator/dashboard shell for chat, apps, swarm, cloud, and wallet status

### Packages
- `packages/runtime`: runtime boot, config cascade, service lifecycle, event bus
- `packages/shared`: shared contracts, types, branding config, app manifests
- `packages/app-platform`: app registry, session management, viewers, native-window policies, operator surfaces
- `packages/game-babylon`
- `packages/game-clawville`
- `packages/game-defense-of-the-agents`
- `packages/game-scape`
- `packages/support-companion`
- `packages/support-browser`
- `packages/support-steward`
- `packages/support-coding`
- `packages/connectors`
- `packages/streaming`
- `packages/wallet`
- `packages/cloud`

## Boundary Rules

- `apps/desktop` owns native-window hosting and desktop-only integrations.
- `apps/dashboard` owns browser-rendered operator UX and shared app surfaces.
- `packages/runtime` owns boot order, plugin registration, config, and service orchestration.
- `packages/app-platform` owns `GameAppManifest`, session lifecycle, viewer rules, and operator surfaces.
- Each primary game app gets its own package with product-specific session logic, telemetry, and control semantics.
- Support surfaces remain separate packages to avoid contaminating core game-app logic.

## White-Label Design

White-labeling should be configuration-driven through `BrandingProfile`:
- Brand IDs, names, asset packs, URLs, and package scopes are overrideable.
- Header aliases map branded headers back to core runtime semantics.
- Asset overrides are allowed for icons, avatars, overlays, splash art, and companion themes.
- Package scope changes are allowed at build/publish boundaries, not inside app logic.

## Migration Shape

### Step 1
- Preserve the current ElectroBun shell as the seed for `apps/desktop`.

### Step 2
- Introduce a workspace root and shared package boundaries.

### Step 3
- Add runtime, app-platform, and shared contract packages.

### Step 4
- Add support surfaces and primary game apps against the shared platform.

### Step 5
- Add connectors, streaming, wallet, and cloud subsystems.

## Architecture Outcome

The result is a Milady-shaped product with:
- a desktop-native host,
- a web/dashboard control plane,
- a reusable app platform,
- explicit game-app packages,
- support surfaces that reinforce the gamer/devgamer/usergamer experience,
- cloud and white-label seams that allow derivative shipping.
