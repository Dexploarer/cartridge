# 02 Runtime And Plugin Platform

## Runtime Boot Sequence

1. Load `BrandingProfile` and environment aliases.
2. Resolve runtime config from CLI/profile/env/config files.
3. Start core services: logger, event bus, config manager, diagnostics.
4. Register core runtime plugins.
5. Register app-platform services.
6. Register support-surface plugins.
7. Register connector and streaming plugins.
8. Register wallet and cloud services.
9. Register coding swarm services.
10. Expose REST and WebSocket APIs.

## Plugin Categories

### Core runtime
- configuration
- logging
- diagnostics
- event bus
- profile/session state

### App and support plugins
- game apps
- support surfaces
- viewer/auth adapters
- operator surface modules

### External integration plugins
- community connectors
- streaming destinations
- wallet providers
- cloud bridge/services
- secondary game integrations

## App Registry

The app registry is the single source of truth for built-in apps and their session semantics.

It stores:
- `GameAppManifest`
- operator surface registration
- viewer and native-window policy
- supported capabilities
- launch mode
- runtime plugin ownership

## API Groups

- `/api/runtime`: health, config, diagnostics, profile state
- `/api/chat`: chat, messages, threads, agent outputs
- `/api/apps`: app discovery, launch, session state, viewer auth
- `/api/game-sessions`: game telemetry, steering, pause/resume, suggestions
- `/api/companion`: immersive state, avatar/session hooks
- `/api/coding`: swarm orchestration, PTY sessions, summaries, artifact retention
- `/api/connectors`: auth, subscriptions, event routing
- `/api/stream`: destinations, overlay state, TTS, go live/offline
- `/api/wallet`: profile state, approvals, transfers, trades, identity
- `/api/cloud`: hosted status, sync, runtime location, backups

## Event Model

The runtime should be event-driven, with typed domain events such as:
- `app.session.started`
- `app.session.updated`
- `app.session.ended`
- `operator.command.enqueued`
- `operator.command.executed`
- `telemetry.frame.received`
- `wallet.approval.requested`
- `wallet.approval.resolved`
- `stream.destination.changed`
- `connector.message.received`
- `swarm.task.started`
- `swarm.task.completed`

## Ownership Rules

- Runtime owns registration, lifecycle, and shared events.
- App platform owns app manifests and session contracts.
- Game packages own game-specific telemetry and command mapping.
- Support surfaces own their UI-specific state, not core runtime state.
- Wallet and cloud remain first-class platform services, not app-specific hacks.
