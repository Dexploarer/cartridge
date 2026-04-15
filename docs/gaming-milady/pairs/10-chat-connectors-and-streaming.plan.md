# Atomic Plan: Chat Connectors And Streaming

**Goal**
- Scope the gaming-only community connectors, creator streaming destinations, overlays, moderation hooks, and event routing for the product.

**Dependencies**
- `00-source-of-truth`
- `02-runtime-and-plugin-platform`
- `13-cloud-and-whitelabel`

**Locked Decisions**
- Default connector/streaming bundle is Discord, Twitch chat/events, Telegram, YouTube streaming, Twitch streaming, X streaming, and custom RTMP.
- This is a gaming/creator bundle, not a generic enterprise connector matrix.

## Phase Plan

1. Define connector bundle roles with `ConnectorBundleSpec`.
2. Define streaming destinations with `StreamingDestinationSpec`.
3. Define moderation, creator, and community routing rules.
4. Define overlays, TTS, and control hooks.

## Verification

- [ ] Connector bundle is gaming-only.
- [ ] Streaming supports overlays, TTS, and creator ops.
- [ ] Routing rules differentiate community chat from creator broadcast.

## Exit Criteria

Connectors and streaming are scoped tightly enough for implementation without extra product decisions.

## Defaults

- Discord is the primary community hub.
- Twitch and YouTube are primary stream endpoints.
