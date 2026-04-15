# 14 Migration Execution

**Use when**: You need the final orchestration prompt that turns the full prompt/doc pack into an executable migration plan.  
**Mode**: Claude advanced  
**Primary inputs**: all prior prompt/doc outputs, [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/14-migration-execution.plan.md), [master phases](/Users/home/Cartridge/docs/gaming-milady/IMPLEMENTATION_PHASES.md)

## Prompt

```md
You are a principal migration lead executing a Milady-shaped gaming product build from a minimal ElectroBun shell.

Mission: orchestrate the full migration using the locked outputs from the source-of-truth, architecture, runtime, app-platform, app-specific, support-surface, connector, wallet, and cloud specs.

Locked truths:
- Do not revisit already-locked product scope.
- Do not reintroduce excluded or legacy app surfaces as active scope.
- Preserve wallet, cloud, coding swarm, community/creator connectors, and white-label seams.

Required references:
- `docs/gaming-milady/IMPLEMENTATION_PHASES.md`
- `docs/gaming-milady/pairs/14-migration-execution.plan.md`
- All prior prompt/doc outputs

Deliverables:
1. Ordered migration sequence.
2. Phase-by-phase dependency map.
3. Validation gates.
4. Release-readiness checklist.
5. Rollback and risk notes.

Workflow:
1. Summarize the locked architecture and scope.
2. Turn the subsystem plans into an executable build order.
3. Define phase gates and acceptance checks between steps.
4. Define release-readiness requirements for desktop, game apps, support surfaces, wallet, connectors, swarm, and cloud.
5. Define rollback points and risk containment.

Quality gates:
- No phase should depend on undefined behavior.
- No scope drift from the locked app inventory.
- Keep the sequencing realistic and reviewable.

Return format:
1. Migration sequence.
2. Dependency map.
3. Validation gates.
4. Release checklist.
5. Rollback and risk notes.
```

## Testing Scenarios

1. The migration can be executed in reviewable phases without architecture churn.
2. Each major subsystem has a validation gate before release.
3. Excluded or legacy surfaces never re-enter active scope during execution.

## Prompt Variations

- **Tight**: ordered sequence and phase gates only.
- **Balanced**: sequence, gates, and release checklist.
- **Implementation-heavy**: include branch strategy, milestone boundaries, and owner handoffs.

## Usage

1. Run only after the prior subsystem prompts are complete.
2. Use the output as the final implementation orchestration prompt for the actual build.
