# Contract Instances

This file instantiates the shared contract shapes for the current Milady gaming fork target.

## BrandingProfile

```ts
const brandingProfile: BrandingProfile = {
  brandId: "gaming-milady",
  appName: "Gaming Milady",
  orgName: "Gaming Milady",
  packageScope: "@gaming-milady",
  docsUrl: "https://docs.gamingmilady.example",
  appUrl: "https://app.gamingmilady.example",
  cloudUrl: "https://cloud.gamingmilady.example",
  bugReportUrl: "https://github.com/gaming-milady/product/issues",
  hashtags: ["#GamingMilady", "#AgentGamers", "#ElizaWhiteLabel"],
  assetPack: {
    iconSet: "gaming-milady-core",
    avatarSet: "gaming-milady-companions",
    splashTheme: "neon-ocean",
    overlayTheme: "arena-stream",
  },
  headers: {
    authHeader: "x-gaming-milady-token",
    clientIdHeader: "x-gaming-milady-client-id",
    cloudTokenHeader: "x-gaming-milady-cloud-token",
    aliases: {
      "x-gaming-milady-token": "x-eliza-token",
      "x-gaming-milady-client-id": "x-eliza-client-id",
      "x-gaming-milady-cloud-token": "x-eliza-cloud-token",
    },
  },
  whiteLabel: {
    allowEnvAliasSync: true,
    allowThemeOverrides: true,
    allowAssetOverrides: true,
    allowPackageRename: true,
  },
};
```

## Primary GameAppManifest Set

```ts
const primaryGameApps: GameAppManifest[] = [
  {
    appId: "babylon",
    packageName: "@elizaos/app-babylon",
    displayName: "Babylon",
    category: "game",
    launchType: "url",
    launchUrl: "http://localhost:3000",
    runtimePlugin: "@elizaos/app-babylon",
    capabilities: ["game", "prediction-market", "social", "wallet-aware"],
    viewer: {
      url: "/api/apps/babylon/viewer",
      sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
    },
    session: {
      mode: "spectate-and-steer",
      features: ["commands", "telemetry", "suggestions"],
    },
    walletTouchpoints: ["prediction-entry", "settlement-claim", "reward-distribution"],
    telemetryStreams: ["market-state", "position-state", "event-feed"],
    operatorSurfaceId: "babylon-operator-dashboard",
  },
  {
    appId: "clawville",
    packageName: "@clawville/app-clawville",
    displayName: "ClawVille",
    category: "game",
    launchType: "connect",
    launchUrl: "https://clawville.world/game",
    runtimePlugin: "@clawville/app-clawville",
    capabilities: ["game", "skill-learning", "multi-agent", "solana-wallet"],
    viewer: {
      url: "/api/apps/clawville/viewer",
      sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
    },
    session: {
      mode: "spectate-and-steer",
      features: ["commands", "telemetry", "suggestions"],
    },
    walletTouchpoints: ["identity-init", "inventory-asset-action", "token-interaction"],
    telemetryStreams: ["world-state", "skill-state", "identity-state"],
    operatorSurfaceId: "clawville-operator-dashboard",
  },
  {
    appId: "defense-of-the-agents",
    packageName: "@elizaos/app-defense-of-the-agents",
    displayName: "Defense of the Agents",
    category: "game",
    launchType: "connect",
    launchUrl: "https://www.defenseoftheagents.com/",
    runtimePlugin: "@elizaos/app-defense-of-the-agents",
    capabilities: ["strategy", "telemetry", "lane-control"],
    viewer: {
      url: "/api/apps/defense-of-the-agents/viewer",
      sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
    },
    session: {
      mode: "spectate-and-steer",
      features: ["commands", "telemetry", "suggestions"],
    },
    walletTouchpoints: [],
    telemetryStreams: ["lane-state", "command-state", "match-state"],
    operatorSurfaceId: "defense-agent-control",
  },
  {
    appId: "scape",
    packageName: "@elizaos/app-scape",
    displayName: "'scape",
    category: "game",
    launchType: "connect",
    launchUrl: "https://scape-client-2sqyc.kinsta.page",
    runtimePlugin: "@elizaos/app-scape",
    capabilities: ["autonomous", "game", "journal", "operator-steering"],
    viewer: {
      url: "/api/apps/scape/viewer",
      sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
      embedParams: { embedded: "true" },
    },
    session: {
      mode: "spectate-and-steer",
      features: ["commands", "telemetry", "suggestions", "pause", "resume"],
    },
    walletTouchpoints: ["identity-link", "inventory-asset-action"],
    telemetryStreams: ["world-state", "journal-state", "loop-state"],
    operatorSurfaceId: "scape-operator-dashboard",
  },
];
```

