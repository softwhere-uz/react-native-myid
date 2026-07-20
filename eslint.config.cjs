const { defineConfig } = require('eslint/config');
const universe = require('eslint-config-universe/flat/native');
const universeWeb = require('eslint-config-universe/flat/web');
const globals = require('globals');

module.exports = defineConfig([
  { ignores: ['build', 'plugin/build'] },
  ...universe,
  ...universeWeb,
  {
    files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
  },
]);
