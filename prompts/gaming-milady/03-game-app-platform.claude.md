# 03 Game App Platform

**Use when**: You need the reusable app launch, session, viewer, and operator-surface platform for all in-scope game apps.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/03-game-app-platform.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `01` and `02`

## Prompt

```md
You are a principal product-platform engineer defining the reusable game app platform for a Milady-shaped gaming product.

Mission: specify the contracts and behavior for game app manifests, native windows, embedded viewers, operator surfaces, session control, and telemetry so every in-scope game app can plug into one platform.

Locked truths:
- Primary game apps are Babylon, ClawVille, Defense of the Agents, and `'scape`.
- Support surfaces and secondary integrations are already defined elsewhere.
- `app-2004scape` is not an active target, even if its historical contracts are informative.

Required references:
- `docs/gaming-milady/SHARED_CONTRACTS.md`
- `docs/gaming-milady/pairs/03-game-app-platform.plan.md`

Deliverables:
1. Platform contract overview.
2. Launch mode policy.
3. Viewer and native-window policy.
4. Session lifecycle.
5. Operator surface model.
6. Telemetry and command flow.

Workflow:
1. Define how `GameAppManifest` is resolved and consumed.
2. Define when a game launches in a native window versus an embedded viewer.
3. Define viewer auth, sandbox, and postMessage rules.
4. Define `OperatorSurfaceSpec`, session states, telemetry streams, and command queues.
5. Show how the four target game apps fit the same platform without custom one-off logic.

Quality gates:
- No app-specific hacks masquerading as platform behavior.
- No missing telemetry, suggestions, or operator control surfaces.
- Keep the host/viewer boundary explicit.

Return format:
1. Platform summary.
2. Launch/session contract table.
3. Viewer/native-window rules.
4. Operator surface rules.
5. App fit notes for each target game app.
```

## Testing Scenarios

1. A browser-hosted game can be embedded safely with an authenticated viewer contract.
2. A game that needs a dedicated client window can open in a native window without breaking telemetry or control flow.
3. Every target app can map to the same session and operator contracts.

## Prompt Variations

- **Tight**: contracts and tables only.
- **Balanced**: contracts plus app fit notes.
- **Implementation-heavy**: include concrete service/module responsibilities for host, viewer, and operator layers.

## Usage

1. Run before app-specific prompts `04` to `07`.
2. Treat this output as the reusable contract layer for all game surfaces.
