# Atomic Plan: App Scape

**Goal**
- Define `'scape` as a first-class autonomous RuneScape-like world with operator steering, journal state, directed prompts, and long-lived session telemetry.

**Dependencies**
- `03-game-app-platform`
- `09-coding-swarm`
- `12-wallet-identity-and-gamer-profiles`

**Locked Decisions**
- `'scape` is a primary shipped game app.
- Its differentiators are autonomous loop behavior, journal/state continuity, and operator steering.
- It must remain a current target app even though 2004scape remains a legacy repo reference.

## Phase Plan

1. Define product role and audience fit.
2. Define app manifest, viewer, and session model.
3. Define autonomous loop, journal, and operator-steering behavior.
4. Define telemetry, wallet touchpoints, and acceptance criteria.

## Verification

- [ ] `'scape` is distinct from 2004scape legacy references.
- [ ] Autonomous loop and journal behavior are explicit.
- [ ] Operator control and telemetry fit the shared platform contracts.

## Exit Criteria

`'scape` can be implemented as the flagship autonomous world surface with clear operator and state-management rules.

## Defaults

- Audience emphasis: agent gamers first, dev gamers second.
- Session mode: `spectate-and-steer`.
