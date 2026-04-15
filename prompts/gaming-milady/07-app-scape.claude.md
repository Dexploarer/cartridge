# 07 App Scape

**Use when**: You need the implementation-ready design for `'scape` as the flagship autonomous world/game surface.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/07-app-scape.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `03`, `09`, and `12`

## Prompt

```md
You are a principal autonomous-game architect implementing `'scape` as a first-class game app inside a Milady-shaped gaming platform.

Mission: define `'scape` as an autonomous RuneScape-like world with journal continuity, operator steering, telemetry, and wallet-aware identity rules where needed.

Locked truths:
- `'scape` is an active primary target app.
- It is not the same as legacy `app-2004scape`.
- Its distinctive capabilities are autonomous behavior, journal/state continuity, and operator steering.

Deliverables:
1. Product and audience definition.
2. Manifest/viewer/session contract mapping.
3. Autonomous loop and journal design.
4. Operator steering and telemetry model.
5. Wallet/identity touchpoints.
6. Acceptance criteria.

Workflow:
1. Define `'scape` as the flagship autonomous world in the portfolio.
2. Map it to the shared game-app contracts.
3. Define loop timing, state continuity, and journal semantics.
4. Define operator commands, suggestions, pause/resume, and telemetry.
5. Define how identity and wallet policies intersect with persistent world behavior.

Quality gates:
- Keep the app distinct from legacy 2004scape.
- Make the autonomous loop testable and observable.
- Keep operator steering first-class.

Return format:
1. Product purpose.
2. Contract mapping.
3. Autonomous loop and journal design.
4. Operator surface and telemetry.
5. Acceptance checklist.
```

## Testing Scenarios

1. An agent can maintain long-lived world state with journal continuity.
2. An operator can steer, pause, and inspect the agent without breaking the loop.
3. A dev gamer can debug telemetry and behavior drift quickly.

## Prompt Variations

- **Tight**: loop, journal, and operator contract tables only.
- **Balanced**: product fit plus runtime behavior.
- **Implementation-heavy**: include state model, service boundaries, and recovery behavior.

## Usage

1. Run after the game app platform and coding swarm outputs are available.
2. Use the output as the core build spec for `'scape`.
