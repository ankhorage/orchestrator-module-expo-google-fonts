import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { expoGoogleFontsHostContribution } from '../src/host';
import { EXPO_GOOGLE_FONTS_MODULE_ID, expoGoogleFontsModule } from '../src/index';

const CARET_SEMVER_RANGE = /^\^\d+\.\d+\.\d+$/u;

describe('expo google fonts host contribution', () => {
  test('provides package-owned generic host metadata without a fake admin form', () => {
    expect(expoGoogleFontsHostContribution.id).toBe(EXPO_GOOGLE_FONTS_MODULE_ID);
    expect(expoGoogleFontsHostContribution.definition).toBe(expoGoogleFontsModule);
    expect(expoGoogleFontsHostContribution.layout).toEqual({
      imports: ['import { GoogleFontsProvider } from "@/modules/google-fonts";'],
      hooks: [],
      providerStart: ['<GoogleFontsProvider>'],
      providerEnd: ['</GoogleFontsProvider>'],
    });
    expect('admin' in expoGoogleFontsHostContribution).toBe(false);
  });

  test('keeps the root module standalone and exposes host data only through its subpath', async () => {
    const packageJson = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
    };

    expect(Object.keys(packageJson.exports ?? {})).toEqual(['.', './host']);
    expect(packageJson.dependencies?.['@ankhorage/orchestrator']).toMatch(CARET_SEMVER_RANGE);
    expect(packageJson.dependencies?.['@ankhorage/studio']).toBeUndefined();
    expect(packageJson.dependencies?.['@ankhorage/zora']).toBeUndefined();
    expect(packageJson.dependencies?.react).toBeUndefined();
  });
});
