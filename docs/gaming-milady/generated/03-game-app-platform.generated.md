# 03 Game App Platform

## Platform Contracts

Every primary game app uses the same shared contracts:
- `GameAppManifest`
- `OperatorSurfaceSpec`

## Launch Modes

### `connect`
- Use for remote or hosted game experiences that need authenticated app sessions.
- Supports embedded viewers and optional native-window handoff.

### `url`
- Use for support-style surfaces or web-hosted tools that do not need full game-session contracts.

### `native-window`
- Use when a dedicated game client window is needed for stability, input capture, or isolation.

## Viewer Rules

- Embedded viewers use sandboxed iframes with explicit capabilities.
- Viewer auth uses short-lived, app-scoped tokens and postMessage handshake where needed.
- Embedded viewers can receive telemetry and control events only through approved channels.
- Native game windows get isolated storage and cookies and still report into the same session model.

## Session Model

Default mode is `spectate-and-steer`.

Each session exposes:
- connection state
- app capability state
- telemetry streams
- command queue state
- pause/resume support
- suggestions feed
- operator notes or run summaries

## Operator Surface

Each game app gets a dedicated `OperatorSurfaceSpec` describing:
- available controls
- telemetry panels
- suggestion behavior
- pause/resume support
- command queue behavior
- detail panel placement

Default operator detail layout is split-pane:
- game viewer or native window on one side
- telemetry, commands, and suggestions on the other

## Fit For Current Target Apps

### Babylon
- embedded-viewer-first
- wallet-aware game actions
- market and event telemetry

### ClawVille
- embedded-viewer connect flow
- multi-agent world telemetry
- skill-learning and identity state

### Defense of the Agents
- strategy/operator-heavy surface
- telemetry-forward split-pane layout

### `'scape`
- long-lived autonomous session
- journal/state continuity
- strong operator steering and pause/resume
