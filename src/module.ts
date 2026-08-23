import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';
import { defineModule, type ModuleAction, type ModuleDefinition } from '@ankhorage/orchestrator';

import {
  type ExpoGoogleFontsModuleConfig,
  type NormalizedExpoGoogleFontsModuleConfig,
  parseExpoGoogleFontsModuleConfig,
} from './config';
import { buildGoogleFontsWriteFiles } from './templateFiles';

export const EXPO_GOOGLE_FONTS_MODULE_ID = 'expo-google-fonts';

export const expoGoogleFontsModule: ModuleDefinition<ExpoGoogleFontsModuleConfig> =
  defineModule<ExpoGoogleFontsModuleConfig>({
    id: EXPO_GOOGLE_FONTS_MODULE_ID,
    plan: (context) => buildModuleActions(parseExpoGoogleFontsModuleConfig(context.config)),
  });

function buildModuleActions(config: NormalizedExpoGoogleFontsModuleConfig): ModuleAction[] {
  return [
    {
      type: 'ensure-packages',
      add: [
        EXPO_PLATFORM.packages.font,
        ...config.installedFonts.map((font) => ({
          name: `@expo-google-fonts/${font.id}`,
        })),
      ],
    },
    {
      type: 'write-files',
      files: buildGoogleFontsWriteFiles(config),
    },
    ...buildLayoutActions(),
    {
      type: 'json-set',
      path: 'ankh.config.json',
      jsonPath: 'settings.googleFonts',
      value: {
        installedFonts: config.installedFonts,
        activeFontId: config.activeFontId,
      },
    },
    {
      type: 'json-set',
      path: 'ankh.config.json',
      jsonPath: 'typography.activeFontId',
      value: config.activeFontId,
    },
  ];
}

function buildLayoutActions(): ModuleAction[] {
  return [
    {
      type: 'patch-text-block',
      path: 'src/app/_layout.tsx',
      blockId: `${EXPO_GOOGLE_FONTS_MODULE_ID}:root-layout-import`,
      content: 'import { GoogleFontsProvider } from "@/modules/google-fonts";',
      anchor: {
        find: "import ankhConfig from '@root/ankh.config.json';",
        position: 'before',
      },
    },
    {
      type: 'patch-text-block',
      path: 'src/app/_layout.tsx',
      blockId: `${EXPO_GOOGLE_FONTS_MODULE_ID}:root-layout-provider`,
      content: '  output = <GoogleFontsProvider>{output}</GoogleFontsProvider>;',
      anchor: {
        find: '  return (',
        position: 'before',
      },
    },
  ];
}
