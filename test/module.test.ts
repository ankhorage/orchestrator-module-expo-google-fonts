import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { WriteFilesAction } from '@ankhorage/orchestrator';
import { describe, expect, test } from 'bun:test';

import { EXPO_GOOGLE_FONTS_MODULE_ID, expoGoogleFontsModule } from '../src/module';

describe('expoGoogleFontsModule', () => {
  test('keeps module-owned templates in the repo', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

    expect(Bun.file(path.join(repoRoot, 'templates/fonts.generated.ts.tpl')).size).toBeGreaterThan(
      0,
    );
    expect(Bun.file(path.join(repoRoot, 'templates/FontProvider.tsx.tpl')).size).toBeGreaterThan(0);
    expect(Bun.file(path.join(repoRoot, 'templates/index.ts.tpl')).size).toBeGreaterThan(0);
  });

  test('uses the expected module id', () => {
    expect(expoGoogleFontsModule.id).toBe(EXPO_GOOGLE_FONTS_MODULE_ID);
  });

  test('returns only supported orchestrator actions', async () => {
    const actions = await Promise.resolve(
      expoGoogleFontsModule.plan({
        projectRoot: '/virtual/project',
        moduleId: EXPO_GOOGLE_FONTS_MODULE_ID,
        config: {},
      }),
    );

    expect(actions).toHaveLength(6);
    expect(actions.map((action) => action.type)).toEqual([
      'ensure-packages',
      'write-files',
      'patch-text-block',
      'patch-text-block',
      'json-set',
      'json-set',
    ]);

    expect(actions[0]).toEqual({
      type: 'ensure-packages',
      add: [{ name: 'expo-font', version: '~13.0.3' }],
    });

    const writeFilesAction = actions.find(
      (action): action is WriteFilesAction => action.type === 'write-files',
    );
    if (!writeFilesAction) {
      throw new Error('expected write-files action');
    }

    expect(writeFilesAction.files.map((file) => file.path)).toEqual([
      'src/plugins/google-fonts/fonts.generated.ts',
      'src/plugins/google-fonts/FontProvider.tsx',
      'src/plugins/google-fonts/index.ts',
    ]);
    expect(writeFilesAction.files[0]?.content).toContain('export const fontAssets');
    expect(writeFilesAction.files[1]?.content).toContain('import { loadAsync } from "expo-font";');

    expect(actions[2]).toEqual({
      type: 'patch-text-block',
      path: 'src/app/_layout.tsx',
      blockId: 'expo-google-fonts:root-layout-import',
      content: 'import { GoogleFontsProvider } from "@/plugins/google-fonts";',
      anchor: {
        find: "import ankhConfig from '@root/ankh.config.json';",
        position: 'before',
      },
    });

    expect(actions[3]).toEqual({
      type: 'patch-text-block',
      path: 'src/app/_layout.tsx',
      blockId: 'expo-google-fonts:root-layout-provider',
      content: '  output = <GoogleFontsProvider>{output}</GoogleFontsProvider>;',
      anchor: {
        find: '  return (',
        position: 'before',
      },
    });

    expect(actions[4]).toEqual({
      type: 'json-set',
      path: 'ankh.config.json',
      jsonPath: 'settings.googleFonts',
      value: {
        installedFonts: [],
        activeFontId: null,
      },
    });

    expect(actions[5]).toEqual({
      type: 'json-set',
      path: 'ankh.config.json',
      jsonPath: 'typography.activeFontId',
      value: null,
    });
  });

  test('uses configured fonts when planning packages and generated files', async () => {
    const actions = await Promise.resolve(
      expoGoogleFontsModule.plan({
        projectRoot: '/virtual/project',
        moduleId: EXPO_GOOGLE_FONTS_MODULE_ID,
        config: {
          installedFonts: [
            {
              id: 'inter',
              family: 'Inter',
              weights: [400, 700],
              styles: ['normal', 'italic'],
            },
          ],
          activeFontId: 'inter',
        },
      }),
    );

    expect(actions[0]).toEqual({
      type: 'ensure-packages',
      add: [{ name: 'expo-font', version: '~13.0.3' }, { name: '@expo-google-fonts/inter' }],
    });

    const writeFilesAction = actions.find(
      (action): action is WriteFilesAction => action.type === 'write-files',
    );
    if (!writeFilesAction) {
      throw new Error('expected write-files action');
    }

    expect(writeFilesAction.files[0]?.content).toContain(
      'import * as Inter from "@expo-google-fonts/inter";',
    );
    expect(writeFilesAction.files[0]?.content).toContain(
      '"Inter_400_Regular": ((Inter as unknown) as Record<string, unknown>)["Inter_400Regular"],',
    );
    expect(writeFilesAction.files[0]?.content).toContain(
      '"Inter_700_Italic": ((Inter as unknown) as Record<string, unknown>)["Inter_700Bold_Italic"],',
    );
    expect(actions[4]).toEqual({
      type: 'json-set',
      path: 'ankh.config.json',
      jsonPath: 'settings.googleFonts',
      value: {
        installedFonts: [
          {
            id: 'inter',
            family: 'Inter',
            weights: [400, 700],
            styles: ['normal', 'italic'],
          },
        ],
        activeFontId: 'inter',
      },
    });
    expect(actions[5]).toEqual({
      type: 'json-set',
      path: 'ankh.config.json',
      jsonPath: 'typography.activeFontId',
      value: 'inter',
    });
  });
});
