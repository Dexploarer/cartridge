# 12 Wallet Identity And Gamer Profiles

**Use when**: You need the global wallet, identity, and persona model for the gaming product.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/12-wallet-identity-and-gamer-profiles.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `01`, `02`, and `08`

## Prompt

```md
You are a principal wallet and identity architect defining the gamer-profile system for a Milady-shaped gaming platform.

Mission: specify the wallet, identity, custody, and approval model for agent gamers, dev gamers, and user gamers while preserving a dual-chain Solana + EVM posture.

Locked truths:
- Wallet remains in scope for the shipped product.
- Use `WalletProfileSpec`.
- The model must work across primary game apps, companion/browser/steward, and cloud.

Deliverables:
1. Persona definitions.
2. Wallet profile definitions.
3. Identity and custody policy.
4. Approval policy.
5. App and support-surface bindings.
6. Acceptance criteria.

Workflow:
1. Define the three gamer personas and their needs.
2. Define `WalletProfileSpec` for each persona.
3. Define identity linking, custody, and approval behavior.
4. Map the model into game apps and support surfaces.
5. Define security and failure-handling expectations.

Quality gates:
- No vague approval policy.
- No single-chain simplification.
- No persona ambiguity.

Return format:
1. Persona summary.
2. Wallet profile table.
3. Identity/custody rules.
4. App binding notes.
5. Acceptance checklist.
```

## Testing Scenarios

1. A user gamer can safely approve a wallet action from a game or support surface.
2. An agent gamer can operate under policy-gated permissions without unsafe autonomous transfers.
3. A dev gamer can inspect identity and approval state cleanly across chains.

## Prompt Variations

- **Tight**: persona and wallet profile tables only.
- **Balanced**: profiles plus identity and approval rules.
- **Implementation-heavy**: include signing flow boundaries, custody services, and audit trails.

## Usage

1. Run before finalizing any wallet-aware app or support surface.
2. Treat the output as the canonical wallet/identity spec for the product.
