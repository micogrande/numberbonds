import { describe, expect, it } from 'vitest'

// Guards the testing decision in PLAN 6: tests run in the node environment and
// jsdom is not installed. If someone adds jsdom without a component test that
// earns it, this fails and asks them why.
describe('test environment', () => {
  it('is node, not a browser', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
  })
})
