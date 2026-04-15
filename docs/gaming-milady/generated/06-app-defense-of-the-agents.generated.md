# 06 App Defense Of The Agents

## Product Role

Defense of the Agents is the strategy/operator game surface in the portfolio:
- macro control and observation
- tactical lane or zone telemetry
- agent coordination
- creator-friendly spectator and operator experience

## Contract Mapping

### `GameAppManifest`
- `packageName`: `@elizaos/app-defense-of-the-agents`
- `displayName`: `Defense of the Agents`
- `category`: `game`
- `launchType`: `connect`
- `capabilities`: `strategy`, `telemetry`, `lane-control`

### `OperatorSurfaceSpec`
- controls: assign lane priorities, issue tactical directives, pause/resume steering, inspect unit state
- telemetry: lane state, objective pressure, team coordination, command history
- suggestions: co-pilot
- pause/resume: yes

## Persona Flows

### Agent gamer
- executes strategy and receives tactical suggestions

### Dev gamer
- monitors telemetry and decision quality
- uses coding swarm or browser surfaces to debug supporting systems

### User gamer
- spectates or lightly steers without direct admin-level control

## Community And Creator Hooks

- Stream overlays should expose safe strategic telemetry.
- Twitch/Discord audiences can receive curated state updates.
- Operator actions must remain distinct from creator-facing controls.

## Acceptance Criteria

- The app is treated as a strategy game, not a generic dashboard.
- Operator controls are explicit and measurable.
- Telemetry is rich enough for both steering and broadcasting.
