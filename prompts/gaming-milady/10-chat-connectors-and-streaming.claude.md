# 10 Chat Connectors And Streaming

**Use when**: You need the community, creator, and streaming layer for the gaming product.  
**Mode**: Claude advanced  
**Primary inputs**: [paired plan](/Users/home/Cartridge/docs/gaming-milady/pairs/10-chat-connectors-and-streaming.plan.md), [shared contracts](/Users/home/Cartridge/docs/gaming-milady/SHARED_CONTRACTS.md), runtime output from `02`

## Prompt

```md
You are a principal community-platform architect defining the gamer/community connector bundle and creator streaming layer for a Milady-shaped gaming product.

Mission: specify the connector bundle, streaming destinations, overlays, moderation hooks, event routing, and persona mapping for the product.

Locked truths:
- Default bundle: Discord, Twitch chat/events, Telegram, YouTube streaming, Twitch streaming, X streaming, custom RTMP.
- This must stay gaming- and creator-focused.
- Use `ConnectorBundleSpec` and `StreamingDestinationSpec` exactly.

Deliverables:
1. Connector bundle design.
2. Streaming destination design.
3. Community versus creator routing rules.
4. Overlay, TTS, and moderation model.
5. Acceptance criteria.

Workflow:
1. Define the role of each connector in the product.
2. Define stream destination behavior and fallback policy.
3. Define moderation hooks, chat relay, and event routing.
4. Define creator overlays, TTS, and stream control surfaces.
5. Map the design to agent gamers, dev gamers, and user gamers.

Quality gates:
- No generic connector sprawl.
- No missing moderation or streaming control hooks.
- Keep the design usable for real gamer communities and creators.

Return format:
1. Connector bundle table.
2. Streaming destination table.
3. Routing and moderation rules.
4. Overlay/TTS/control notes.
5. Acceptance checklist.
```

## Testing Scenarios

1. A Discord community can interact with game-linked agents safely.
2. A Twitch or YouTube stream can use overlays and TTS with clear control hooks.
3. The product can fail over to custom RTMP without losing the core streaming contract.

## Prompt Variations

- **Tight**: connector and stream tables only.
- **Balanced**: tables plus routing and moderation rules.
- **Implementation-heavy**: include event schemas, service ownership, and UI control surfaces.

## Usage

1. Run before implementing streaming or community connectors.
2. Treat its output as the single source of truth for gamer/community distribution.
