import { describe, expect, it, vi } from 'vitest'

import { DISTRACTOR_COUNT, NEIGHBOUR_LIMIT, fromRoman, getDistractors, toRoman } from './roman'

/**
 * Roman numerals — the numeral table and the distractor ladder. (PLAN 4.4)
 *
 * This file exists because PLAN 4.4 made one design decision that is worth more
 * than any amount of test scaffolding:
 *
 * > **Distractors are a pure function of `(value, max)` with no randomness at
 * > all**, so every set is assertable with an exact expected array. Randomness
 * > enters only in which values are sampled and where the buttons go.
 *
 * So the interesting half of this activity — *which four numbers she is choosing
 * between* — is a table, not a sample. The verified outputs in PLAN 4.4 were
 * computed before a line of this was written and they are asserted below
 * verbatim. **If the implementation disagrees with one of them, the ladder is
 * wrong. Do not adjust the expected value to match the code.**
 *
 * The exhaustive block underneath is the other half: 480 distractors across
 * max ∈ {10, 50, 100}, every one of which has to be in range, distinct, not the
 * answer, and close enough to the answer to be a real choice rather than a
 * giveaway.
 */

const MAXES = [10, 50, 100]

/** Every value an option can ask about, per max. */
const valuesUpTo = (max) => Array.from({ length: max }, (_, index) => index + 1)

describe('toRoman / fromRoman', () => {
  it('writes the numerals a child meets first', () => {
    expect(valuesUpTo(10).map(toRoman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'])
  })

  it('writes the subtractive forms rather than four in a row', () => {
    // IIII is a clock-face convention, not a Roman numeral, and a deck that
    // dealt both spellings would be teaching her two answers for one number.
    expect(toRoman(4)).toBe('IV')
    expect(toRoman(9)).toBe('IX')
    expect(toRoman(40)).toBe('XL')
    expect(toRoman(90)).toBe('XC')

    for (const value of valuesUpTo(100)) {
      expect(toRoman(value), `${value} repeats a letter four times`).not.toMatch(/(.)\1\1\1/)
    }
  })

  it('writes the double-subtractive numerals PLAN 4.4 reserves the last card for', () => {
    expect(toRoman(44)).toBe('XLIV')
    expect(toRoman(49)).toBe('XLIX')
    expect(toRoman(94)).toBe('XCIV')
    expect(toRoman(99)).toBe('XCIX')
    expect(toRoman(100)).toBe('C')
  })

  it('reads back everything it writes, 1 to 1000', () => {
    for (let value = 1; value <= 1000; value++) {
      expect(fromRoman(toRoman(value)), `${value} did not round-trip`).toBe(value)
    }
  })

  it('reads lowercase and refuses nonsense', () => {
    expect(fromRoman('xiv')).toBe(14)
    expect(() => fromRoman('XIVQ')).toThrow(TypeError)
    expect(() => toRoman(0)).toThrow(RangeError)
    expect(() => toRoman(2.5)).toThrow(RangeError)
  })
})

describe("the distractor ladder's verified outputs (PLAN 4.4)", () => {
  // >>> These six arrays are copied from PLAN 4.4. They were computed and
  // >>> verified there. They are the specification of the ladder, in the ladder's
  // >>> own order, and nothing below may be edited to make an implementation pass.

  it('IV → [6, 5, 3] — the reversal plus neighbours', () => {
    // R1a reads the subtractive pair additively (I + V = 6); R2 miscounts the
    // tally by one in each direction.
    expect(getDistractors(4, 10)).toEqual([6, 5, 3])
  })

  it('IX → [10, 8, 4] — the whole 4/6/9/11 cluster', () => {
    // R1a would offer 11, but 11 is outside `max` and is dropped, so the ladder
    // falls through R2 (10, 8) to R4's five slip (9 − 5 = 4).
    expect(getDistractors(9, 10)).toEqual([10, 8, 4])
  })

  it('XL → [60, 41, 39] at max 100', () => {
    expect(getDistractors(40, 100)).toEqual([60, 41, 39])
  })

  it('LX → [40, 61, 59]', () => {
    // R1b, the other direction: an additive pair read subtractively. This is the
    // XL/LX confusion exercised from the LX side.
    expect(getDistractors(60, 100)).toEqual([40, 61, 59])
  })

  it('C → [99, 90, 95], which puts XC on a button', () => {
    expect(getDistractors(100, 100)).toEqual([99, 90, 95])
  })

  it('XL → [41, 39, 50] at max 50', () => {
    // The accepted consequence PLAN 4.4 states plainly: at max 50 the reversal
    // (60) is out of range and is dropped, so the XL/LX pair is not directly
    // exercised here. Keeping every option inside the advertised range matters
    // more — an out-of-range option is eliminable without reading the numeral.
    expect(getDistractors(40, 50)).toEqual([41, 39, 50])

    // Said as an assertion rather than only as a comment.
    expect(getDistractors(40, 50)).not.toContain(60)
  })
})

describe('the two gates that are the whole difficulty of the ladder', () => {
  it('R1b matches the LAST TWO characters, so XIII never generates 9', () => {
    // "no child misreads the leading XI of XIII as IX" (PLAN 4.4). An `includes`
    // check would find "XI" inside "XIII" and offer 9 — a distractor for a
    // confusion that does not exist.
    expect(toRoman(13)).toBe('XIII')
    expect(getDistractors(13, 50)).not.toContain(9)
    expect(getDistractors(13, 50)).toEqual([14, 12, 23])

    // The rule still fires when the trailing pair really is one.
    expect(getDistractors(11, 50)).toContain(9) // XI → IX
    expect(getDistractors(60, 100)).toContain(40) // LX → XL
  })

  it('R3 is gated on value ≥ 10, so I never generates 11', () => {
    // A ten slip on a numeral with no ten in it "is not a real confusion"
    // (PLAN 4.4). At max 50 the gate is the only thing stopping it: 11 is well
    // inside the range.
    expect(getDistractors(1, 50)).not.toContain(11)
    expect(getDistractors(1, 50)).toEqual([2, 6, 3])

    for (const value of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(getDistractors(value, 100), `${toRoman(value)} slipped a ten`).not.toContain(value + 10)
    }

    // And it fires the moment there is a ten to slip.
    expect(getDistractors(100, 100)).toContain(90)
  })
})

describe('the ladder is a pure function of (value, max)', () => {
  it('never reaches for Math.random', () => {
    // PLAN 6: engines must not call Math.random — the tests stub it to throw.
    // The ladder is stricter than that: it takes no rng at all, which is what
    // makes an exact expected array possible in the first place.
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('the distractor ladder called Math.random — it is a pure function of (value, max)')
    })

    try {
      for (const max of MAXES) {
        for (const value of valuesUpTo(max)) {
          expect(() => getDistractors(value, max)).not.toThrow()
        }
      }
    } finally {
      random.mockRestore()
    }
  })

  it('answers identically every time, and hands back a fresh array', () => {
    const first = getDistractors(49, 100)
    const second = getDistractors(49, 100)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)

    first[0] = 999
    expect(getDistractors(49, 100)).toEqual(second)
  })

  it('refuses a value its own range does not contain', () => {
    expect(() => getDistractors(51, 50)).toThrow(RangeError)
    expect(() => getDistractors(0, 10)).toThrow(RangeError)
  })
})

