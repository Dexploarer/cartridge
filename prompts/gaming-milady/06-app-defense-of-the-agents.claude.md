# 06 App Defense Of The Agents

**Use when**: You need the implementation-ready design for Defense of the Agents as a strategy/operator game surface.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/06-app-defense-of-the-agents.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `03`, `10`, and `12`

## Prompt

```md
You are a principal strategy-game architect implementing Defense of the Agents inside a Milady-shaped gaming platform.

Mission: define the app's product purpose, session design, operator dashboard, telemetry model, wallet/community touchpoints, and acceptance criteria.

Locked truths:
- Defense of the Agents is an active primary target app.
- It is a strategy game with lane-control and operator telemetry characteristics.
- Its operator surface must be stronger than a generic embedded game viewer.

Deliverables:
1. Product and audience definition.
2. Manifest/viewer/session contract mapping.
3. Operator surface and telemetry design.
4. Community/streaming hooks and wallet touchpoints if needed.
5. Acceptance criteria.

Workflow:
1. Define why this app matters in the product portfolio.
2. Map it to `GameAppManifest` and `OperatorSurfaceSpec`.
3. Define how strategy control, telemetry, and suggestions are presented.
4. Define how community or creator surfaces intersect with the game.
5. Define failure modes and observability expectations.

Quality gates:
- Keep the product centered on strategy gameplay.
- Do not degrade the app into a generic dashboard.
- Make operator controls concrete and testable.

Return format:
1. Product purpose.
2. Contract mapping.
3. Operator and telemetry design.
4. Community and wallet notes.
5. Acceptance checklist.
```

## Testing Scenarios

1. An operator can watch and steer a running strategy session clearly.
2. A creator stream can expose meaningful telemetry without leaking unsafe controls.
3. The game still conforms to the shared platform contract.

## Prompt Variations

- **Tight**: operator and telemetry tables only.
- **Balanced**: product role plus operator/session design.
- **Implementation-heavy**: include UI modules, command channels, and observability hooks.

## Usage

1. Run after the game-app platform is locked.
2. Use the result to implement the dedicated strategy/operator game surface.
