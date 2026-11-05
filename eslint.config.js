import { defineConfig, globalIgnores } from 'eslint/config';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.cache/**',
    '**/dist/**',
    '**/public/**',
    '**/.github/**',
    '**/android/**',
    '**/Logo/**',
    '**/resources/**',
    '**/scripts/**',
  ]),

  {
    files: ['**/*.vue', '**/*.js'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: 'espree',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly',
      },
    },
    plugins: {
      vue,
    },
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-alert': 'error',
      'no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          caughtErrors: 'none', // <- HIER
        },
      ],
    },
  },
]);
