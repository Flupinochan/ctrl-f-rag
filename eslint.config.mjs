// @ts-check

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import autoImports from './.wxt/eslint-auto-imports.mjs';

export default tseslint.config(
  {
    ignores: ['.wxt/**', '.output/**', 'node_modules/**'],
  },
  autoImports,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: '19.2',
      },
    },
  },
);
