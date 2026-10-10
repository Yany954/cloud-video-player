import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // apps/web is linted by its own Next.js config (pnpm --filter @cvp/web lint).
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/cdk.out/**',
      'apps/web/**',
      // A snippet run inside a browser page by playwright-cli, not a module.
      'apps/mobile/e2e/make-clip.js',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
