/**
 * eslint.config.js — Configuração flat do ESLint (ESLint 9+/10).
 *
 * Regras pragmáticas para este projeto:
 * - no-console off: o projeto loga bastante (bootstrap, cache, erros).
 * - no-empty allowEmptyCatch: há vários catch que ignoram erros de APIs
 *   externas de propósito (cascata de fontes).
 * - no-unused-vars como warn (não blocker): código legado ainda tem sobras.
 *
 * Uso: npm run lint   (ou npx eslint .)
 */
const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['node_modules/**', 'database/**', 'public/**', 'views/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-control-regex': 'off',
      'no-useless-escape': 'off'
    }
  },
  {
    // Suíte de testes usa ESM (import/export) — o resto do projeto é CommonJS.
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  prettier
];
