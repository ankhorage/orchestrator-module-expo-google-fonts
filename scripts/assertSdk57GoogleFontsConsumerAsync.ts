import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function assertSdk57GoogleFontsConsumerAsync({
  candidate,
  consumerRoot,
  expectedPackages,
  font,
}: AssertionOptions): Promise<void> {
  const candidatePackage = await readJsonAsync(
    path.join(consumerRoot, 'node_modules', candidate.name, 'package.json'),
  );
  assertCandidatePackage(candidatePackage, candidate, expectedPackages);
  const consumerPackage = await readJsonAsync(path.join(consumerRoot, 'package.json'));
  assertGeneratedRequirement(consumerPackage, font);
  await assertConsumerProtocolsAsync(consumerRoot, consumerPackage, candidate);
  await assertReleasedGraphAsync(consumerRoot, expectedPackages);
  await assertGeneratedFontSourcesAsync(consumerRoot, consumerPackage);
}

interface AssertionOptions {
  readonly candidate: PackedCandidate;
  readonly consumerRoot: string;
  readonly expectedPackages: ExpectedPackageGraph;
  readonly font: PackageIdentity;
}

interface ExpectedPackageGraph {
  readonly runtime: PackageIdentity;
  readonly runtimeRequirement: string;
  readonly surface: PackageIdentity;
}

interface PackedCandidate extends PackageIdentity {
  readonly filename: string;
  readonly path: string;
}

interface PackageIdentity {
  readonly name: string;
  readonly version: string;
}

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly name?: string;
  readonly version?: string;
}

function assertCandidatePackage(
  candidatePackage: PackageManifest,
  candidate: PackedCandidate,
  expectedPackages: ExpectedPackageGraph,
): void {
  if (candidatePackage.name !== candidate.name || candidatePackage.version !== candidate.version) {
    throw new Error('Installed candidate identity does not match the packed artifact.');
  }
  if (
    Reflect.get(candidatePackage.dependencies ?? {}, expectedPackages.runtime.name) !==
    expectedPackages.runtimeRequirement
  ) {
    throw new Error('Packed candidate does not own its released Expo Runtime requirement.');
  }
}

async function assertConsumerProtocolsAsync(
  consumerRoot: string,
  consumerPackage: PackageManifest,
  candidate: PackedCandidate,
): Promise<void> {
  const fileDependencies = Object.entries(consumerPackage.dependencies ?? {}).filter(
    ([, version]) => version.startsWith('file:'),
  );
  if (fileDependencies.length !== 1 || fileDependencies[0]?.[0] !== candidate.name) {
    throw new Error('Only the packed Google Fonts candidate may use the file protocol.');
  }
  const lockfile = await readFile(path.join(consumerRoot, 'bun.lock'), 'utf8');
  if (!lockfile.includes(candidate.filename)) {
    throw new Error('Consumer lockfile does not resolve the actual packed candidate tarball.');
  }
  if (/\b(?:link|workspace):/u.test(lockfile)) {
    throw new Error('Packed consumer retained an unpublished source dependency protocol.');
  }
}

async function assertGeneratedFontSourcesAsync(
  consumerRoot: string,
  consumerPackage: PackageManifest,
): Promise<void> {
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
  if (!provider.includes('FontProvider as SurfaceFontProvider')) {
    throw new Error('Generated provider does not integrate released Surface font state.');
  }
  const activeFiles = `${JSON.stringify(consumerPackage)}\n${generated}\n${provider}`;
  if (activeFiles.includes('~13.0.3')) {
    throw new Error('Packed consumer retained historical SDK 54 package truth.');
  }
}

function assertGeneratedRequirement(consumerPackage: PackageManifest, font: PackageIdentity): void {
  if (Reflect.get(consumerPackage.dependencies ?? {}, font.name) !== font.version) {
    throw new Error('Generated expo-font requirement does not match EXPO_PLATFORM.');
  }
}

async function assertInstalledPackageAsync(
  consumerRoot: string,
  expectedPackage: PackageIdentity,
  requiredRange: string,
): Promise<void> {
  const installedPackage = await readJsonAsync(
    path.join(consumerRoot, 'node_modules', expectedPackage.name, 'package.json'),
  );
  if (
    installedPackage.name !== expectedPackage.name ||
    typeof installedPackage.version !== 'string' ||
    !Bun.semver.satisfies(installedPackage.version, requiredRange)
  ) {
    throw new Error(
      `Packed consumer did not resolve ${expectedPackage.name} within ${requiredRange}.`,
    );
  }
}

async function assertReleasedGraphAsync(
  consumerRoot: string,
  expectedPackages: ExpectedPackageGraph,
): Promise<void> {
  const requirements: readonly (readonly [PackageIdentity, string])[] = [
    [expectedPackages.runtime, expectedPackages.runtimeRequirement],
    [expectedPackages.surface, expectedPackages.surface.version],
  ];
  await Promise.all(
    requirements.map(async ([expectedPackage, requiredRange]) =>
      assertInstalledPackageAsync(consumerRoot, expectedPackage, requiredRange),
    ),
  );
  const graph = await listInstalledGraphAsync(consumerRoot);
  if (/@ankhorage\/(?:zora|surface)@2(?:\.|\s|$)/u.test(graph)) {
    throw new Error('Packed consumer retained a ZORA 2 or Surface 2 dependency.');
  }
  console.log(`Packed Google Fonts graph:\n${graph}`);
}

async function listInstalledGraphAsync(consumerRoot: string): Promise<string> {
  const process = Bun.spawn(['bun', 'pm', 'ls', '--all'], {
    cwd: consumerRoot,
    env: { ...Bun.env, CI: '1' },
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const output = await new Response(process.stdout).text();
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    throw new Error(`bun pm ls --all failed with exit code ${exitCode}.`);
  }
  return output.trim();
}

async function readJsonAsync(filePath: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(filePath, 'utf8')) as PackageManifest;
}