describe('every distractor of every card of every option (PLAN 4.4)', () => {
  // "Checked exhaustively over all 480 distractors for max ∈ {10,50,100}: always
  // exactly 3, always distinct, always in range, and every one within 20 of the
  // answer — no absurd option ever reaches a button."
  const everySet = MAXES.flatMap((max) =>
    valuesUpTo(max).map((value) => ({ max, value, distractors: getDistractors(value, max) }))
  )

  it('is 480 distractors', () => {
    expect(everySet).toHaveLength(10 + 50 + 100)
    expect(everySet.reduce((total, { distractors }) => total + distractors.length, 0)).toBe(480)
  })

  it('is always exactly three', () => {
    for (const { max, value, distractors } of everySet) {
      expect(distractors, `${toRoman(value)} at max ${max}`).toHaveLength(DISTRACTOR_COUNT)
    }
  })

  it('is always three distinct numbers, none of them the answer', () => {
    for (const { max, value, distractors } of everySet) {
      const at = `${toRoman(value)} at max ${max}`

      expect(new Set(distractors).size, `${at} repeats a distractor`).toBe(DISTRACTOR_COUNT)
      expect(distractors, `${at} offers the answer twice`).not.toContain(value)
      expect(distractors.every(Number.isInteger), `${at} is not all whole numbers`).toBe(true)
    }
  })

  it('is always inside the advertised range', () => {
    // An option outside `max` is eliminable without reading the numeral, which
    // turns a four-way choice into a three-way one for free.
    for (const { max, value, distractors } of everySet) {
      for (const distractor of distractors) {
        expect(distractor, `${toRoman(value)} at max ${max} offered ${distractor}`).toBeGreaterThanOrEqual(1)
        expect(distractor, `${toRoman(value)} at max ${max} offered ${distractor}`).toBeLessThanOrEqual(max)
      }
    }
  })

  it('is always within 20 of the answer — no absurd option ever reaches a button', () => {
    for (const { max, value, distractors } of everySet) {
      for (const distractor of distractors) {
        expect(
          Math.abs(distractor - value),
          `${toRoman(value)} at max ${max} offered ${distractor}, which is not a near miss`
        ).toBeLessThanOrEqual(NEIGHBOUR_LIMIT)
      }
    }
  })
})
