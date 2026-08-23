import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';

import {
  type PlatformProjection,
  writeSdk57GoogleFontsConsumerFixtureAsync,
} from './writeSdk57GoogleFontsConsumerFixtureAsync';

interface CommandOptions {
  readonly capture?: boolean;
  readonly env?: Readonly<Record<string, string>>;
}

interface PackedCandidate {
  readonly filename: string;
}

const repositoryRoot = path.resolve(import.meta.dir, '..');
const scratchRoot = await mkdtemp(path.join(tmpdir(), 'expo-google-fonts-sdk57-'));

try {
  const candidateDirectory = path.join(scratchRoot, 'candidate');
  const consumerRoot = path.join(scratchRoot, 'consumer');
  await mkdir(candidateDirectory, { recursive: true });
  await mkdir(path.join(consumerRoot, 'src/app'), { recursive: true });

  const candidatePath = await packCandidateAsync(candidateDirectory);
  const expectedPlatform = createPlatformProjection();
  await writeSdk57GoogleFontsConsumerFixtureAsync(consumerRoot, candidatePath, expectedPlatform);
  await runAsync('bun', ['install'], consumerRoot);
  await assertOnlyCandidateUsesFileProtocolAsync(consumerRoot);
  await assertReleasedPlatformAsync(consumerRoot, expectedPlatform);

  await writeApplyScriptAsync(consumerRoot);
  await runAsync('bun', ['apply-module.ts'], consumerRoot);
  await assertGeneratedConsumerAsync(consumerRoot, expectedPlatform);

  await runAsync('bunx', ['expo', 'install', '--check'], consumerRoot);
  await runAsync('bunx', ['expo-doctor'], consumerRoot);
  await runAsync('bunx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], consumerRoot);
  await runAsync('bunx', ['react-compiler-healthcheck@latest'], consumerRoot);
  await exportAndAssertFontAsync(consumerRoot, 'web');
  await exportAndAssertFontAsync(consumerRoot, 'android');
  await exportAndAssertFontAsync(consumerRoot, 'ios');
  await prebuildAndAssertAsync(consumerRoot, 'android');
  await prebuildAndAssertAsync(consumerRoot, 'ios');

  console.log('SDK 57 packed Google Fonts consumer acceptance passed for Web, Android, and iOS.');
} finally {
  await rm(scratchRoot, { recursive: true, force: true });
}

function createPlatformProjection(): PlatformProjection {
  return {
    runtime: EXPO_PLATFORM.runtime,
    expoRouter: EXPO_PLATFORM.navigation.expoRouter,
    metroRuntime: EXPO_PLATFORM.packages.metroRuntime,
    requiredPeers: [
      EXPO_PLATFORM.packages.camera,
      EXPO_PLATFORM.packages.constants,
      EXPO_PLATFORM.packages.documentPicker,
      EXPO_PLATFORM.packages.fileSystem,
      EXPO_PLATFORM.packages.imagePicker,
      EXPO_PLATFORM.packages.linking,
      EXPO_PLATFORM.navigation.safeArea,
    ],
    tooling: { typescript: EXPO_PLATFORM.tooling.typescript },
  };
}

async function packCandidateAsync(candidateDirectory: string): Promise<string> {
  await runAsync('bun', ['run', 'build'], repositoryRoot);
  const output = await runAsync(
    'npm',
    ['pack', '--json', '--pack-destination', candidateDirectory],
    repositoryRoot,
    {
      capture: true,
      env: { npm_config_cache: path.join(scratchRoot, 'npm-cache') },
    },
  );
  const [candidate] = JSON.parse(output) as PackedCandidate[];
  if (!candidate) throw new Error('npm pack did not report a candidate artifact.');
  return path.join(candidateDirectory, candidate.filename);
}

async function assertReleasedPlatformAsync(
  consumerRoot: string,
  expectedPlatform: PlatformProjection,
): Promise<void> {
  const output = await runAsync(
    'bun',
    [
      '-e',
      "import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform'; console.log(JSON.stringify({ runtime: EXPO_PLATFORM.runtime, expoRouter: EXPO_PLATFORM.navigation.expoRouter, metroRuntime: EXPO_PLATFORM.packages.metroRuntime, requiredPeers: [EXPO_PLATFORM.packages.camera, EXPO_PLATFORM.packages.constants, EXPO_PLATFORM.packages.documentPicker, EXPO_PLATFORM.packages.fileSystem, EXPO_PLATFORM.packages.imagePicker, EXPO_PLATFORM.packages.linking, EXPO_PLATFORM.navigation.safeArea], tooling: { typescript: EXPO_PLATFORM.tooling.typescript } }));",
    ],
    consumerRoot,
    { capture: true },
  );
  if (JSON.stringify(JSON.parse(output)) !== JSON.stringify(expectedPlatform)) {
    throw new Error('Consumer resolved a different released platform contract.');
  }
}

async function assertGeneratedConsumerAsync(
  consumerRoot: string,
  platform: PlatformProjection,
): Promise<void> {
  const candidatePackage = await readJsonAsync<{ version?: string }>(
    path.join(
      consumerRoot,
      'node_modules/@ankhorage/orchestrator-module-expo-google-fonts/package.json',
    ),
  );
  if (candidatePackage.version !== '0.2.0') {
    throw new Error(`Unexpected packed candidate version: ${String(candidatePackage.version)}.`);
  }
  const packageJson = await readJsonAsync<{ dependencies?: Record<string, string> }>(
    path.join(consumerRoot, 'package.json'),
  );
  const fontRequirement = EXPO_PLATFORM.packages.font;
  if (packageJson.dependencies?.[fontRequirement.name] !== fontRequirement.version) {
    throw new Error('Generated expo-font requirement does not match EXPO_PLATFORM.');
  }
  const generated = await readFile(
    path.join(consumerRoot, 'src/modules/google-fonts/fonts.generated.ts'),
    'utf8',
  );
  const provider = await readFile(
    path.join(consumerRoot, 'src/modules/google-fonts/FontProvider.tsx'),
    'utf8',
  );
  if (!generated.includes('Record<string, FontSource>')) {
    throw new Error('Generated font assets do not use the Expo FontSource contract.');
  }
  if (!generated.includes('"Inter_400_Regular": Inter_400Regular')) {
    throw new Error('Generated Inter assets are not direct typed package exports.');
  }
  if (generated.includes('as unknown') || generated.includes('import * as Inter')) {
    throw new Error(
      'Generated Inter assets retained broad namespace imports or compatibility casts.',
    );
  }
  if (!provider.includes('await loadAsync(fontAssets)')) {
    throw new Error('Generated provider does not load runtime font assets.');
  }
  const activeFiles = `${JSON.stringify(packageJson)}\n${generated}\n${provider}`;
  if (activeFiles.includes('~13.0.3')) {
    throw new Error('Packed consumer retained historical SDK 54 package truth.');
  }
  void platform;
}

async function assertOnlyCandidateUsesFileProtocolAsync(consumerRoot: string): Promise<void> {
  const packageJson = await readJsonAsync<{ dependencies?: Record<string, string> }>(
    path.join(consumerRoot, 'package.json'),
  );
  const fileDependencies = Object.entries(packageJson.dependencies ?? {}).filter(([, version]) =>
    version.startsWith('file:'),
  );
  if (
    fileDependencies.length !== 1 ||
    fileDependencies[0]?.[0] !== '@ankhorage/orchestrator-module-expo-google-fonts'
  ) {
    throw new Error('Only the packed candidate may use the file protocol.');
  }
}

async function exportAndAssertFontAsync(
  consumerRoot: string,
  platform: 'web' | 'android' | 'ios',
): Promise<void> {
  const outputDirectory = path.join(consumerRoot, `dist-${platform}`);
  await runAsync(
    'bunx',
    [
      'expo',
      'export',
      '--platform',
      platform,
      '--output-dir',
      outputDirectory,
      '--dump-assetmap',
      '--clear',
    ],
    consumerRoot,
  );
  const exportedFiles = await readdir(outputDirectory, { recursive: true });
  const assetMap = await readFile(path.join(outputDirectory, 'assetmap.json'), 'utf8');
  const exportEvidence = `${exportedFiles.join('\n')}\n${assetMap}`;
  if (!exportEvidence.includes('Inter_400Regular')) {
    throw new Error(`${platform} export did not include the configured Inter font asset.`);
  }
}

async function prebuildAndAssertAsync(
  consumerRoot: string,
  platform: 'android' | 'ios',
): Promise<void> {
  await runAsync(
    'bunx',
    ['expo', 'prebuild', '--clean', '--no-install', '--platform', platform],
    consumerRoot,
  );
  const marker = platform === 'android' ? 'android/app/build.gradle' : 'ios/Podfile';
  if (!(await Bun.file(path.join(consumerRoot, marker)).exists())) {
    throw new Error(`${platform} prebuild did not create ${marker}.`);
  }
}

async function readJsonAsync<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function runAsync(
  command: string,
  args: readonly string[],
  cwd: string,
  options: CommandOptions = {},
): Promise<string> {
  const process = Bun.spawn([command, ...args], {
    cwd,
    env: { ...Bun.env, CI: '1', ...options.env },
    stdout: options.capture ? 'pipe' : 'inherit',
    stderr: 'inherit',
  });
  const output = options.capture ? await new Response(process.stdout).text() : '';
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${exitCode}.`);
  }
  return output.trim();
}

async function writeApplyScriptAsync(consumerRoot: string): Promise<void> {
  await writeFile(
    path.join(consumerRoot, 'apply-module.ts'),
    `import { createOrchestrator } from '@ankhorage/orchestrator';
import { expoGoogleFontsModule } from '@ankhorage/orchestrator-module-expo-google-fonts';
import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';

const config = {
  installedFonts: [{
    id: 'inter', family: 'Inter', weights: [400, 700], styles: ['normal', 'italic'],
  }],
  activeFontId: 'inter',
};
const actions = await expoGoogleFontsModule.plan({
  projectRoot: process.cwd(), moduleId: expoGoogleFontsModule.id, config,
});
const packageAction = actions.find((action) => action.type === 'ensure-packages');
if (!packageAction?.add.some((dependency) =>
  dependency.name === EXPO_PLATFORM.packages.font.name &&
  dependency.version === EXPO_PLATFORM.packages.font.version
)) throw new Error('Module plan does not consume the installed public platform contract.');

const orchestrator = createOrchestrator({ modules: [expoGoogleFontsModule], projectRoot: process.cwd() });
await orchestrator.installModule(expoGoogleFontsModule.id, { config });
`,
    'utf8',
  );
}
