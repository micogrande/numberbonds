import { describe, expect, it } from 'vitest'
import { KEYPAD_KEYS, applyKey } from './keypadRules'

/**
 * The two rules the keypad was missing (PLAN 2.4, PLAN 4.2). Both are pure
 * string handling, so they are tested here rather than through a rendered
 * keypad — jsdom is deliberately not installed (PLAN 6) and would buy nothing:
 * the button that calls this is three lines of JSX.
 */
describe('the digit cap', () => {
  it('comes from the activity, not from the session', () => {
    // The old hook hardcoded 3 for every activity, in useSession.js, where a
    // multiple-choice deck could also see it. Arithmetic's largest answer is 20.
    expect(applyKey('1', '7', 2)).toBe('17')
    expect(applyKey('17', '4', 2)).toBe('17')
    expect(applyKey('17', '4', 3)).toBe('174')
  })

  it('refuses the press rather than replacing or wrapping', () => {
    // She has typed 20 and presses another key: the box must not silently become
    // '0' or '02'. Nothing happens, and what she typed is still there to delete.
    expect(applyKey('20', '5', 2)).toBe('20')
  })

  it('falls back to three digits when the cap is missing or nonsense', () => {
    expect(applyKey('12', '3')).toBe('123')
    expect(applyKey('12', '3', 0)).toBe('123')
    expect(applyKey('12', '3', undefined)).toBe('123')
  })
})

describe('leading zeros', () => {
  it('does not let a first zero pad the answer', () => {
    expect(applyKey('0', '5', 2)).toBe('5')
  })

  it('keeps a lone zero, because 0 is a real answer here', () => {
    // A number bond deck contains `0 + 10 = 10`. A box that refuses a first zero
    // makes that card unanswerable.
    expect(applyKey('', '0', 2)).toBe('0')
    expect(applyKey('0', '0', 2)).toBe('0')
  })

  it('leaves a zero that is not leading alone', () => {
    expect(applyKey('1', '0', 2)).toBe('10')
    expect(applyKey('2', '0', 2)).toBe('20')
  })
})

describe('delete', () => {
  it('takes the last digit', () => {
    expect(applyKey('17', KEYPAD_KEYS.DELETE, 2)).toBe('1')
    expect(applyKey('1', KEYPAD_KEYS.DELETE, 2)).toBe('')
  })

  it('is harmless on an empty box', () => {
    expect(applyKey('', KEYPAD_KEYS.DELETE, 2)).toBe('')
  })
})

describe('anything that is not a digit', () => {
  it('never reaches the buffer', () => {
    // ENTER is handled by the adapter before it gets here; the point of this is
    // that a key added later (a decimal point, a minus sign) cannot land in an
    // answer box silently.
    expect(applyKey('1', KEYPAD_KEYS.SUBMIT, 2)).toBe('1')
    expect(applyKey('1', '.', 2)).toBe('1')
    expect(applyKey('1', '-', 2)).toBe('1')
    expect(applyKey('1', '12', 2)).toBe('1')
  })
})
