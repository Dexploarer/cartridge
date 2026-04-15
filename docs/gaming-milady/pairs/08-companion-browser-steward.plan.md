# Atomic Plan: Companion, Browser, And Steward

**Goal**
- Define how Companion, Browser, and Steward work together as the immersive control, browsing, and wallet-action support surfaces for the gaming product.

**Dependencies**
- `01-target-product-architecture`
- `03-game-app-platform`
- `12-wallet-identity-and-gamer-profiles`

**Locked Decisions**
- Companion is the immersive avatar/VRM surface.
- Browser is the controlled web workspace and game/web bridge.
- Steward is the wallet-action and approval support surface.

## Phase Plan

1. Define role boundaries between Companion, Browser, and Steward.
2. Define persona-specific flows for agent gamers, dev gamers, and user gamers.
3. Define wallet/browser/app handoffs.
4. Define UX and telemetry requirements.

## Verification

- [ ] The three support surfaces have non-overlapping responsibilities.
- [ ] Wallet flows are coherent across them.
- [ ] Companion remains game-facing and immersive.

## Exit Criteria

Support surfaces operate as one coherent gamer/devgamer/usergamer layer.

## Defaults

- Companion owns immersive state.
- Browser owns web and external app workspace.
- Steward owns wallet approvals and transaction UX.
