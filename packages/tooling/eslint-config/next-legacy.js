import nextConfig from './next.js';

export default [
  ...nextConfig,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      'import/first': 'warn',
      'import/newline-after-import': 'warn',
      'import/no-duplicates': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
