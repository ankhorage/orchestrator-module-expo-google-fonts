# orchestrator-module-expo-google-fonts

Adds Google Fonts support to an Expo project.

The module reads its `expo-font` requirement from the released
`@ankhorage/expo-runtime/platform` contract. Generated providers load typed Google Font assets at
runtime, which keeps the same installation usable on Web, Android, and iOS.

## 🎯 What you get

- Fonts configured in seconds
- No manual setup
- Fully reversible

## Usage

```ts
import { createOrchestrator } from '@ankhorage/orchestrator';
import { expoGoogleFontsModule } from '@ankhorage/orchestrator-module-expo-google-fonts';

const orchestrator = createOrchestrator({
  modules: [expoGoogleFontsModule],
  projectRoot: '/path/to/project',
});

await orchestrator.installModule('expo-google-fonts', { config: {} });
```

The Orchestrator ledger is the canonical lifecycle and configuration source. Updating an existing
installation uses `reconfigureModule()`, which also removes outputs recorded by an earlier module
version before generating the canonical `src/modules/google-fonts` namespace.

Generic authoring hosts can opt into package-owned metadata, layout integration, and config
normalization without making the core module depend on Studio:

```ts
import { expoGoogleFontsHostContribution } from '@ankhorage/orchestrator-module-expo-google-fonts/host';
```

This module intentionally exposes no fake generic configuration form. A richer package-owned font
administration contribution can be added without changing the standalone root module.

## Why this exists

Automates repetitive setup tasks.
