import { describe, expect, test } from 'bun:test';

import { parseExpoGoogleFontsModuleConfig } from '../src/config';

describe('parseExpoGoogleFontsModuleConfig', () => {
  test('returns defaults for empty input', () => {
    const result = parseExpoGoogleFontsModuleConfig(undefined);

    expect(result.installedFonts).toEqual([]);
    expect(result.activeFontId).toBeNull();
  });

  test('parses installed fonts and active font id', () => {
    const result = parseExpoGoogleFontsModuleConfig({
      installedFonts: [
        {
          id: 'inter',
          family: 'Inter',
          weights: [400, 700],
          styles: ['normal', 'italic'],
        },
      ],
      activeFontId: 'inter',
    });

    expect(result).toEqual({
      installedFonts: [
        {
          id: 'inter',
          family: 'Inter',
          weights: [400, 700],
          styles: ['normal', 'italic'],
        },
      ],
      activeFontId: 'inter',
    });
  });

  test('deduplicates font ids and normalizes weights and styles', () => {
    const result = parseExpoGoogleFontsModuleConfig({
      installedFonts: [
        {
          id: 'inter',
          family: 'Inter',
          weights: [700, 400, 700],
          styles: ['italic', 'normal', 'italic'],
        },
        {
          id: 'inter',
          family: 'Inter Duplicate',
        },
      ],
      activeFontId: 'inter',
    });

    expect(result.installedFonts).toEqual([
      {
        id: 'inter',
        family: 'Inter',
        weights: [400, 700],
        styles: ['italic', 'normal'],
      },
    ]);
    expect(result.activeFontId).toBe('inter');
  });

  test('falls back to defaults for invalid font entries', () => {
    const result = parseExpoGoogleFontsModuleConfig({
      installedFonts: [
        {
          id: '',
          family: 'Missing Id',
        },
        {
          id: 'roboto',
        },
        'not-an-object',
      ],
      activeFontId: 'roboto',
    });

    expect(result.installedFonts).toEqual([]);
    expect(result.activeFontId).toBeNull();
  });

  test('drops unknown active font ids', () => {
    const result = parseExpoGoogleFontsModuleConfig({
      installedFonts: [
        {
          id: 'inter',
          family: 'Inter',
        },
      ],
      activeFontId: 'roboto',
    });

    expect(result.activeFontId).toBeNull();
  });
});
