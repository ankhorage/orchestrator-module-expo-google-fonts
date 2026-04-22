export interface ExpoGoogleFontConfigItem {
  id: string;
  family: string;
  weights?: number[];
  styles?: string[];
}

export interface ExpoGoogleFontsModuleConfig {
  installedFonts?: ExpoGoogleFontConfigItem[];
  activeFontId?: string | null;
}

export interface NormalizedExpoGoogleFontConfigItem {
  id: string;
  family: string;
  weights: number[];
  styles: string[];
}

export interface NormalizedExpoGoogleFontsModuleConfig {
  installedFonts: NormalizedExpoGoogleFontConfigItem[];
  activeFontId: string | null;
}

const DEFAULT_FONT_WEIGHTS = [400] as const;
const DEFAULT_FONT_STYLES = ['normal'] as const;

export function parseExpoGoogleFontsModuleConfig(
  input: unknown,
): NormalizedExpoGoogleFontsModuleConfig {
  if (!isRecord(input)) {
    return {
      installedFonts: [],
      activeFontId: null,
    };
  }

  const installedFonts = Array.isArray(input.installedFonts)
    ? normalizeInstalledFonts(input.installedFonts)
    : [];

  const activeFontId =
    typeof input.activeFontId === 'string' && input.activeFontId.trim().length > 0
      ? input.activeFontId.trim()
      : null;

  return {
    installedFonts,
    activeFontId:
      activeFontId !== null && installedFonts.some((font) => font.id === activeFontId)
        ? activeFontId
        : null,
  };
}

function normalizeInstalledFonts(fonts: unknown[]): NormalizedExpoGoogleFontConfigItem[] {
  const normalizedFonts: NormalizedExpoGoogleFontConfigItem[] = [];
  const seenIds = new Set<string>();

  for (const font of fonts) {
    if (!isRecord(font)) {
      continue;
    }

    const id = typeof font.id === 'string' ? font.id.trim() : '';
    const family = typeof font.family === 'string' ? font.family.trim() : '';

    if (id.length === 0 || family.length === 0 || seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);
    normalizedFonts.push({
      id,
      family,
      weights: normalizeWeights(font.weights),
      styles: normalizeStyles(font.styles),
    });
  }

  return normalizedFonts;
}

function normalizeWeights(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_FONT_WEIGHTS];
  }

  const weights = Array.from(
    new Set(
      value
        .filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
        .map((item) => Math.trunc(item)),
    ),
  ).sort((left, right) => left - right);

  return weights.length > 0 ? weights : [...DEFAULT_FONT_WEIGHTS];
}

function normalizeStyles(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_FONT_STYLES];
  }

  const styles = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  return styles.length > 0 ? styles : [...DEFAULT_FONT_STYLES];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
