import { baseConfig } from '@worldbinder/eslint-config';
import globals from 'globals';

export default [
  { ignores: ['dist'] },
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
];
