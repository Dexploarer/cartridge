# 08 Companion Browser Steward

## Surface Roles

### Companion
- immersive avatar/VRM shell
- emotional and in-world presence
- game-facing overlays and control affordances

### Browser
- controlled web workspace
- external documentation, account pages, and web tools
- app and creator workspace bridge

### Steward
- wallet action, approval, and transaction UX
- chain/account visibility
- confirmation and policy-gated execution

## Persona Journey Map

### Agent gamer
- operates in-game through Companion-facing presence
- uses Browser only when web context is necessary
- uses Steward only through policy-gated wallet actions

### Dev gamer
- uses Browser for tooling and inspection
- uses Companion for immersive validation and demos
- uses Steward for debugging wallet-linked flows

### User gamer
- experiences Companion as the main control shell
- gets routed into Steward for approvals and value-moving actions

## Handoff Rules

- Game apps hand off to Companion for immersion and presence.
- Game apps hand off to Browser for external web context or auth flows.
- Any value-moving action hands off to Steward before execution.
- Companion can show transaction state, but Steward owns final approval.

## Acceptance Criteria

- Responsibilities do not overlap.
- Companion remains immersive and game-facing.
- Steward is the only owner of approval UX.
- Browser remains a controlled workspace, not a generic browser tab dump.
