# Atomic Plan: Source Of Truth

**Goal**
- Build the canonical inventory of the current template, active Milady app surfaces, support surfaces, secondary integrations, exclusions, and legacy-only references.

**Dependencies**
- [SHARED_CONTRACTS.md](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md)

**Locked Decisions**
- Primary target apps are Babylon, ClawVille, Defense of the Agents, and `'scape`.
- Support surfaces are Companion, Coding, Steward, and Browser.
- Roblox and Minecraft are secondary integrations.
- `app-2004scape` is excluded from the target build.

## Phase Plan

1. Audit the local template shell and note only the reusable assets.
2. Audit Milady app inventory and separate active targets from support, excluded, and legacy apps.
3. Lock the connector bundle, wallet posture, and cloud/white-label assumptions.
4. Produce an implementation-facing inventory report that later prompts must not contradict.

## Verification

- [ ] Inventory matches the current `eliza/apps/app-*` source of truth plus explicit user overrides.
- [ ] Exclusions are explicit and repeated nowhere as active scope.
- [ ] Shared contracts are referenced instead of restated inconsistently.

## Exit Criteria

Another implementer can read the inventory and know exactly which surfaces belong in the product.

## Defaults

- Community bundle: Discord, Twitch, Telegram, YouTube/Twitch/X/custom RTMP.
- Wallet posture: dual-chain Solana + EVM.
