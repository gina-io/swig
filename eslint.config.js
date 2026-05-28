var globals = require('globals');

module.exports = [
  {
    // ESLint 9 flat config defaults reportUnusedDisableDirectives to "warn";
    // ESLint 8 eslintrc defaulted it to off. Preserve the prior behavior.
    linterOptions: {
      reportUnusedDisableDirectives: 'off'
    },
    languageOptions: {
      ecmaVersion: 2017,
      sourceType: 'commonjs',
      globals: Object.assign(
        {},
        globals.node,
        globals.mocha,
        { Promise: 'readonly' }
      )
    },
    rules: {
      'max-len': ['error', { code: 600 }],
      'semi': ['error', 'always'],
      'no-eval': 'off',
      'no-new-func': 'off',
      'strict': 'off',
      'eqeqeq': 'off',
      'no-trailing-spaces': 'error',
      'no-undef': 'error',
      'no-redeclare': 'error'
    }
  }
];
