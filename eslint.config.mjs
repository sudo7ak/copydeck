import prettier from 'eslint-config-prettier';

export default [
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
    files: ['test-*.spec.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
  },
  prettier,
];
