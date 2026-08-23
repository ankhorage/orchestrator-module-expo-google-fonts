import { createKnipConfig } from '@ankhorage/devtools/knip';

export default createKnipConfig({
  ignoreFiles: ['eslint.config.mjs', 'eslint.local.config.mjs', '.prettierrc.js'],
});
