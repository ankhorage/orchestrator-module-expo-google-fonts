import { parseExpoGoogleFontsModuleConfig } from './config';
import { EXPO_GOOGLE_FONTS_MODULE_ID, expoGoogleFontsModule } from './module';

/**
 * Optional package-owned data consumed by generic authoring hosts.
 * The core module remains independently usable from the package root.
 */
export const expoGoogleFontsHostContribution = {
  id: EXPO_GOOGLE_FONTS_MODULE_ID,
  name: 'Google Fonts (Expo)',
  description: 'Deterministic Google Fonts integration via @expo-google-fonts packages.',
  definition: expoGoogleFontsModule,
  normalizeConfig: parseExpoGoogleFontsModuleConfig,
  layout: {
    imports: ['import { GoogleFontsProvider } from "@/modules/google-fonts";'],
    hooks: [],
    providerStart: ['<GoogleFontsProvider>'],
    providerEnd: ['</GoogleFontsProvider>'],
  },
} as const;
