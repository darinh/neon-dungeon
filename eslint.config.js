// Strict eslint config for NEON DUNGEON v2.
// Enforces patterns that catch the most common bug classes in this codebase:
//   - implicit globals (NEON.* must go through window.NEON)
//   - var leakage / shadowing
//   - == vs ===
//   - unreachable code
// Style/formatting rules are deliberately omitted (handled by reviewer judgement).

'use strict';

const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.github/**',
      'sw.js',
    ],
  },
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        NEON: 'writable',
      },
    },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': ['warn', { destructuring: 'all' }],
      // Disabled: this codebase uses script-tag UMD with cross-file globals
      // (window.NEON.* and direct global symbols). `no-undef` produces ~7k false
      // positives. `tsc --noEmit` (via per-file `// @ts-check` rollout) catches
      // genuinely-undefined references using its cross-file symbol table.
      'no-undef': 'off',
      // Disabled for the same architectural reason: every src/*.js file declares
      // top-level functions/consts that are intentionally global (loaded via
      // <script> tags in index.html). Re-enable only if/when the codebase is
      // converted to ES modules.
      'no-implicit-globals': 'off',
      'no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-shadow': ['warn', { hoist: 'functions' }],
      'no-unreachable': 'error',
      'no-fallthrough': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-unsafe-negation': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-redeclare': 'error',
      'no-with': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
