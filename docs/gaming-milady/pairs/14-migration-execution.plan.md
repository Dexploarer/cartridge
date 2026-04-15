# Atomic Plan: Migration Execution

**Goal**
- Orchestrate the full migration from the minimal ElectroBun template to the Milady-shaped gaming product using the outputs of all prior prompt/doc pairs.

**Dependencies**
- All prior prompt/doc pairs
- [IMPLEMENTATION_PHASES.md](/Users/home/Cartridge/docs/gaming-milady/IMPLEMENTATION_PHASES.md)

**Locked Decisions**
- This plan executes the already-locked architecture and subsystem decisions.
- It must preserve the app inventory, exclusions, connector bundle, wallet posture, and white-label requirements.

## Phase Plan

1. Establish migration checkpoints and repo topology changes.
2. Sequence runtime, app platform, primary apps, support surfaces, connectors, wallet, and cloud work.
3. Define validation gates between phases.
4. Define release readiness and rollback checkpoints.

## Verification

- [ ] Build order depends only on prior locked decisions.
- [ ] Phase gates are explicit.
- [ ] Release readiness covers desktop, app surfaces, wallet, connectors, swarm, and cloud.

## Exit Criteria

Another implementer can execute the migration in order without making sequencing or release decisions.

## Defaults

- Validate each subsystem before moving forward.
- Favor small reviewable increments over large rewrites.
