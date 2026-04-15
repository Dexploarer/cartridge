# Atomic Plan: Wallet, Identity, And Gamer Profiles

**Goal**
- Define the product-wide wallet, identity, and approval system for agent gamers, dev gamers, and user gamers with a dual-chain posture.

**Dependencies**
- `01-target-product-architecture`
- `02-runtime-and-plugin-platform`
- `08-companion-browser-steward`

**Locked Decisions**
- Preserve wallet capability.
- Support dual-chain Solana + EVM.
- Use three persona-specific `WalletProfileSpec` variants.

## Phase Plan

1. Define the three gamer profiles and their responsibilities.
2. Define identity, custody, and approval models.
3. Define app bindings and support-surface handoffs.
4. Define acceptance criteria and security defaults.

## Verification

- [ ] All three personas are covered.
- [ ] Dual-chain posture is explicit.
- [ ] Approval policy is clear for transfers, trades, and game-linked actions.

## Exit Criteria

Wallet and identity behavior is implementation-safe across every surface in the product.

## Defaults

- Manual-signature or policy-gated approvals for value-moving actions.
- Hybrid custody is allowed where justified by product flow.
