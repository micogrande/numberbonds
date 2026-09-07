import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      // eslint-plugin-react is what makes `no-unused-vars` understand JSX. Without
      // it, `import { motion }` used only as <motion.div> is reported as unused —
      // a false positive that trained everyone here to ignore lint.
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    settings: {
      react: { version: 'detect' },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      // Props are plain destructured JS here and there is no propTypes anywhere in
      // the tree. Turned off deliberately rather than left to fail on every file.
      'react/prop-types': 'off',

      // A stale dependency array is how the critical score/timer bugs in this app
      // were born. This is an error, not a warning.
      'react-hooks/exhaustive-deps': 'error',

      // House rule, enforced structurally instead of by discipline: the native
      // keyboard is never used, so no <input> exists anywhere in the tree.
      // See PLAN 2.4 — input goes through the custom keypad or choice buttons.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name="input"]',
          message:
            'No <input> elements. The native keyboard is never used — take input through the custom keypad (input/KeypadInput.jsx) or choice buttons.',
        },
      ],
    },
  },
  {
    // Tests run in node (PLAN 6), not the browser.
    files: ['**/*.test.{js,jsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // The layout regression suite (`npm run test:layout`). It runs in node and
    // drives a real browser, so it needs both sets of globals: node for the
    // driver, browser for the function that is serialised into the page and
    // evaluated there. It ships no code to the app.
    files: ['tests/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
])
