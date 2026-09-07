/**
 * Number Bonds — non-regression tests. (PLAN 4.1, PLAN 6)
 *
 * The engine changed shape at step 6; it must not have changed *behaviour*.
 * Amelia's personal bests are per-deck records, so a deck that quietly grew or
 * shrank a card would make every stored best for that key incomparable without
 * anything visibly breaking. These pin the counts PLAN 4.1 names — 11 cards for
 * `whole = 10`, 18 for `mixed(20)` — and the invariant that actually matters on
 * screen: the answer is always the number that is missing from the picture.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mulberry32 } from '../../lib/rng'
import { MISSING, generateDeck, generateMixedDeck } from './bondEngine'

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * The answer this card *should* have, re-derived from the picture rather than
 * imported from the engine. Importing the engine's own helper would only prove
 * it agrees with itself — the whole point is that a reader looking at the
 * circles and this function reach the same number.
 */
function expectedAnswer(question) {
  const { whole, parts, missing } = question.prompt

  switch (missing) {
    case MISSING.WHOLE:
      return whole
    case MISSING.PART0:
      return parts[0]
    case MISSING.PART1:
      return parts[1]
    default:
      throw new Error(`unknown missing slot: ${String(missing)}`)
  }
}

/** Every card in a deck, checked against the shape PLAN 2.1 specifies. */
function expectWellFormed(deck) {
  for (const question of deck) {
    expect(typeof question.id).toBe('string')
    expect(question.id.length).toBeGreaterThan(0)
    expect(question.kind).toBe('BOND')

    const { whole, parts, missing, text } = question.prompt

    expect(parts).toHaveLength(2)
    expect(parts[0] + parts[1]).toBe(whole)
    expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true)
    expect([MISSING.WHOLE, MISSING.PART0, MISSING.PART1]).toContain(missing)
    expect(typeof text).toBe('string')

    // The one that matters: the graded value is the number that is not on
    // screen. This is the assertion the old double-assigned `answer` would have
    // failed the day someone deleted the second, corrective line.
    expect(question.answer).toBe(expectedAnswer(question))
  }

  // Unique within the deck, because the id is the React key (PLAN 2.1) and a
  // duplicate would silently stop a card remounting.
  const ids = deck.map((q) => q.id)
  expect(new Set(ids).size).toBe(deck.length)
}

describe('generateDeck — "bonds to N"', () => {
  it('yields 11 cards for a target of 10', () => {
    expect(generateDeck(10, mulberry32(1))).toHaveLength(11)
  })

  it('yields N + 1 cards across the whole 3–20 range she can pick from', () => {
    for (let target = 3; target <= 20; target++) {
      expect(generateDeck(target, mulberry32(target))).toHaveLength(target + 1)
    }
  })

  it('covers every pair from 0 + N to N + 0 exactly once', () => {
    const firstParts = generateDeck(10, mulberry32(9))
      .map((q) => q.prompt.parts[0])
      .sort((a, b) => a - b)

    expect(firstParts).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('never hides the whole — the whole is what she is given', () => {
    for (const question of generateDeck(10, mulberry32(11))) {
      expect(question.prompt.whole).toBe(10)
      expect([MISSING.PART0, MISSING.PART1]).toContain(question.prompt.missing)
    }
  })

  it('blanks each part sometimes, so a pair is not always asked the same way', () => {
    // Over a big deck and a fixed seed this is deterministic, not a coin flip
    // that might come up 21 heads.
    const missing = new Set(generateDeck(20, mulberry32(3)).map((q) => q.prompt.missing))
    expect(missing).toEqual(new Set([MISSING.PART0, MISSING.PART1]))
  })

  it('is well formed under fifty different seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      expectWellFormed(generateDeck(10, mulberry32(seed)))
    }
  })
})

