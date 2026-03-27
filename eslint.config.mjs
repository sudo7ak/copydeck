import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['eslint.config.*'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        chrome: 'readonly',
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-const-assign': 'error',
      eqeqeq: 'warn',
    },
  },
  {
    files: ['**/*.spec.js', 'scripts/**/*.js', 'playwright.config.js', 'eslint.config.*'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
  },
  prettier,
];
