/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'boundaries'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  settings: {
    // eslint-plugin-boundaries resolves each import via eslint-module-utils, which
    // needs a resolver that understands the NodeNext "import from './x.js'" convention
    // pointing at an actual "./x.ts" source file. The plain node resolver can't map
    // that, so boundary violations behind a `.js`-suffixed relative import would
    // silently go undetected without this.
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
    'boundaries/elements': [
      { type: 'domain', pattern: 'src/*/domain/**' },
      { type: 'application', pattern: 'src/*/application/**' },
      { type: 'adapters', pattern: 'src/*/adapters/**' },
      { type: 'infrastructure', pattern: 'src/infrastructure/**' },
      { type: 'infrastructure', pattern: 'src/composition-root/**' },
    ],
    'boundaries/ignore': ['**/*.test.ts'],
  },
  rules: {
    'boundaries/element-types': [
      'error',
      {
        default: 'allow',
        rules: [
          {
            from: 'domain',
            disallow: ['application', 'adapters', 'infrastructure'],
            message: 'domain must not import from ${dependency.type} (Clean Architecture: dependencies point inward only).',
          },
          {
            from: 'application',
            disallow: ['adapters', 'infrastructure'],
            message: 'application must not import from ${dependency.type} (Clean Architecture: dependencies point inward only).',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['src/**/domain/**/*.ts', 'src/**/application/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              'playwright',
              '@playwright/test',
              'commander',
              'acorn',
              'acorn-walk',
              'picocolors',
            ],
            patterns: [
              {
                group: ['node:*'],
                message: 'domain/application must not import Node.js builtins (Clean Architecture: keep runtime/platform concerns in adapters/infrastructure).',
              },
            ],
          },
        ],
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/'],
};
