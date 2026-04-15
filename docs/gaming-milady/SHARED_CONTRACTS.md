# Shared Contracts

This document defines the reusable contracts that every `prompts/gaming-milady/*.claude.md` file and every `docs/gaming-milady/pairs/*.plan.md` file must reference.

## Product Scope

**Primary shipped game apps**
- `@elizaos/app-babylon`
- `@clawville/app-clawville`
- `@elizaos/app-defense-of-the-agents`
- `@elizaos/app-scape`

**Support surfaces**
- `@elizaos/app-companion`
- `@elizaos/app-coding`
- `@elizaos/app-steward`
- `@elizaos/app-browser`

**Secondary integration/plugin targets**
- Roblox
- Minecraft

**Explicit exclusions**
- `@elizaos/app-form`
- `@elizaos/app-lifeops`
- `@elizaos/app-shopify`
- `@elizaos/app-vincent`

**Legacy/reference only**
- `@elizaos/app-2004scape`
- `@elizaos/app-hyperscape`
- `@elizaos/app-dungeons`
- `@elizaos/app-hyperfy`

## BrandingProfile

```ts
type BrandingProfile = {
  brandId: string;
  appName: string;
  orgName: string;
  packageScope: string;
  docsUrl: string;
  appUrl: string;
  cloudUrl: string;
  bugReportUrl: string;
  hashtags: string[];
  assetPack: {
    iconSet: string;
    avatarSet: string;
    splashTheme: string;
    overlayTheme: string;
  };
  headers: {
    authHeader: string;
    clientIdHeader: string;
    cloudTokenHeader: string;
    aliases: Record<string, string>;
  };
  whiteLabel: {
    allowEnvAliasSync: boolean;
    allowThemeOverrides: boolean;
    allowAssetOverrides: boolean;
    allowPackageRename: boolean;
  };
};
```

## GameAppManifest

```ts
type GameAppManifest = {
  appId: string;
  packageName: string;
  displayName: string;
  category: "game" | "support";
  launchType: "connect" | "url" | "native-window";
  launchUrl: string | null;
  runtimePlugin: string | null;
  capabilities: string[];
  viewer: {
    url: string;
    sandbox: string;
    postMessageAuth?: boolean;
    embedParams?: Record<string, string>;
  } | null;
  session: {
    mode: "spectate-and-steer" | "operator-dashboard" | "view-only";
    features: string[];
  } | null;
  walletTouchpoints: string[];
  telemetryStreams: string[];
  operatorSurfaceId: string | null;
};
```

## OperatorSurfaceSpec

```ts
type OperatorSurfaceSpec = {
  surfaceId: string;
  targetAppId: string;
  controls: string[];
  telemetryPanels: string[];
  suggestionsMode: "none" | "assist" | "co-pilot";
  supportsPauseResume: boolean;
  supportsCommandQueue: boolean;
  supportsNativeWindowOpen: boolean;
  detailPanelBehavior: "inline" | "drawer" | "split-pane";
};
```

## ConnectorBundleSpec

```ts
type ConnectorBundleSpec = {
  bundleId: string;
  connectors: Array<{
    name: string;
    category: "community-chat" | "stream-chat" | "social-broadcast";
    authModel: string;
    eventModel: string[];
    moderationHooks: string[];
    targetPersonas: Array<"agent-gamer" | "dev-gamer" | "user-gamer">;
  }>;
  routingRules: {
    primaryCommunity: string[];
    creatorBroadcast: string[];
    supportEscalation: string[];
  };
};
```

## StreamingDestinationSpec

```ts
type StreamingDestinationSpec = {
  destinationId: string;
  platform: "twitch" | "youtube" | "x" | "custom-rtmp";
  transport: "platform-sdk" | "rtmp";
  supportsChatBackfeed: boolean;
  supportsAgentTTS: boolean;
  supportsOverlays: boolean;
  requiredControls: string[];
  fallbackPolicy: "retry" | "failover" | "manual";
};
```

## WalletProfileSpec

```ts
type WalletProfileSpec = {
  profileId: "agent-gamer" | "dev-gamer" | "user-gamer";
  supportedChains: Array<"solana" | "evm">;
  custodyMode: "custodial" | "non-custodial" | "hybrid";
  identityMode: "agent-native" | "linked-user" | "team-managed";
  approvalPolicy: {
    transfers: "manual-signature" | "policy-gated";
    trades: "manual-signature" | "policy-gated";
    gameActions: "auto" | "policy-gated";
  };
  appBindings: string[];
};
```

## SwarmProfile

```ts
type SwarmProfile = {
  profileId: string;
  orchestratorStrategy: "fixed" | "ranked";
  agentFamilies: string[];
  permissionPreset: "readonly" | "standard" | "permissive" | "autonomous";
  modelPolicy: {
    fast: string;
    powerful: string;
  };
  terminalPersistence: boolean;
  artifactRetention: "delete" | "keep" | "promote";
  summaryFormat: "chat-summary" | "structured-report";
};
```

## Defaults

- **Prompt format**: Claude-first, advanced mode.
- **Community bundle**: Discord, Twitch chat/events, Telegram, YouTube streaming, Twitch streaming, X streaming, custom RTMP.
- **Wallet posture**: dual-chain Solana + EVM.
- **Migration posture**: rebuild Milady concepts cleanly in the current template with selective borrowing.
