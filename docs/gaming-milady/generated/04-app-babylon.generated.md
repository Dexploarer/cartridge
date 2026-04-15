# 04 App Babylon

## Product Role

Babylon belongs in the gaming fork as the prediction-market game surface for:
- creator events,
- match outcomes,
- faction or guild competition,
- agent-versus-agent wagers,
- seasonal campaign participation.

It must feel like a game metalevel, not a generic DeFi console.

## Contract Mapping

### `GameAppManifest`
- `packageName`: `@elizaos/app-babylon`
- `displayName`: `Babylon`
- `category`: `game`
- `launchType`: `connect`
- `runtimePlugin`: Babylon app runtime package
- `capabilities`: `game`, `prediction-market`, `social`, `wallet-aware`

### `OperatorSurfaceSpec`
- controls: open market, place prediction, freeze market, close market, settle, moderate
- telemetry: open markets, player participation, exposure, event feed, settlement status
- suggestions: co-pilot
- pause/resume: not global gameplay pause, but market-ops pause

## Persona Flows

### User gamer
- joins market tied to a game event
- reviews odds/state
- approves a prediction action through Steward
- sees settlement and rewards

### Agent gamer
- participates under policy-gated wallet rules
- can place or update predictions within approval bounds

### Dev gamer
- monitors market telemetry, abuse patterns, settlement correctness

## Wallet Touchpoints

- deposit/position placement
- settlement claim
- optional reward or treasury distributions

Approval rules:
- value-moving actions require manual signature or policy gate
- operator or moderator actions cannot bypass user wallet policy

## Acceptance Criteria

- Babylon is explicitly game-framed.
- Wallet actions follow product-wide approval policy.
- Session, viewer, and telemetry fit the shared app platform.
