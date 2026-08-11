import { defineModule, type ModuleAction, type ModuleDefinition } from '@ankhorage/orchestrator';

import { type ExpoGoogleFontsModuleConfig, parseExpoGoogleFontsModuleConfig } from './config';
import { buildGoogleFontsWriteFiles } from './templateFiles';

export const EXPO_GOOGLE_FONTS_MODULE_ID = 'expo-google-fonts';

export const expoGoogleFontsModule: ModuleDefinition<ExpoGoogleFontsModuleConfig> =
  defineModule<ExpoGoogleFontsModuleConfig>({
    id: EXPO_GOOGLE_FONTS_MODULE_ID,
    plan(context): ModuleAction[] {
      const config = parseExpoGoogleFontsModuleConfig(context.config);

      return [
        {
          type: 'ensure-packages',
          add: [
            { name: 'expo-font', version: '~13.0.3' },
            ...config.installedFonts.map((font) => ({
              name: `@expo-google-fonts/${font.id}`,
            })),
          ],
        },
        {
          type: 'write-files',
          files: buildGoogleFontsWriteFiles(config),
        },
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
    },
  });
