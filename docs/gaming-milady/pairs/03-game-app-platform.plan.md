# Atomic Plan: Game App Platform

**Goal**
- Define the reusable platform contract for launching, embedding, steering, observing, and operating Milady-style game apps in the branded gaming fork.

**Dependencies**
- `01-target-product-architecture`
- `02-runtime-and-plugin-platform`
- [SHARED_CONTRACTS.md](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md)

**Locked Decisions**
- Game apps use shared `GameAppManifest` and `OperatorSurfaceSpec` contracts.
- The platform must support native game windows and embedded viewers.
- The platform must support spectate-and-steer sessions, telemetry, suggestions, and command/control loops.

## Phase Plan

1. Define app manifest resolution and launch modes.
2. Define viewer, sandbox, and native-window policies.
3. Define operator surfaces, session states, and telemetry streams.
4. Define command flow, pause/resume behavior, and auth between host and viewer.

## Verification

- [ ] Launch modes are explicit and reusable.
- [ ] Spectate-and-steer is first-class.
- [ ] Game windows, embedded viewers, and operator surfaces are all covered.

## Exit Criteria

Every current and future game app can plug into one stable platform contract.

## Defaults

- Default session mode: `spectate-and-steer`.
- Default operator detail behavior: split-pane.
