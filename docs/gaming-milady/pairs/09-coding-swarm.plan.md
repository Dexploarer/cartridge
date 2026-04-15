# Atomic Plan: Coding Swarm

**Goal**
- Reproduce Milady’s branded coding swarm as a first-class dev-gamer surface with orchestration, terminal persistence, workspace retention, and structured summaries.

**Dependencies**
- `01-target-product-architecture`
- `02-runtime-and-plugin-platform`
- `08-companion-browser-steward`

**Locked Decisions**
- Coding swarm is in scope as a core support surface.
- It must support multiple agent families and configurable orchestration strategy.
- It must feel branded and integrated, not bolted on.

## Phase Plan

1. Define swarm personas and product role.
2. Define orchestrator strategy, agent families, and permission presets with `SwarmProfile`.
3. Define terminal UI, activity model, and artifact retention.
4. Define completion summaries and acceptance criteria.

## Verification

- [ ] Swarm profile is explicit.
- [ ] Terminal persistence and artifact retention are covered.
- [ ] Completion summaries and activity UX are defined.

## Exit Criteria

Another implementer can build the coding swarm without making orchestration or UX decisions.

## Defaults

- Strategy: ranked where available, fixed fallback.
- Retention: keep then promote or delete explicitly.
