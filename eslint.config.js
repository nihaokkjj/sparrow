import js from '@eslint/js'
import globals from 'globals'
import { defineConfig } from 'eslint/config'

import eslintPluginPrettier from 'eslint-plugin-prettier/recommended'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.jest }
    },
    rules: {
      // 关闭 eslint 的如下功能
      'import/prefer-default-export': 0,
      'no-use-before-define': 0,
      'no-shadow': 0,
      'no-restricted-syntax': 0,
      'no-return-assign': 0,
      'no-param-reassign': 0,
      'no-sequences': 0,
      'no-loop-func': 0,
      'no-nested-ternary': 0,
      semi: 0
    }
  },
  eslintPluginPrettier
])
