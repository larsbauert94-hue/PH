// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'dist-pages/*', 'dist-artifact/*', 'supabase/*'] },
  { files: ['scripts/**/*.js'], languageOptions: { globals: { __dirname: 'readonly', require: 'readonly' } } },
])
