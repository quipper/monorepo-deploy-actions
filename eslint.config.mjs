// @ts-check

import eslint from '@eslint/js';
import jest from 'eslint-plugin-jest';
import tseslint from 'typescript-eslint';
import typescriptEslintParser from "@typescript-eslint/parser";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['tests/**'],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
    },
  },
  {
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        project: true,
      },
    },
  },
);
