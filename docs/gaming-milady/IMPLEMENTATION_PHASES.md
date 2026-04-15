# Implementation Phases: Milady Gaming Fork

**Project Type**: White-label gaming agent platform  
**Starting Point**: ElectroBun desktop shell  
**Target Shape**: Milady-style runtime + app platform + gaming surfaces + cloud  
**Estimated Total**: 80-110 hours

---

## Phase 1: Source Audit And Scope Lock
**Type**: Infrastructure  
**Estimated**: 4 hours  
**Files**: `docs/gaming-milady/INDEX.md`, `SHARED_CONTRACTS.md`, `pairs/00-source-of-truth.plan.md`

**Tasks**
- [ ] Inventory the current template shell and identify reusable pieces.
- [ ] Lock active Milady app surfaces and exclusions.
- [ ] Lock connector, wallet, swarm, and cloud scope.

**Verification Criteria**
- [ ] Active game apps are documented correctly.
- [ ] Exclusions and legacy references are explicit.
- [ ] Shared contracts exist and are reused.

**Exit Criteria**: The repo has one unambiguous source-of-truth pack for the migration.

---

## Phase 2: Target Product Architecture
**Type**: Infrastructure  
**Estimated**: 6 hours  
**Files**: `pairs/01-target-product-architecture.plan.md`, `prompts/.../01-target-product-architecture.claude.md`

**Tasks**
- [ ] Define the future package layout.
- [ ] Define desktop, dashboard, runtime, and cloud boundaries.
- [ ] Define white-label seams, branding, and release channels.

**Verification Criteria**
- [ ] Package boundaries are stable.
- [ ] Milady-shaped architecture is described without cloning repo internals blindly.
- [ ] White-label behavior is explicit.

**Exit Criteria**: Another engineer can scaffold the target architecture without making product-structure decisions.

---

## Phase 3: Runtime, Plugin Platform, And App Contracts
**Type**: API  
**Estimated**: 8 hours  
**Files**: `pairs/02-runtime-and-plugin-platform.plan.md`, `pairs/03-game-app-platform.plan.md`

**Tasks**
- [ ] Define runtime boot and plugin loading.
- [ ] Define app registry, manifests, viewer contracts, and native game windows.
- [ ] Define operator surfaces, telemetry, and event flow.

**Verification Criteria**
- [ ] Runtime and app contracts reference shared contract shapes.
- [ ] Native-window versus embedded-viewer behavior is clear.
- [ ] Event-driven orchestration is specified.

**Exit Criteria**: Game and support surfaces can be implemented against stable contracts.

---

## Phase 4: Primary Game App Surfaces
**Type**: UI  
**Estimated**: 20 hours  
**Files**: `pairs/04-app-babylon.plan.md` through `pairs/07-app-scape.plan.md`

**Tasks**
- [ ] Define Babylon as a prediction-market game surface.
- [ ] Define ClawVille as the Solana/skills-enabled multiplayer surface.
- [ ] Define Defense of the Agents as the strategy/operator surface.
- [ ] Define `'scape` as the autonomous RuneScape-like spectate-and-steer surface.

**Verification Criteria**
- [ ] Each app plan covers product purpose, runtime/plugin shape, session/viewer contract, wallet touchpoints, telemetry, and operator controls.
- [ ] No excluded or legacy apps are treated as current targets.

**Exit Criteria**: Every primary game app has a ready-to-execute prompt and a decision-complete implementation plan.

---

## Phase 5: Support Surfaces
**Type**: UI  
**Estimated**: 12 hours  
**Files**: `pairs/08-companion-browser-steward.plan.md`, `pairs/09-coding-swarm.plan.md`

**Tasks**
- [ ] Define companion, browser, and steward roles for gamer/dev-gamer/user-gamer flows.
- [ ] Define branded coding swarm orchestration and UI.

**Verification Criteria**
- [ ] Support surfaces are tied to real game or operator workflows.
- [ ] Coding swarm covers orchestrator, terminals, summaries, and retention.

**Exit Criteria**: Support surfaces strengthen the game platform instead of existing as isolated features.

---

## Phase 6: Connectors, Streaming, And Secondary Integrations
**Type**: Integration  
**Estimated**: 10 hours  
**Files**: `pairs/10-chat-connectors-and-streaming.plan.md`, `pairs/11-game-integration-plugins.plan.md`

**Tasks**
- [ ] Define the gamer/community connector bundle.
- [ ] Define creator streaming and overlay behavior.
- [ ] Define Roblox and Minecraft as secondary integration/plugin surfaces.

**Verification Criteria**
- [ ] Connector bundle is gaming-only.
- [ ] Streaming destinations include Twitch, YouTube, X, and custom RTMP.
- [ ] Roblox and Minecraft are not elevated to built-in primary apps.

**Exit Criteria**: Community, creator, and secondary integration surfaces are scoped cleanly.

---

## Phase 7: Wallet, Cloud, And Release Execution
**Type**: Integration  
**Estimated**: 14 hours  
**Files**: `pairs/12-wallet-identity-and-gamer-profiles.plan.md`, `pairs/13-cloud-and-whitelabel.plan.md`, `pairs/14-migration-execution.plan.md`

**Tasks**
- [ ] Define wallet and identity roles across the three target audiences.
- [ ] Define Eliza Cloud and brandable control-plane seams.
- [ ] Sequence migration, rollout, and acceptance.

**Verification Criteria**
- [ ] Dual-chain wallet posture is preserved.
- [ ] Cloud and white-label seams are implementation-ready.
- [ ] Final migration prompt references all prior subsystem decisions.

**Exit Criteria**: The repository contains a complete execution pack for building the target product.
