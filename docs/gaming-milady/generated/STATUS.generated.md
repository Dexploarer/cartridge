# Generation Status

This file records which source docs and prompt files were used to create generated outputs.

## Core Docs

| Source | Used | Generated Output |
| --- | --- | --- |
| `docs/gaming-milady/INDEX.md` | Yes | `generated/README.md`, `generated/STATUS.generated.md` |
| `docs/gaming-milady/IMPLEMENTATION_PHASES.md` | Yes | `generated/14-migration-execution.generated.md`, `generated/IMPLEMENTATION_BACKLOG.generated.md` |
| `docs/gaming-milady/SESSION.md` | Yes | `generated/STATUS.generated.md` |
| `docs/gaming-milady/SHARED_CONTRACTS.md` | Yes | `generated/CONTRACT_INSTANCES.generated.md`, all subsystem generated briefs |

## Pair Docs And Prompt Files

| Pair | Plan Used | Prompt Used | Generated Output |
| --- | --- | --- | --- |
| `00-source-of-truth` | Yes | Yes | `00-source-of-truth.generated.md` |
| `01-target-product-architecture` | Yes | Yes | `01-target-product-architecture.generated.md` |
| `02-runtime-and-plugin-platform` | Yes | Yes | `02-runtime-and-plugin-platform.generated.md` |
| `03-game-app-platform` | Yes | Yes | `03-game-app-platform.generated.md` |
| `04-app-babylon` | Yes | Yes | `04-app-babylon.generated.md` |
| `05-app-clawville` | Yes | Yes | `05-app-clawville.generated.md` |
| `06-app-defense-of-the-agents` | Yes | Yes | `06-app-defense-of-the-agents.generated.md` |
| `07-app-scape` | Yes | Yes | `07-app-scape.generated.md` |
| `08-companion-browser-steward` | Yes | Yes | `08-companion-browser-steward.generated.md` |
| `09-coding-swarm` | Yes | Yes | `09-coding-swarm.generated.md` |
| `10-chat-connectors-and-streaming` | Yes | Yes | `10-chat-connectors-and-streaming.generated.md` |
| `11-game-integration-plugins` | Yes | Yes | `11-game-integration-plugins.generated.md` |
| `12-wallet-identity-and-gamer-profiles` | Yes | Yes | `12-wallet-identity-and-gamer-profiles.generated.md` |
| `13-cloud-and-whitelabel` | Yes | Yes | `13-cloud-and-whitelabel.generated.md` |
| `14-migration-execution` | Yes | Yes | `14-migration-execution.generated.md` |

## Additional Generated Artifacts

| Artifact | Purpose |
| --- | --- |
| `generated/CONTRACT_INSTANCES.generated.md` | Concrete instances of the shared contracts for the current product scope |
| `generated/IMPLEMENTATION_BACKLOG.generated.md` | Actionable execution backlog synthesized from all generated subsystem briefs |

## Completion State

- Every numbered pair doc has been used.
- Every numbered prompt file has been used.
- Every numbered pair has a generated output file.
- Shared contracts have been instantiated into concrete product definitions.