## Support Surface Manifests

```ts
const supportSurfaces: GameAppManifest[] = [
  {
    appId: "companion",
    packageName: "@elizaos/app-companion",
    displayName: "Companion",
    category: "support",
    launchType: "url",
    launchUrl: "https://www.elizacloud.ai",
    runtimePlugin: "@elizaos/app-companion",
    capabilities: ["immersive-avatar", "presence", "overlay-control"],
    viewer: null,
    session: {
      mode: "view-only",
      features: ["telemetry", "suggestions"],
    },
    walletTouchpoints: ["wallet-presence", "approval-state-preview"],
    telemetryStreams: ["avatar-state", "interaction-state"],
    operatorSurfaceId: "companion-surface",
  },
  {
    appId: "coding",
    packageName: "@elizaos/app-coding",
    displayName: "Coding",
    category: "support",
    launchType: "url",
    launchUrl: "https://www.elizacloud.ai",
    runtimePlugin: "@elizaos/app-coding",
    capabilities: ["coding-swarm", "pty", "artifact-retention"],
    viewer: null,
    session: {
      mode: "operator-dashboard",
      features: ["telemetry", "suggestions", "commands"],
    },
    walletTouchpoints: [],
    telemetryStreams: ["swarm-state", "task-state", "pty-state"],
    operatorSurfaceId: "coding-swarm-surface",
  },
  {
    appId: "steward",
    packageName: "@elizaos/app-steward",
    displayName: "Steward",
    category: "support",
    launchType: "url",
    launchUrl: "https://www.elizacloud.ai",
    runtimePlugin: "@elizaos/app-steward",
    capabilities: ["wallet-approval", "transaction-review", "identity-state"],
    viewer: null,
    session: {
      mode: "operator-dashboard",
      features: ["telemetry", "commands"],
    },
    walletTouchpoints: ["all-approval-flows"],
    telemetryStreams: ["wallet-state", "approval-state"],
    operatorSurfaceId: "steward-wallet-surface",
  },
  {
    appId: "browser",
    packageName: "@elizaos/app-browser",
    displayName: "Browser",
    category: "support",
    launchType: "url",
    launchUrl: "https://www.elizacloud.ai",
    runtimePlugin: "@elizaos/app-browser",
    capabilities: ["web-workspace", "external-auth", "bridge"],
    viewer: null,
    session: {
      mode: "operator-dashboard",
      features: ["telemetry", "commands"],
    },
    walletTouchpoints: ["web-auth", "external-wallet-linking"],
    telemetryStreams: ["workspace-state", "bridge-state"],
    operatorSurfaceId: "browser-workspace-surface",
  },
];
```

## OperatorSurfaceSpec Set

```ts
const operatorSurfaces: OperatorSurfaceSpec[] = [
  {
    surfaceId: "babylon-operator-dashboard",
    targetAppId: "babylon",
    controls: ["open-market", "place-prediction", "freeze-market", "settle-market"],
    telemetryPanels: ["market-state", "positions", "event-feed"],
    suggestionsMode: "co-pilot",
    supportsPauseResume: false,
    supportsCommandQueue: true,
    supportsNativeWindowOpen: true,
    detailPanelBehavior: "split-pane",
  },
  {
    surfaceId: "clawville-operator-dashboard",
    targetAppId: "clawville",
    controls: ["assign-goal", "suggest-action", "move-agent", "pause-steering"],
    telemetryPanels: ["world-state", "skill-state", "identity-state"],
    suggestionsMode: "co-pilot",
    supportsPauseResume: true,
    supportsCommandQueue: true,
    supportsNativeWindowOpen: true,
    detailPanelBehavior: "split-pane",
  },
  {
    surfaceId: "defense-agent-control",
    targetAppId: "defense-of-the-agents",
    controls: ["set-priority", "issue-tactical-command", "pause", "resume"],
    telemetryPanels: ["lane-state", "team-state", "command-history"],
    suggestionsMode: "co-pilot",
    supportsPauseResume: true,
    supportsCommandQueue: true,
    supportsNativeWindowOpen: true,
    detailPanelBehavior: "split-pane",
  },
  {
    surfaceId: "scape-operator-dashboard",
    targetAppId: "scape",
    controls: ["inject-directive", "pause-loop", "resume-loop", "redirect-objective"],
    telemetryPanels: ["world-state", "journal-state", "loop-state"],
    suggestionsMode: "co-pilot",
    supportsPauseResume: true,
    supportsCommandQueue: true,
    supportsNativeWindowOpen: true,
    detailPanelBehavior: "split-pane",
  },
];
```

