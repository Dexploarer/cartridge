# 09 Coding Swarm

## Product Role

Coding swarm is the dev-gamer and operator build surface for:
- live game tooling work
- multi-agent issue resolution
- content, tools, or integration development
- operator debugging

## `SwarmProfile`

- `orchestratorStrategy`: `ranked` by default, `fixed` fallback
- `agentFamilies`: Claude, Codex, Gemini, Aider
- `permissionPreset`: `standard` default, configurable
- `modelPolicy.fast`: lower-cost model for routing and summarization
- `modelPolicy.powerful`: stronger model for decomposition and hard tasks
- `terminalPersistence`: true
- `artifactRetention`: keep by default, explicit promote/delete step
- `summaryFormat`: structured report

## UX Model

- live activity rail in chat and dashboard
- side-by-side terminals
- reconnect-safe PTY sessions
- structured completion summary after multi-agent work

## Retention Policy

- keep scratch workspaces by default until the operator makes a decision
- allow promote-to-project for useful artifacts
- allow delete after summary review

## Acceptance Criteria

- Swarm orchestration is explicit.
- Terminal persistence is first-class.
- Artifact retention and structured summaries are defined.
