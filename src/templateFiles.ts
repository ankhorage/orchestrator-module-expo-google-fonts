import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { WriteFileInstruction } from '@ankhorage/orchestrator';

import type { NormalizedExpoGoogleFontsModuleConfig } from './config';

const TEMPLATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../templates');
const templateCache = new Map<string, string>();
const weightMap: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

export function buildGoogleFontsWriteFiles(
  config: NormalizedExpoGoogleFontsModuleConfig,
): WriteFileInstruction[] {
  return [
    {
      path: 'src/modules/google-fonts/fonts.generated.ts',
      content: renderTemplate('fonts.generated.ts.tpl', {
        FONT_IMPORTS: buildFontImports(config),
        FONT_ASSET_LINES: buildFontAssetLines(config),
      }),
      overwrite: true,
    },
    {
      path: 'src/modules/google-fonts/FontProvider.tsx',
      content: readTemplate('FontProvider.tsx.tpl'),
      overwrite: true,
    },
    {
      path: 'src/modules/google-fonts/index.ts',
      content: readTemplate('index.ts.tpl'),
      overwrite: true,
    },
  ];
}

function buildFontImports(config: NormalizedExpoGoogleFontsModuleConfig): string {
  return config.installedFonts
    .map((font) => {
      const importName = toPascalCase(font.family);
      return `import * as ${importName} from ${JSON.stringify(`@expo-google-fonts/${font.id}`)};`;
    })
    .join('\n');
}

function buildFontAssetLines(config: NormalizedExpoGoogleFontsModuleConfig): string {
  return config.installedFonts
    .flatMap((font) => {
      const importName = toPascalCase(font.family);

      return font.weights.flatMap((weight) =>
        font.styles.map((style) => {
          const styleSuffix = style === 'italic' ? '_Italic' : '';
          const exportName = `${importName}_${weight}${weightMap[weight] ?? 'Regular'}${styleSuffix}`;
          const assetKey = `${importName}_${weight}_${style === 'italic' ? 'Italic' : 'Regular'}`;

          return `  ${JSON.stringify(assetKey)}: ((${importName} as unknown) as Record<string, unknown>)[${JSON.stringify(exportName)}],`;
        }),
      );
    })
    .join('\n');
}

function toPascalCase(value: string): string {
  return value
    .split(/[- ]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function renderTemplate(templateName: string, replacements: Record<string, string>): string {
  let content = readTemplate(templateName);

  for (const [token, value] of Object.entries(replacements)) {
    content = content.replaceAll(`__${token}__`, value);
  }

  return content;
}

function readTemplate(templateName: string): string {
  const cached = templateCache.get(templateName);
  if (cached) {
    return cached;
  }

  const templatePath = path.join(TEMPLATE_DIR, templateName);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing Google Fonts template: ${templateName}`);
  }

  const content = fs.readFileSync(templatePath, 'utf8');
  templateCache.set(templateName, content);
  return content;
}
