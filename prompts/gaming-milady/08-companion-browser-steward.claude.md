# 08 Companion Browser Steward

**Use when**: You need the unified support-surface design for immersive companion, browser workspace, and wallet approval flows.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/08-companion-browser-steward.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `03` and `12`

## Prompt

```md
You are a principal product architect defining the support-surface trio of Companion, Browser, and Steward for a Milady-shaped gaming platform.

Mission: define how these surfaces work together to support immersive agent interaction, controlled web/game browsing, and wallet approvals for agent gamers, dev gamers, and user gamers.

Locked truths:
- Companion is the immersive avatar and control surface.
- Browser is the controlled browsing and external-web bridge surface.
- Steward is the wallet action and approval surface.
- These surfaces must support the active game apps rather than distract from them.

Deliverables:
1. Role boundary summary.
2. Persona flow mapping.
3. Wallet/browser/game handoff design.
4. Telemetry and UI rules.
5. Acceptance criteria.

Workflow:
1. Define each surface's responsibility clearly.
2. Map each persona to the correct support-surface flow.
3. Define how game apps hand off to browser or steward actions when needed.
4. Define companion overlays, browsing controls, and wallet approval UX.
5. Define observability and failure handling.

Quality gates:
- No duplicated responsibilities.
- Wallet approvals are explicit.
- Companion remains immersive and game-facing.

Return format:
1. Surface boundary table.
2. Persona journey map.
3. Handoff rules.
4. UI/telemetry notes.
5. Acceptance checklist.
```

## Testing Scenarios

1. A user gamer can move from a game surface to a wallet approval flow without losing context.
2. A dev gamer can use browser and companion surfaces to debug or inspect gameplay.
3. An agent gamer can remain in-character while still surfacing approvals or browser actions safely.

## Prompt Variations

- **Tight**: responsibility and handoff tables only.
- **Balanced**: surface roles plus persona journeys.
- **Implementation-heavy**: include route boundaries, UI modules, and event handoff rules.

## Usage

1. Run after the game-app platform and wallet profiles are defined.
2. Use the output to implement support surfaces that reinforce the game stack.
