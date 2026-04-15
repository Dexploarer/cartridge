# 12 Wallet Identity And Gamer Profiles

## Persona Definitions

### Agent gamer
- autonomous or semi-autonomous in-game actor
- wallet actions constrained by policy
- identity may be system-managed or linked

### Dev gamer
- builder, operator, or debugger
- broader visibility into wallet state and approvals
- may use hybrid custody for testing and ops

### User gamer
- end-user participant
- approval-first posture for value-moving actions
- strongest preference for explicit confirmations

## Wallet Profiles

### Agent gamer
- chains: Solana + EVM
- custody: hybrid
- identity: agent-native
- approvals: policy-gated for transfers/trades, auto or policy-gated for in-game actions depending on risk

### Dev gamer
- chains: Solana + EVM
- custody: hybrid
- identity: team-managed or linked-user
- approvals: manual-signature or policy-gated depending environment

### User gamer
- chains: Solana + EVM
- custody: non-custodial or hybrid
- identity: linked-user
- approvals: manual-signature for transfers and trades

## Surface Bindings

- Companion shows wallet state contextually.
- Steward owns confirmations and execution UX.
- Browser handles web-based auth or provider linking.
- Game apps consume wallet profile state but do not own approval UX.

## Acceptance Criteria

- All three personas are explicit.
- Dual-chain support is preserved.
- Approval policy is stable across games and support surfaces.
