import { createConfig } from '@ankhorage/devtools/eslint';

export default [
  ...createConfig({
    files: ['scripts/**/*.ts'],
    project: ['./tsconfig.scripts.json'],
    tsconfigRootDir: import.meta.dirname,
  }),
  ...createConfig({
    files: ['test/**/*.ts'],
    project: ['./tsconfig.eslint.json'],
    tsconfigRootDir: import.meta.dirname,
  }),
  {
    name: 'expo-google-fonts/legacy-test-function-size',
    files: ['test/config.test.ts', 'test/module.test.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
];
