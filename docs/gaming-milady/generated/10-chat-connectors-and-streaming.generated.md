# 10 Chat Connectors And Streaming

## Connector Bundle

### Discord
- primary gamer/community hub
- guild, channel, moderation, and notification flows

### Twitch Chat
- stream chat, audience interaction, and event hooks

### Telegram
- mobile-first ops and community interactions

## Streaming Destinations

### Twitch Streaming
- primary live gaming destination
- overlay and TTS capable

### YouTube Streaming
- creator and long-form broadcast surface

### X Streaming
- short-form or creator amplification surface

### Custom RTMP
- fallback and advanced creator routing

## Routing Rules

- Discord owns persistent community state.
- Twitch chat owns live audience interaction during streams.
- Telegram handles mobile ops and direct notifications.
- Streaming destinations share one overlay and TTS control model.

## Overlay And TTS

- overlays include viewer count, agent state, event feed, prompts, and branded elements
- TTS is agent-controlled but operator-governed
- moderation hooks can mute, throttle, or disable live interaction features

## Acceptance Criteria

- The connector bundle stays gaming- and creator-focused.
- Streaming destinations share a consistent control model.
- Moderation and routing rules are implementation-safe.
