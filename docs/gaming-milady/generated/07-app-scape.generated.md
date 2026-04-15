# 07 App Scape

## Product Role

`'scape` is the flagship autonomous world in the portfolio:
- an agent-first RuneScape-like environment
- persistent world participation
- journal-backed continuity
- operator steering layered on top of autonomy

It must stay distinct from legacy `app-2004scape`.

## Contract Mapping

### `GameAppManifest`
- `packageName`: `@elizaos/app-scape`
- `displayName`: `'scape`
- `category`: `game`
- `launchType`: `connect`
- `capabilities`: `autonomous`, `game`, `journal`, `operator-steering`

### `OperatorSurfaceSpec`
- controls: suggest task, inject directive, pause loop, resume loop, inspect inventory/state, redirect objective
- telemetry: world position, task state, journal state, loop timing, command history
- suggestions: co-pilot
- pause/resume: yes

## Autonomous Loop

The loop should expose:
- tick cadence
- selected model tier
- current objective
- latest world observation
- latest journal entry
- pending operator directives

## Journal Continuity

The journal is the continuity layer for:
- goals
- remembered world state
- progress and blockers
- operator interventions
- recovery after disconnect or restart

## Persona Flows

### Agent gamer
- runs autonomously within world constraints
- updates journal continuously
- accepts operator intervention without losing continuity

### Dev gamer
- inspects behavior drift, loop timing, and journal quality

### User gamer
- spectates or lightly steers the agent as an entertainment experience

## Acceptance Criteria

- `'scape` is defined as the flagship autonomous world.
- Journal continuity is explicit and first-class.
- Operator steering, telemetry, and pause/resume are implementation-safe.
