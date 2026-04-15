# 09 Coding Swarm

**Use when**: You need the branded coding swarm design for game developers and operator workflows.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/09-coding-swarm.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), outputs from `02` and `08`

## Prompt

```md
You are a principal developer-tools architect reproducing Milady's coding swarm as a branded surface inside a white-label gaming product.

Mission: define the coding swarm's product role, orchestration profile, agent family support, terminal UX, workspace retention, summaries, and acceptance criteria.

Locked truths:
- Coding swarm is a core support surface for dev gamers and operator workflows.
- It must use `SwarmProfile`.
- It must support orchestration, multi-agent execution, persistence, and summaries.

Deliverables:
1. Product role and audience fit.
2. `SwarmProfile` definition.
3. Orchestrator, terminal, and activity UX.
4. Workspace retention and artifact policy.
5. Summary/reporting design.
6. Acceptance criteria.

Workflow:
1. Define the swarm as a product surface, not just an internal tool.
2. Define strategy, agent families, permission presets, and model policy.
3. Define terminal persistence, reconnection, and live activity presentation.
4. Define artifact retention and promotion flow.
5. Define structured completion summaries and failure handling.

Quality gates:
- No vague orchestration policy.
- No missing terminal persistence or artifact rules.
- No generic devtool UX that ignores the gaming product context.

Return format:
1. Product role.
2. Swarm profile.
3. UX and lifecycle model.
4. Artifact and summary policy.
5. Acceptance checklist.
```

## Testing Scenarios

1. A dev gamer can run a multi-agent task and keep terminals alive through reconnects.
2. A user can review structured swarm results without reading raw terminal logs.
3. The product can switch agent strategies without changing the surface contract.

## Prompt Variations

- **Tight**: swarm profile and lifecycle tables only.
- **Balanced**: product role plus orchestration and UI.
- **Implementation-heavy**: include backend/runtime services, PTY management, and UI component boundaries.

## Usage

1. Run after runtime and support-surface architecture is defined.
2. Use the result to implement the full branded coding swarm feature.
