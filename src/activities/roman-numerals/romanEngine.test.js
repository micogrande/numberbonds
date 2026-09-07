import { describe, expect, it, vi } from 'vitest'

import { CHOICE_COUNT, CLASS_QUOTA, HARD_ROUNDS, KIND, SHAPES, balancedPositions, generate, shapeClass } from './romanEngine'
import { getDistractors, toRoman } from './roman'
import { mulberry32 } from '../../lib/rng'

/**
 * Roman numerals — the deck. (PLAN 4.4)
 *
 * `roman.test.js` pins the half of this activity that has no randomness in it.
 * This file is the other half: **which** values she meets, and **where** the
 * right answer sits.
 *
 * Everything below is checked over a hundred seeds rather than one, because
 * every property PLAN 4.4 asks for is a property of *every* deck she could ever
 * be dealt, not of one lucky arrangement:
 *
 *   - up to 10 is exhaustive — all ten cards, every session
 *   - 50 and 100 are 12 cards stratified across the five shape classes
 *   - the two hardest slots are reserved: a hard round-ten is always in the
 *     deck, and the FINAL card is always double-subtractive
 *   - the correct answer's position is balanced 3/3/3/3 and never repeats twice
 *     in a row, so she cannot score by thumb position
 *
 * The shared `activities/registry.test.js` already covers what every activity
 * owes the contract — deck size against the manifest, unique card ids, card
 * shape, determinism under a seed, no `Math.random`. Those are not re-tested
 * here; what is here is what only this engine promises.
 */

const SEEDS = Array.from({ length: 100 }, (_, index) => 20260906 + index * 7919)
const seeded = (seed) => mulberry32(seed)

/** Every deck a seed can produce for one option. */
const decksFor = (max) => SEEDS.map((seed) => generate({ max }, seeded(seed)))

const valuesOf = (deck) => deck.map((card) => card.answer)
const positionOf = (card) => card.choices.findIndex((choice) => choice.id === card.answer)

/** How many cards of each shape class one deck holds. */
const shapeCounts = (deck) => {
  const counts = {}
  for (const card of deck) counts[card.meta.shape] = (counts[card.meta.shape] ?? 0) + 1
  return counts
}

describe('the five shape classes', () => {
  it('sorts every number from 1 to 100 into exactly one class', () => {
    const known = new Set(Object.values(SHAPES))

    for (let value = 1; value <= 100; value++) {
      expect(known, `${toRoman(value)} has no class`).toContain(shapeClass(value))
    }
  })

  it('classifies the shapes a child actually distinguishes', () => {
    // Tally, then five-based, then round tens, then one subtractive pair, then
    // two. The order of the checks is the priority: a round ten that is also
    // subtractive (XL, XC) is a ROUND, because "is it a whole ten?" is the first
    // question she asks of a numeral.
    expect(shapeClass(3)).toBe(SHAPES.TALLY) // III
    expect(shapeClass(23)).toBe(SHAPES.TALLY) // XXIII
    expect(shapeClass(7)).toBe(SHAPES.FIVE) // VII
    expect(shapeClass(58)).toBe(SHAPES.FIVE) // LVIII
    expect(shapeClass(10)).toBe(SHAPES.ROUND) // X
    expect(shapeClass(40)).toBe(SHAPES.ROUND) // XL — subtractive, but a round ten first
    expect(shapeClass(90)).toBe(SHAPES.ROUND) // XC
    expect(shapeClass(100)).toBe(SHAPES.ROUND) // C
    expect(shapeClass(4)).toBe(SHAPES.SUBTRACTIVE) // IV
    expect(shapeClass(19)).toBe(SHAPES.SUBTRACTIVE) // XIX
    expect(shapeClass(45)).toBe(SHAPES.SUBTRACTIVE) // XLV
    expect(shapeClass(44)).toBe(SHAPES.DOUBLE) // XLIV
  })

  it('finds exactly the double-subtractive sets PLAN 4.4 names', () => {
    // "the final card drawn from the double-subtractive set {44,49} / {44,49,94,99}
    // — XLIV, XLIX, XCIV, XCIX". Derived from the classifier rather than typed
    // out, so the reserved slot and the class agree by construction.
    const doublesUpTo = (max) =>
      Array.from({ length: max }, (_, index) => index + 1).filter((value) => shapeClass(value) === SHAPES.DOUBLE)

    expect(doublesUpTo(10)).toEqual([])
    expect(doublesUpTo(50)).toEqual([44, 49])
    expect(doublesUpTo(100)).toEqual([44, 49, 94, 99])
    expect(doublesUpTo(100).map(toRoman)).toEqual(['XLIV', 'XLIX', 'XCIV', 'XCIX'])
  })
})