describe('generateMixedDeck — "parts up to N"', () => {
  it('yields 18 cards for a max of 20', () => {
    expect(generateMixedDeck(20, mulberry32(1))).toHaveLength(18)
  })

  it('yields N - 2 cards, one per whole from 3 to N', () => {
    for (let max = 3; max <= 20; max++) {
      const deck = generateMixedDeck(max, mulberry32(max))
      expect(deck).toHaveLength(max - 2)

      const wholes = deck.map((q) => q.prompt.whole).sort((a, b) => a - b)
      expect(wholes).toEqual(Array.from({ length: max - 2 }, (_, i) => i + 3))
    }
  })

  it('is empty below 3 rather than throwing — there is no bond to make', () => {
    expect(generateMixedDeck(2, mulberry32(1))).toEqual([])
  })

  it('always hides the whole, and the answer is that whole', () => {
    for (const question of generateMixedDeck(20, mulberry32(5))) {
      expect(question.prompt.missing).toBe(MISSING.WHOLE)
      expect(question.answer).toBe(question.prompt.whole)
    }
  })

  it('is well formed under fifty different seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      expectWellFormed(generateMixedDeck(20, mulberry32(seed)))
    }
  })
})

// ─── the shape ──────────────────────────────────────────────────────────────
//
// PLAN 2.1 gives one worked bond card by hand. If the engine and the plan
// disagree about what a Question looks like, it should be this test that says
// so, not a renderer failing to find a field.
describe('the Question shape', () => {
  it('matches PLAN 2.1 field for field', () => {
    const question = generateDeck(10, mulberry32(7)).find(
      (q) => q.prompt.parts[0] === 3 && q.prompt.missing === MISSING.PART1
    )

    // Only the seed decides which way round each pair is blanked, so if this
    // seed stops producing the plan's card the test is telling you the draw
    // order moved — pick another seed, do not weaken the assertion.
    expect(question).toEqual({
      id: 'BOND-W10-P3-p1',
      kind: 'BOND',
      prompt: { whole: 10, parts: [3, 7], missing: 'part1', text: '3 and what make 10?' },
      answer: 7,
      meta: { recipe: 'bonds-to', max: 10 },
    })
  })

  it('names the missing slot with a string, never an index with a sentinel', () => {
    expect(MISSING).toEqual({ WHOLE: 'whole', PART0: 'part0', PART1: 'part1' })

    for (const question of [
      ...generateDeck(10, mulberry32(2)),
      ...generateMixedDeck(20, mulberry32(2)),
    ]) {
      expect(typeof question.prompt.missing).toBe('string')
      expect(question.prompt).not.toHaveProperty('missingIndex')
    }
  })

  it('reads the card aloud in prompt.text', () => {
    const whole = generateMixedDeck(4, mulberry32(1))[0]
    expect(whole.prompt.text).toBe(
      `${whole.prompt.parts[0]} and ${whole.prompt.parts[1]} make what?`
    )
  })
})

// ─── purity ─────────────────────────────────────────────────────────────────
//
// PLAN 2.2 rule 3 and PLAN 6: `generate` is pure, takes `rng` last, and never
// reaches for Math.random. This is the rule that makes the whole content layer
// testable, so it is tested rather than trusted.
describe('purity', () => {
  it('gives a deep-equal deck for the same seed', () => {
    expect(generateDeck(10, mulberry32(4242))).toEqual(generateDeck(10, mulberry32(4242)))
    expect(generateMixedDeck(20, mulberry32(4242))).toEqual(
      generateMixedDeck(20, mulberry32(4242))
    )
  })

  it('gives a different deck for a different seed', () => {
    expect(generateDeck(10, mulberry32(1))).not.toEqual(generateDeck(10, mulberry32(2)))
    expect(generateMixedDeck(20, mulberry32(1))).not.toEqual(generateMixedDeck(20, mulberry32(2)))
  })

  it('does not touch Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must never be called — pass an rng instead')
    })

    expect(() => generateDeck(10, mulberry32(1))).not.toThrow()
    expect(() => generateMixedDeck(20, mulberry32(1))).not.toThrow()
  })

  it('refuses to deal without a generator, instead of failing later inside a shuffle', () => {
    expect(() => generateDeck(10)).toThrow(TypeError)
    expect(() => generateMixedDeck(20)).toThrow(TypeError)
  })

  it('does not hand every card the same meta object', () => {
    const deck = generateDeck(10, mulberry32(1))
    expect(deck[0].meta).not.toBe(deck[1].meta)
    expect(deck[0].meta).toEqual(deck[1].meta)
  })
})
