import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface PlatformProjection {
  readonly runtime: Readonly<Record<string, { readonly name: string; readonly version: string }>>;
  readonly expoRouter: { readonly name: string; readonly version: string };
  readonly metroRuntime: { readonly name: string; readonly version: string };
  readonly requiredPeers: readonly { readonly name: string; readonly version: string }[];
  readonly tooling: {
    readonly typescript: { readonly name: string; readonly version: string };
  };
}

export async function writeSdk57GoogleFontsConsumerFixtureAsync(
  consumerRoot: string,
  candidatePath: string,
  platform: PlatformProjection,
): Promise<void> {
  await Promise.all([
    writeConsumerPackageAsync(consumerRoot, candidatePath, platform),
    writeConsumerConfigAsync(consumerRoot),
    writeConsumerSourceAsync(consumerRoot),
  ]);
}

async function writeConsumerPackageAsync(
  consumerRoot: string,
  candidatePath: string,
  platform: PlatformProjection,
): Promise<void> {
  const platformDependencies = Object.fromEntries(
    [
      ...Object.values(platform.runtime),
      platform.expoRouter,
      platform.metroRuntime,
      ...platform.requiredPeers,
    ].map((dependency) => [dependency.name, dependency.version]),
  );
  const packageJson = {
    name: 'expo-google-fonts-sdk57-acceptance',
    version: '0.0.0',
    private: true,
    type: 'module',
    main: 'expo-router/entry',
    dependencies: {
      ...platformDependencies,
      '@ankhorage/expo-runtime': '2.7.0',
      '@ankhorage/orchestrator': '0.3.1',
      '@ankhorage/orchestrator-module-expo-google-fonts': `file:${candidatePath}`,
      '@ankhorage/runtime': '2.2.0',
      '@ankhorage/surface': '3.0.0',
      '@react-native-vector-icons/fontawesome': '^13.1.3',
      '@react-native-vector-icons/fontawesome5': '^13.1.3',
      '@react-native-vector-icons/fontawesome6': '^13.1.3',
      '@react-native-vector-icons/ionicons': '^13.1.3',
    },
    devDependencies: {
      '@types/react': '^19.2.18',
      [platform.tooling.typescript.name]: platform.tooling.typescript.version,
    },
  };

  await writeFile(
    path.join(consumerRoot, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  );
}

async function writeConsumerConfigAsync(consumerRoot: string): Promise<void> {
  await writeFile(
    path.join(consumerRoot, 'app.config.ts'),
    `export default {
  expo: {
    name: 'Expo Google Fonts Acceptance',
    slug: 'expo-google-fonts-acceptance',
    scheme: 'expo-google-fonts-acceptance',
    experiments: { reactCompiler: true },
    android: { package: 'com.ankhorage.expogooglefontsacceptance' },
    ios: { bundleIdentifier: 'com.ankhorage.expogooglefontsacceptance' },
    plugins: ['expo-router'],
  },
};
`,
    'utf8',
  );
  await writeFile(path.join(consumerRoot, 'ankh.config.json'), '{\n  "settings": {}\n}\n');
  await writeFile(
    path.join(consumerRoot, 'tsconfig.json'),
    `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./src/*"],
      "@root/*": ["./*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "app.config.ts"]
}
`,
    'utf8',
  );
}

async function writeConsumerSourceAsync(consumerRoot: string): Promise<void> {
  await writeFile(
    path.join(consumerRoot, 'src/app/_layout.tsx'),
    `import ankhConfig from '@root/ankh.config.json';
import { Slot } from 'expo-router';

export default function RootLayout() {
  let output = <Slot />;
  void ankhConfig;

  return (
    output
  );
}
`,
    'utf8',
  );
  await writeFile(
    path.join(consumerRoot, 'src/app/index.tsx'),
    `import { Text, View } from 'react-native';

export default function Index() {
  return <View><Text style={{ fontFamily: 'Inter_400_Regular' }}>Fonts acceptance</Text></View>;
}
`,
    'utf8',
  );
}
