# 11 Game Integration Plugins

## Role In The Product

Roblox and Minecraft are external game ecosystem integrations:
- not built-in primary apps
- not separate first-class dashboard products
- plugin/bridge targets that prove the extensibility of the platform

## Integration Pattern

- external bridge service per ecosystem
- shared runtime registration through the plugin platform
- shared telemetry and command model where possible
- game-specific translation layer for commands and events

## Roblox

- bridge into game/server logic
- expose agent command routing
- expose world/state telemetry back to the product
- support community or creator hooks where appropriate

## Minecraft

- bridge into bot or server automation
- expose command and telemetry flows through shared platform contracts
- remain operator-observable and steerable

## Acceptance Criteria

- Neither integration is promoted to a primary app.
- Both reuse the platform instead of inventing bespoke contracts.
- Operators can observe and control them through standard surfaces.