describe('up to 10 is exhaustive (PLAN 4.4)', () => {
  // "there are only ten possible cards, so she meets all ten every session and
  // only the order and button positions vary. That is right for a closed set of
  // ten facts."
  it('deals all ten numerals, every time, in a different order', () => {
    const decks = decksFor(10)

    for (const deck of decks) {
      expect(deck).toHaveLength(10)
      expect(valuesOf(deck).slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    }

    const orders = new Set(decks.map((deck) => valuesOf(deck).join(',')))
    expect(orders.size, 'every session dealt the same order').toBeGreaterThan(SEEDS.length / 2)
  })
})

describe('up to 50 and up to 100 are 12 stratified cards (PLAN 4.4)', () => {
  it.each([[50], [100]])('max %i deals the same five-class mix every session', (max) => {
    // The quota is fixed, not sampled: a session that happened to be five tally
    // cards and no subtractive one would be a different activity from the same
    // button.
    expect(Object.values(CLASS_QUOTA).reduce((a, b) => a + b, 0)).toBe(12)

    for (const deck of decksFor(max)) {
      expect(deck).toHaveLength(12)
      expect(shapeCounts(deck)).toEqual(CLASS_QUOTA)
    }
  })

  it.each([[50], [100]])('max %i always reserves a hard round-ten', (max) => {
    // "the two hardest slots reserved: one round-ten from {40,50} / {40,60,90,100}"
    for (const deck of decksFor(max)) {
      const hard = valuesOf(deck).filter((value) => HARD_ROUNDS[max].includes(value))
      expect(hard.length, `no hard round-ten in ${valuesOf(deck).join(',')}`).toBeGreaterThanOrEqual(1)
    }

    // And over enough sessions she meets all of them, rather than the same one.
    const met = new Set(decksFor(max).flatMap((deck) => valuesOf(deck).filter((v) => HARD_ROUNDS[max].includes(v))))
    expect([...met].sort((a, b) => a - b)).toEqual(HARD_ROUNDS[max])
  })

  it.each([
    [50, [44, 49]],
    [100, [44, 49, 94, 99]],
  ])('max %i always ends on a double-subtractive card', (max, doubles) => {
    // "the FINAL card drawn from the double-subtractive set". The hardest card of
    // the session is the last one she sees, not one she meets cold at card two.
    const finals = decksFor(max).map((deck) => deck[deck.length - 1].answer)

    for (const final of finals) {
      expect(doubles, `deck ended on ${final}`).toContain(final)
    }

    expect([...new Set(finals)].sort((a, b) => a - b)).toEqual(doubles)

    // Exactly one of them per deck — the quota — so the last card is the only
    // one of its kind and nothing else in the deck gives it away.
    for (const deck of decksFor(max)) {
      expect(valuesOf(deck).filter((value) => doubles.includes(value))).toHaveLength(1)
    }
  })

  it.each([[50], [100]])('max %i never repeats a numeral inside one session', (max) => {
    for (const deck of decksFor(max)) {
      expect(new Set(valuesOf(deck)).size).toBe(deck.length)
    }
  })

  it.each([[50], [100]])('max %i draws from the whole range across sessions', (max) => {
    // Stratified, not narrow: a 12-card deck out of 50 or 100 has to move around
    // or she meets the same dozen facts every evening.
    const met = new Set(decksFor(max).flatMap(valuesOf))
    expect(met.size).toBeGreaterThan(max / 2)
  })
})

describe('she cannot score by thumb position (PLAN 4.4)', () => {
  // "Correct-answer position is balanced across the deck (each of the four slots
  // used 3×/3×/3×/3× at n=12) with no position used twice in a row."

  it.each([[50], [100]])('max %i uses each of the four slots exactly three times', (max) => {
    for (const deck of decksFor(max)) {
      const counts = [0, 0, 0, 0]
      for (const card of deck) counts[positionOf(card)] += 1
      expect(counts).toEqual([3, 3, 3, 3])
    }
  })

  it('spreads ten cards as evenly as ten cards can be spread', () => {
    for (const deck of decksFor(10)) {
      const counts = [0, 0, 0, 0]
      for (const card of deck) counts[positionOf(card)] += 1
      expect(counts.slice().sort(), 'ten cards over four slots is 3/3/2/2').toEqual([2, 2, 3, 3].sort())
    }
  })

  it.each([[10], [50], [100]])('max %i never puts the answer in the same place twice running', (max) => {
    for (const deck of decksFor(max)) {
      const positions = deck.map(positionOf)

      for (let index = 1; index < positions.length; index++) {
        expect(positions[index], `slot ${positions[index]} twice in a row: ${positions.join('')}`).not.toBe(
          positions[index - 1]
        )
      }
    }
  })

  it.each([[10], [50], [100]])('max %i does not open on the same slot every session', (max) => {
    const openings = new Set(decksFor(max).map((deck) => positionOf(deck[0])))
    expect(openings.size).toBe(CHOICE_COUNT)
  })

  it('shuffles the distractors rather than sorting them', () => {
    // "Choices are shuffled, not sorted — sorted order leaks structure, because
    // the reversal distractor sits at a fixed offset." A deck whose buttons were
    // in ladder order would let her learn that the second button is the
    // read-it-the-other-way answer.
    const arrangements = new Set()

    for (const seed of SEEDS) {
      for (const card of generate({ max: 100 }, seeded(seed))) {
        if (card.answer !== 40) continue
        arrangements.add(card.choices.map((choice) => choice.id).join(','))
      }
    }

    expect(arrangements.size, 'XL always drew the same four buttons in the same order').toBeGreaterThan(4)
  })
})

describe('balancedPositions', () => {
  it('is exact when the count divides, and near-exact when it does not', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      for (const count of [4, 8, 10, 11, 12, 18]) {
        const positions = balancedPositions(count, CHOICE_COUNT, seeded(seed))
        const counts = [0, 0, 0, 0]
        for (const position of positions) counts[position] += 1

        expect(positions).toHaveLength(count)
        expect(Math.max(...counts) - Math.min(...counts), `${count} cards`).toBeLessThanOrEqual(1)

        for (let index = 1; index < positions.length; index++) {
          expect(positions[index]).not.toBe(positions[index - 1])
        }
      }
    }
  })

  it('refuses a request no arrangement can satisfy', () => {
    // Two slots and three cards is 1,2,1 — fine. One slot and two cards cannot
    // avoid a repeat, and a silent repeat is exactly what this function exists
    // to prevent.
    expect(() => balancedPositions(2, 1, seeded(1))).toThrow(RangeError)
  })
})

