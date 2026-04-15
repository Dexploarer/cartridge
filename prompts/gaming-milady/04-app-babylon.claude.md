# 04 App Babylon

**Use when**: You need the implementation-ready product and platform design for Babylon as a shipped game app.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/04-app-babylon.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `03` and `12`

## Prompt

```md
You are a principal game-product architect implementing Babylon as a first-class game app inside a Milady-shaped gaming platform.

Mission: define Babylon's product role, runtime/plugin shape, viewer/session contract, wallet touchpoints, operator controls, and acceptance criteria.

Locked truths:
- Babylon is an active primary target app.
- Treat it as a prediction-market game surface, not a generic external trading dashboard.
- Use `GameAppManifest`, `OperatorSurfaceSpec`, and `WalletProfileSpec` exactly.

Deliverables:
1. Product definition and audience fit.
2. App manifest and runtime/plugin design.
3. Viewer/session/operator surface design.
4. Wallet, identity, and approval touchpoints.
5. Telemetry and moderation requirements.
6. Acceptance criteria.

Workflow:
1. Define why Babylon belongs in the gaming fork.
2. Map it to the shared app platform contracts.
3. Map user-gamer, agent-gamer, and dev-gamer flows.
4. Define operator controls and telemetry panels.
5. Define launch and approval behavior for wallet-aware actions.

Quality gates:
- Keep Babylon aligned with the gaming product.
- Do not ignore wallet approval policy.
- Avoid finance-product drift that breaks the target audience.

Return format:
1. Product purpose.
2. Contract mapping.
3. Wallet and session flows.
4. Operator controls.
5. Acceptance checklist.
```

## Testing Scenarios

1. A user gamer can enter Babylon and perform wallet-aware game actions safely.
2. An agent gamer can operate inside Babylon with operator oversight.
3. A dev gamer can inspect telemetry and debug sessions without changing the product model.

## Prompt Variations

- **Tight**: manifest, wallet, and operator tables only.
- **Balanced**: product fit plus contract mapping.
- **Implementation-heavy**: include service boundaries and UI surface modules.

## Usage

1. Run after the platform and wallet prompts are available.
2. Use the output as the definitive app-specific build spec for Babylon.
