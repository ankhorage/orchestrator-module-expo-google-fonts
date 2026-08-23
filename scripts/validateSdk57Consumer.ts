import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';

import { assertSdk57GoogleFontsConsumerAsync } from './assertSdk57GoogleFontsConsumerAsync';
import { writeSdk57GoogleFontsConsumerFixtureAsync } from './writeSdk57GoogleFontsConsumerFixtureAsync';

interface CommandOptions {
  readonly capture?: boolean;
  readonly env?: Readonly<Record<string, string>>;
}

interface PackedCandidate {
  readonly filename: string;
  readonly name: string;
  readonly path: string;
  readonly version: string;
}

interface PackageIdentity {
  readonly name: string;
  readonly version: string;
}

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly name?: string;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly version?: string;
}

interface ExpectedPackageGraph {
  readonly runtime: PackageIdentity;
  readonly runtimeRequirement: string;
  readonly surface: PackageIdentity;
}

interface PlatformProjection {
  readonly runtime: Readonly<Record<string, { readonly name: string; readonly version: string }>>;
  readonly expoRouter: { readonly name: string; readonly version: string };
  readonly metroRuntime: { readonly name: string; readonly version: string };
  readonly requiredPeers: readonly { readonly name: string; readonly version: string }[];
  readonly tooling: {
    readonly typescript: { readonly name: string; readonly version: string };
  };
}

const repositoryRoot = path.resolve(import.meta.dir, '..');
const scratchRoot = await mkdtemp(path.join(tmpdir(), 'expo-google-fonts-sdk57-'));
const candidatePackageName = '@ankhorage/orchestrator-module-expo-google-fonts';
const releasedSurfaceSpecifier = '@ankhorage/surface@3.0.0';

try {
  const candidateDirectory = path.join(scratchRoot, 'candidate');
  const consumerRoot = path.join(scratchRoot, 'consumer');
  await mkdir(candidateDirectory, { recursive: true });
  await mkdir(path.join(consumerRoot, 'src/app'), { recursive: true });

  const candidate = await packCandidateAsync(candidateDirectory);
  const repositoryPackage = await readJsonAsync<PackageManifest>(
    path.join(repositoryRoot, 'package.json'),
  );
  const runtimePackage = await readJsonAsync<PackageManifest>(
    path.join(repositoryRoot, 'node_modules/@ankhorage/expo-runtime/package.json'),
  );
  const surfacePackage = await readReleasedPackageManifestAsync(releasedSurfaceSpecifier);
  const expectedPackages: ExpectedPackageGraph = {
    runtime: requirePackageIdentity(runtimePackage, '@ankhorage/expo-runtime'),
    runtimeRequirement: requireVersion(repositoryPackage.dependencies, '@ankhorage/expo-runtime'),
    surface: requirePackageIdentity(surfacePackage, '@ankhorage/surface'),
  };
  const surfaceDependencies = {
    ...surfacePackage.peerDependencies,
    [expectedPackages.surface.name]: expectedPackages.surface.version,
  };
  const expectedPlatform = createPlatformProjection();
  await writeSdk57GoogleFontsConsumerFixtureAsync(
    consumerRoot,
    candidate.path,
    expectedPlatform,
    surfaceDependencies,
  );
  await runAsync('bun', ['install'], consumerRoot);
  await assertReleasedPlatformAsync(consumerRoot, expectedPlatform);

  await writeApplyScriptAsync(consumerRoot);
  await runAsync('bun', ['apply-module.ts'], consumerRoot);
  await assertSdk57GoogleFontsConsumerAsync({
    candidate,
    consumerRoot,
    expectedPackages,
    font: EXPO_PLATFORM.packages.font,
  });

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

async function packCandidateAsync(candidateDirectory: string): Promise<PackedCandidate> {
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
  const [candidate] = JSON.parse(output) as Omit<PackedCandidate, 'path'>[];
  if (!candidate) throw new Error('npm pack did not report a candidate artifact.');
  if (candidate.name !== candidatePackageName) {
    throw new Error(`npm pack reported unexpected candidate name: ${candidate.name}.`);
  }
  return { ...candidate, path: path.join(candidateDirectory, candidate.filename) };
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

async function readReleasedPackageManifestAsync(specifier: string): Promise<PackageManifest> {
  const output = await runAsync(
    'npm',
    ['view', specifier, 'name', 'version', 'peerDependencies', '--json'],
    repositoryRoot,
    { capture: true, env: { npm_config_cache: path.join(scratchRoot, 'npm-cache') } },
  );
  return JSON.parse(output) as PackageManifest;
}

function requirePackageIdentity(manifest: PackageManifest, expectedName: string): PackageIdentity {
  if (manifest.name !== expectedName || typeof manifest.version !== 'string') {
    throw new Error(`Expected installed released package ${expectedName}.`);
  }
  return { name: manifest.name, version: manifest.version };
}

function requireVersion(
  versions: Readonly<Record<string, string>> | undefined,
  packageName: string,
): string {
  const version = Reflect.get(versions ?? {}, packageName) as unknown;
  if (typeof version !== 'string') {
    throw new Error(`Missing released requirement for ${packageName}.`);
  }
  return version;
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
