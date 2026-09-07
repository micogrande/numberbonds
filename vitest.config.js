import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.js on purpose: the build config is deployment
// plumbing and stays untouched (PLAN 9.3).
export default defineConfig({
  test: {
    // PLAN 6: every engine is React-free by contract, so the tests need no DOM.
    // jsdom is deliberately NOT installed. Do not add it until a component test
    // genuinely earns it.
    environment: 'node',
    // Tests are co-located beside the module they test, so deleting a module
    // takes its tests with it (PLAN 2.7).
    include: ['src/**/*.test.{js,jsx}'],
  },
})
