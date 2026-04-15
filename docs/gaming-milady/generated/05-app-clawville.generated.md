# 05 App ClawVille

## Product Role

ClawVille is the multi-agent 3D world in the portfolio:
- immersive, social, and exploratory
- skill-learning oriented
- strongly aligned with agent identity and in-world progression

## Contract Mapping

### `GameAppManifest`
- `packageName`: `@clawville/app-clawville`
- `displayName`: `ClawVille`
- `category`: `game`
- `launchType`: `connect`
- `capabilities`: `game`, `skill-learning`, `multi-agent`, `solana-wallet`

### `OperatorSurfaceSpec`
- controls: visit area, trigger interaction, assign skill objective, suggest action, pause steering
- telemetry: world position, building context, skill state, wallet identity state, social state
- suggestions: co-pilot
- pause/resume: yes

## Persona Flows

### Agent gamer
- enters the world with an identity profile
- learns skills and interacts with buildings or NPCs
- uses a managed wallet profile when needed

### User gamer
- watches or steers a companion agent
- participates in skill-learning loops and token-linked actions

### Dev gamer
- inspects world telemetry, auth, and skill-learning outcomes

## Wallet And Identity

- ClawVille can initialize or link a Solana-aware identity flow.
- Product-wide wallet posture remains dual-chain; ClawVille is Solana-emphasized, not Solana-exclusive.
- Identity continuity must remain visible across sessions.

## Acceptance Criteria

- ClawVille remains a first-class 3D world, not just a wallet demo.
- Skill-learning and multi-agent behavior are core to the brief.
- Solana-specific details do not break the global wallet architecture.
