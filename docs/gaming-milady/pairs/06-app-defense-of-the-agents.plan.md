# Atomic Plan: App Defense Of The Agents

**Goal**
- Define Defense of the Agents as a core strategy game surface with operator steering, telemetry, and lane-control-style session visibility.

**Dependencies**
- `03-game-app-platform`
- `10-chat-connectors-and-streaming`
- `12-wallet-identity-and-gamer-profiles`

**Locked Decisions**
- Defense of the Agents is a primary shipped game app.
- It must behave like a strategy/operator game surface, not a generic telemetry console.
- Its operator tooling must be first-class.

## Phase Plan

1. Define game role and audience fit.
2. Define app manifest, viewer, session, and operator surface.
3. Define telemetry and strategy control model.
4. Define wallet/community/creator touchpoints where relevant.

## Verification

- [ ] Strategy and lane-control identity are preserved.
- [ ] Operator tooling is explicit.
- [ ] The app still fits the shared platform contracts.

## Exit Criteria

Defense of the Agents can be implemented as a coherent strategy game app with strong operator affordances.

## Defaults

- Audience emphasis: agent gamers and dev gamers first.
- Detail panel behavior: split-pane operator dashboard.
