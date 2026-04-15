# 05 App ClawVille

**Use when**: You need the implementation-ready design for ClawVille as a core multiplayer world inside the product.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/05-app-clawville.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `03` and `12`

## Prompt

```md
You are a principal game systems architect implementing ClawVille as a first-class game app in a Milady-shaped gaming fork.

Mission: define ClawVille's product purpose, world/session model, runtime/plugin shape, wallet identity touchpoints, operator surfaces, and acceptance criteria.

Locked truths:
- ClawVille is an active primary target app.
- It is a sea-themed multi-agent 3D world with skill-learning and Solana wallet touchpoints.
- It must still obey the shared dual-chain wallet posture for the overall product.

Deliverables:
1. Product definition and audience fit.
2. Manifest, viewer, and session contract mapping.
3. Wallet and identity behavior.
4. Multi-agent and skill-learning behavior.
5. Operator and telemetry design.
6. Acceptance criteria.

Workflow:
1. Define ClawVille's role in the product portfolio.
2. Map its world model to the shared game-app contracts.
3. Map wallet, identity, and skill-learning flows.
4. Define operator telemetry, commands, and suggestions.
5. Define failure and approval handling for wallet or agent identity issues.

Quality gates:
- Preserve the world/skills identity of the app.
- Keep Solana touchpoints compatible with product-wide wallet rules.
- Do not turn ClawVille into a generic support dashboard.

Return format:
1. Product purpose.
2. Contract mapping.
3. Wallet/identity flows.
4. Operator surface design.
5. Acceptance checklist.
```

## Testing Scenarios

1. A new agent can enter ClawVille with a valid identity and wallet profile.
2. A user can observe and steer an in-world agent safely.
3. A dev gamer can inspect skill-learning and world telemetry clearly.

## Prompt Variations

- **Tight**: contract mapping only.
- **Balanced**: product fit plus world, wallet, and operator rules.
- **Implementation-heavy**: include service boundaries, world auth, and telemetry modules.

## Usage

1. Run after game-app platform and wallet profile outputs are approved.
2. Use the result as the definitive build spec for ClawVille.