## ConnectorBundleSpec

```ts
const connectorBundle: ConnectorBundleSpec = {
  bundleId: "gaming-community-core",
  connectors: [
    {
      name: "discord",
      category: "community-chat",
      authModel: "bot-token + guild configuration",
      eventModel: ["message", "thread", "mention", "reaction"],
      moderationHooks: ["channel-policy", "guild-policy", "operator-mute"],
      targetPersonas: ["agent-gamer", "dev-gamer", "user-gamer"],
    },
    {
      name: "twitch-chat",
      category: "stream-chat",
      authModel: "oauth + channel binding",
      eventModel: ["chat-message", "redeem", "channel-event"],
      moderationHooks: ["stream-mod-policy", "rate-limit", "mute"],
      targetPersonas: ["agent-gamer", "user-gamer"],
    },
    {
      name: "telegram",
      category: "community-chat",
      authModel: "bot-token + chat configuration",
      eventModel: ["direct-message", "group-message", "media-message"],
      moderationHooks: ["chat-policy", "operator-block", "throttle"],
      targetPersonas: ["dev-gamer", "user-gamer"],
    },
  ],
  routingRules: {
    primaryCommunity: ["discord"],
    creatorBroadcast: ["twitch-chat", "youtube-streaming", "x-streaming"],
    supportEscalation: ["telegram", "discord"],
  },
};
```

## StreamingDestinationSpec Set

```ts
const streamingDestinations: StreamingDestinationSpec[] = [
  {
    destinationId: "twitch-streaming",
    platform: "twitch",
    transport: "platform-sdk",
    supportsChatBackfeed: true,
    supportsAgentTTS: true,
    supportsOverlays: true,
    requiredControls: ["go-live", "go-offline", "mute-tts", "swap-overlay"],
    fallbackPolicy: "retry",
  },
  {
    destinationId: "youtube-streaming",
    platform: "youtube",
    transport: "platform-sdk",
    supportsChatBackfeed: true,
    supportsAgentTTS: true,
    supportsOverlays: true,
    requiredControls: ["go-live", "go-offline", "swap-overlay"],
    fallbackPolicy: "retry",
  },
  {
    destinationId: "x-streaming",
    platform: "x",
    transport: "platform-sdk",
    supportsChatBackfeed: false,
    supportsAgentTTS: true,
    supportsOverlays: true,
    requiredControls: ["go-live", "go-offline", "swap-overlay"],
    fallbackPolicy: "failover",
  },
  {
    destinationId: "custom-rtmp",
    platform: "custom-rtmp",
    transport: "rtmp",
    supportsChatBackfeed: false,
    supportsAgentTTS: true,
    supportsOverlays: true,
    requiredControls: ["go-live", "go-offline", "set-endpoint"],
    fallbackPolicy: "manual",
  },
];
```

## WalletProfileSpec Set

```ts
const walletProfiles: WalletProfileSpec[] = [
  {
    profileId: "agent-gamer",
    supportedChains: ["solana", "evm"],
    custodyMode: "hybrid",
    identityMode: "agent-native",
    approvalPolicy: {
      transfers: "policy-gated",
      trades: "policy-gated",
      gameActions: "policy-gated",
    },
    appBindings: ["babylon", "clawville", "scape", "steward", "companion"],
  },
  {
    profileId: "dev-gamer",
    supportedChains: ["solana", "evm"],
    custodyMode: "hybrid",
    identityMode: "team-managed",
    approvalPolicy: {
      transfers: "manual-signature",
      trades: "manual-signature",
      gameActions: "policy-gated",
    },
    appBindings: ["steward", "browser", "coding", "babylon", "clawville"],
  },
  {
    profileId: "user-gamer",
    supportedChains: ["solana", "evm"],
    custodyMode: "non-custodial",
    identityMode: "linked-user",
    approvalPolicy: {
      transfers: "manual-signature",
      trades: "manual-signature",
      gameActions: "policy-gated",
    },
    appBindings: ["babylon", "clawville", "defense-of-the-agents", "scape", "steward", "companion"],
  },
];
```

## SwarmProfile

```ts
const defaultSwarmProfile: SwarmProfile = {
  profileId: "gaming-milady-default-swarm",
  orchestratorStrategy: "ranked",
  agentFamilies: ["claude", "codex", "gemini", "aider"],
  permissionPreset: "standard",
  modelPolicy: {
    fast: "fast-general-model",
    powerful: "powerful-coding-model",
  },
  terminalPersistence: true,
  artifactRetention: "keep",
  summaryFormat: "structured-report",
};
```
