import { reactConfig } from '@worldbinder/eslint-config/react'
import globals from 'globals'

export default [
  { ignores: ['dist', 'playwright-report', 'test-results'] },
  ...reactConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
]
