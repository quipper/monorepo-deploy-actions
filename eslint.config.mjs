// @ts-check

import eslint from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import tseslint from 'typescript-eslint'
import typescriptEslintParser from '@typescript-eslint/parser'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  vitest.configs.recommended,
  {
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        project: true,
      },
    },
  },
)