describe('every card is the Question PLAN 2.1 describes', () => {
  it.each([[10], [50], [100]])('max %i deals GLYPH cards with four labelled choices', (max) => {
    for (const deck of decksFor(max).slice(0, 20)) {
      for (const card of deck) {
        const numeral = toRoman(card.answer)

        expect(card.id).toBe(`ROM-${card.answer}`)
        expect(card.kind).toBe(KIND)
        expect(card.prompt.glyph).toBe(numeral)
        // "spaced for screen readers" (PLAN 2.1's worked ROM-40 card: 'X L')
        expect(card.prompt.text).toBe(numeral.split('').join(' '))
        expect(card.meta).toEqual({ max, shape: shapeClass(card.answer) })

        expect(card.choices).toHaveLength(CHOICE_COUNT)
        expect(card.choices.filter((choice) => choice.id === card.answer)).toHaveLength(1)
        expect(new Set(card.choices.map((choice) => choice.id)).size).toBe(CHOICE_COUNT)

        for (const choice of card.choices) {
          expect(choice.label).toBe(String(choice.id))
          expect(choice.id).toBeGreaterThanOrEqual(1)
          expect(choice.id).toBeLessThanOrEqual(max)
        }

        // The three wrong buttons are the ladder's, unshuffled order aside.
        const offered = card.choices.map((choice) => choice.id).filter((id) => id !== card.answer)
        expect(offered.slice().sort((a, b) => a - b)).toEqual(getDistractors(card.answer, max).sort((a, b) => a - b))
      }
    }
  })

  it('matches PLAN 2.1\'s worked ROM-40 card', () => {
    const card = decksFor(100)
      .flat()
      .find((one) => one.answer === 40)

    expect(card.id).toBe('ROM-40')
    expect(card.kind).toBe('GLYPH')
    expect(card.prompt).toEqual({ glyph: 'XL', text: 'X L' })
    expect(card.answer).toBe(40)
    expect(card.choices.map((choice) => choice.id).sort((a, b) => a - b)).toEqual([39, 40, 41, 60])
  })
})

describe('generate is pure and takes rng last (PLAN 2.2 rule 3)', () => {
  it('deals the same deck twice from the same seed', () => {
    for (const max of [10, 50, 100]) {
      expect(generate({ max }, seeded(4242))).toEqual(generate({ max }, seeded(4242)))
    }
  })

  it('never reaches for Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('ROMAN called Math.random — engines take rng last (PLAN 2.2 rule 3)')
    })

    try {
      for (const max of [10, 50, 100]) {
        expect(() => generate({ max }, seeded(1))).not.toThrow()
      }
    } finally {
      random.mockRestore()
    }
  })

  it('refuses params it cannot deal, loudly', () => {
    // A manifest asking for a ceiling this engine has no template for is a
    // wiring mistake, and the cheapest moment to learn about it is the first
    // deal with the number in the message.
    expect(() => generate({ max: 20 }, seeded(1))).toThrow(TypeError)
    expect(() => generate({}, seeded(1))).toThrow(TypeError)
    expect(() => generate({ max: 100 }, undefined)).toThrow(TypeError)
  })
})
