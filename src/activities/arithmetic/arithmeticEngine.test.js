import { describe, expect, it, vi } from 'vitest'

import {
  BLOCKS,
  BLOCK_SIZE,
  DECK_SIZE,
  KIND,
  MAX,
  MINUS,
  OPS,
  PLUS,
  cardSpace,
  fixAdjacentAnswers,
  generate,
} from './arithmeticEngine'
import { mulberry32 } from '../../lib/rng'

/**
 * Arithmetic — the decks. (PLAN 4.2, PLAN 4.3)
 *
 * Everything below is written from **PLAN's numbers**, not from the engine's.
 * The block predicates are re-stated here in the words PLAN uses (`a+b <= 10`,
 * `m >= 11 and answer <= 9`) and the counts they must produce — 44/109/36 and
 * 44/54/36 — are asserted by enumeration. That is the point: a test that asked
 * the engine which block a card is in and then counted the answers would agree
 * with the engine no matter how wrong the engine was.
 *
 * The deck properties are checked over two hundred seeds rather than one,
 * because every one of them is a property of *every* deck she could be dealt,
 * not of one lucky arrangement. The seeds are fixed constants, so this file is
 * deterministic: it either passes forever or fails on the first run.
 *
 * The shared `activities/registry.test.js` already covers what every activity
 * owes the contract — deck size against the manifest, unique card ids, card
 * shape, determinism under a seed, no `Math.random`. Some of those are repeated
 * here anyway where PLAN states them as facts about *these* decks.
 */

const SEEDS = Array.from({ length: 200 }, (_, index) => 20260906 + index * 7919)
const seeded = (seed) => mulberry32(seed)

const PARAMS = {
  [OPS.ADD]: { op: OPS.ADD, max: MAX },
  [OPS.SUB]: { op: OPS.SUB, max: MAX },
}

/** Every deck a seed can produce for one activity. */
const decksFor = (op) => SEEDS.map((seed) => generate(PARAMS[op], seeded(seed)))

const ADD_DECKS = decksFor(OPS.ADD)
const SUB_DECKS = decksFor(OPS.SUB)

/** The two operands as they are written on the card. */
const operands = (card) => [card.prompt.terms[0].v, card.prompt.terms[2].v]

const answersOf = (deck) => deck.map((card) => card.answer)

// ─── the card space ──────────────────────────────────────────────────────────

describe('the addition card space (PLAN 4.2)', () => {
  const space = cardSpace(OPS.ADD)

  it('is 189 ordered cards', () => {
    // "Card space is 189 ordered cards". Both orientations are in here; a deck
    // takes at most one per unordered pair, which is a different rule.
    expect(space).toHaveLength(189)
  })

  it('obeys 1 <= a <= 19 · 1 <= b <= 19 · 3 <= a+b <= 20, and zero never appears', () => {
    for (const card of space) {
      const { left: a, right: b } = card

      expect(a, `a in ${a}+${b}`).toBeGreaterThanOrEqual(1)
      expect(a).toBeLessThanOrEqual(19)
      expect(b).toBeGreaterThanOrEqual(1)
      expect(b).toBeLessThanOrEqual(19)
      expect(a + b).toBeGreaterThanOrEqual(3)
      expect(a + b).toBeLessThanOrEqual(MAX)
      expect(card.answer).toBe(a + b)
    }

    // "0 never appears." Stated separately from the bounds because it is the
    // decision, not a consequence: Number Bonds already drills `0 + n`.
    expect(space.some((card) => card.left === 0 || card.right === 0 || card.answer === 0)).toBe(false)
  })

  it('has every ordered pair exactly once, so 13+4 and 4+13 are both cards', () => {
    expect(new Set(space.map((card) => `${card.left}+${card.right}`)).size).toBe(space.length)
    expect(space.some((card) => card.left === 13 && card.right === 4)).toBe(true)
    expect(space.some((card) => card.left === 4 && card.right === 13)).toBe(true)
  })

  it('partitions into A 44 / B 109 / C 36', () => {
    // PLAN 4.2's table, re-stated in its own words rather than read off the
    // engine. These three counts are how you know the predicates are right.
    const within = space.filter((card) => card.left + card.right <= 10)
    const teen = space.filter((card) => card.left + card.right >= 11 && Math.max(card.left, card.right) >= 10)
    const bridging = space.filter((card) => card.left + card.right >= 11 && Math.max(card.left, card.right) <= 9)

    expect(within).toHaveLength(44)
    expect(teen).toHaveLength(109)
    expect(bridging).toHaveLength(36)
    expect(within.length + teen.length + bridging.length).toBe(189)

    for (const card of within) expect(card.block, `${card.left}+${card.right}`).toBe(BLOCKS.A)
    for (const card of teen) expect(card.block, `${card.left}+${card.right}`).toBe(BLOCKS.B)
    for (const card of bridging) expect(card.block, `${card.left}+${card.right}`).toBe(BLOCKS.C)
  })

  it("puts PLAN's worked examples in the blocks PLAN names them for", () => {
    const at = (a, b) => space.find((card) => card.left === a && card.right === b).block

    expect(at(13, 4)).toBe(BLOCKS.B) // "ones-column only (13+4)"
    expect(at(8, 5)).toBe(BLOCKS.C) // "make-ten (8+5 = 8+2+3)"
    expect(at(3, 4)).toBe(BLOCKS.A) // count-on, no bridging
  })
})

describe('the subtraction card space (PLAN 4.3)', () => {
  const space = cardSpace(OPS.SUB)

  it('is 134 cards', () => {
    expect(space).toHaveLength(134)
  })

  it('obeys 3 <= m <= 20 · 1 <= s <= 9 · s <= m-1, so zero never appears and the answer is never negative', () => {
    for (const card of space) {
      const { left: m, right: s } = card

      expect(m, `m in ${m}-${s}`).toBeGreaterThanOrEqual(3)
      expect(m).toBeLessThanOrEqual(MAX)
      expect(s).toBeGreaterThanOrEqual(1)
      expect(s).toBeLessThanOrEqual(9)
      expect(s).toBeLessThanOrEqual(m - 1)

      // 1 <= answer <= 19. `n - n = 0` is excluded on purpose: it is a rule to
      // be told, not a fact to be recalled, and a big `0` in the answer box
      // reads as "nothing" to a child, exactly like the empty `?`.
      expect(card.answer).toBe(m - s)
      expect(card.answer).toBeGreaterThanOrEqual(1)
      expect(card.answer).toBeLessThanOrEqual(19)
    }

    expect(space.some((card) => card.answer === 0)).toBe(false)
  })

  it('partitions into A 44 / B 54 / C 36', () => {
    const small = space.filter((card) => card.left <= 10)
    const teen = space.filter((card) => card.left >= 11 && card.answer >= 10)
    const bridging = space.filter((card) => card.left >= 11 && card.answer <= 9)

    expect(small).toHaveLength(44)
    expect(teen).toHaveLength(54)
    expect(bridging).toHaveLength(36)
    expect(small.length + teen.length + bridging.length).toBe(134)

    for (const card of small) expect(card.block, `${card.left}-${card.right}`).toBe(BLOCKS.A)
    for (const card of teen) expect(card.block, `${card.left}-${card.right}`).toBe(BLOCKS.B)
    for (const card of bridging) expect(card.block, `${card.left}-${card.right}`).toBe(BLOCKS.C)
  })

  it("puts PLAN's own example, 17 - 4, in block B", () => {
    // "134 cards, blocks A / B (m >= 11, answer >= 10, 54 — the given example
    // lives here) / C".
    expect(space.find((card) => card.left === 17 && card.right === 4).block).toBe(BLOCKS.B)
  })
})

// ─── the trap ────────────────────────────────────────────────────────────────

describe('block C thins out at the top — PLAN 4.3\'s named trap', () => {
  const bridging = cardSpace(OPS.SUB).filter((card) => card.block === BLOCKS.C)

  it('has exactly the per-minuend counts PLAN tabulates, including two zeros', () => {
    // > Available C cards per minuend are {11:8, 12:7, 13:6, 14:5, 15:4, 16:3,
    // > 17:2, 18:1, 19:0, 20:0}. Minuends 19 and 20 have NO bridging card at
    // > s <= 9. A sampler that assumes every minuend can produce a C card loops
    // > forever.
    const expected = { 11: 8, 12: 7, 13: 6, 14: 5, 15: 4, 16: 3, 17: 2, 18: 1, 19: 0, 20: 0 }

    for (const [minuend, count] of Object.entries(expected)) {
      expect(bridging.filter((card) => card.left === Number(minuend)), `minuend ${minuend}`).toHaveLength(count)
    }

    expect(bridging).toHaveLength(36)
  })

  it('cannot bridge from 19 or 20 at all, because the smallest answer they reach is 10 and 11', () => {
    // The one fact that breaks a per-minuend sampler. 19 - 9 = 10 and 20 - 9 =
    // 11, so neither minuend has a single card with an answer under ten.
    expect(bridging.filter((card) => card.left >= 19)).toEqual([])
    expect(19 - 9).toBeGreaterThanOrEqual(10)
    expect(20 - 9).toBeGreaterThanOrEqual(10)
  })

  it('deals six C cards in every deck anyway, and never one from 19 or 20', () => {
    // The engine draws from the enumerated block rather than picking a minuend
    // and hunting for a subtrahend, so the thin top of the range costs it
    // nothing. If this ever hangs instead of failing, the draw has grown a
    // rejection loop and the trap is back.
    for (const deck of SUB_DECKS) {
      const cBlock = deck.slice(2 * BLOCK_SIZE)

      expect(cBlock).toHaveLength(BLOCK_SIZE)

      for (const card of cBlock) {
        const [m] = operands(card)
        expect(card.meta.block).toBe(BLOCKS.C)
        expect(m, `${card.id} is a C card from a minuend that has none`).toBeLessThanOrEqual(18)
        expect(m).toBeGreaterThanOrEqual(11)
        expect(card.answer).toBeLessThanOrEqual(9)
      }
    }
  })
})

// ─── the deck ────────────────────────────────────────────────────────────────

describe.each([
  ['addition', OPS.ADD, ADD_DECKS],
  ['subtraction', OPS.SUB, SUB_DECKS],
])('%s deals 18 cards, 6 per block, A then B then C', (_name, op, decks) => {
  it('is 18 cards in A → B → C order, every time', () => {
    // "Deck = 6 A, then 6 B, then 6 C, in that order."
    for (const deck of decks) {
      expect(deck).toHaveLength(DECK_SIZE)
      expect(deck.map((card) => card.meta.block).join('')).toBe('AAAAAABBBBBBCCCCCC')
      expect(deck.every((card) => card.meta.op === op)).toBe(true)
    }
  })

  it('never repeats a card inside a deck', () => {
    for (const deck of decks) {
      expect(new Set(deck.map((card) => card.id)).size).toBe(DECK_SIZE)
    }
  })

  it('never puts the same answer on two cards in a row', () => {
    // "A final block-local fix-up pass prevents two adjacent cards sharing an
    // answer." Checked across the whole deck, including the B/C seam, which is
    // the one place two different blocks can produce the same answer.
    for (const deck of decks) {
      const answers = answersOf(deck)

      for (let index = 1; index < answers.length; index++) {
        expect(
          answers[index],
          `${deck[index - 1].prompt.text} then ${deck[index].prompt.text} both answer ${answers[index]}`
        ).not.toBe(answers[index - 1])
      }
    }
  })

  it('deals the same deck twice from the same seed, and different decks from different seeds', () => {
    // PLAN 2.2 rule 3. The second half matters too: a deck that ignored its rng
    // would satisfy every other test in this file.
    expect(generate(PARAMS[op], seeded(SEEDS[0]))).toEqual(generate(PARAMS[op], seeded(SEEDS[0])))

    const shapes = new Set(decks.map((deck) => deck.map((card) => card.id).join(' ')))
    expect(shapes.size).toBeGreaterThan(SEEDS.length / 2)
  })

  it('never reaches for Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('the arithmetic engine called Math.random — engines take rng last (PLAN 2.2 rule 3)')
    })

    try {
      expect(() => generate(PARAMS[op], seeded(SEEDS[0]))).not.toThrow()
    } finally {
      random.mockRestore()
    }
  })

  it('renders one line, with the blank always after the equals sign', () => {
    // PLAN 2.1's shape: terms stop at `=`, because the missing value is always
    // the result — 100% of cards (PLAN 4.2) — and the answer box is what comes
    // next. Missing-addend is what Number Bonds already is.
    for (const card of decks[0]) {
      const [first, second] = operands(card)
      const symbol = op === OPS.ADD ? PLUS : MINUS

      expect(card.kind).toBe(KIND)
      expect(card.prompt.terms).toEqual([
        { t: 'num', v: first },
        { t: 'op', v: symbol },
        { t: 'num', v: second },
        { t: 'op', v: '=' },
      ])
      expect(card.prompt.text).toBe(`${first} ${symbol} ${second} = ?`)
      expect(card.id).toBe(`${op.toUpperCase()}-${first}-${second}`)
      expect(card.answer).toBe(op === OPS.ADD ? first + second : first - second)
    }
  })

  it('caps a block at two cards with the same answer', () => {
    // Not PLAN's rule — the engine's, and the reason the fix-up pass can always
    // succeed. Six cards that all answer 20 cannot be arranged so that no two of
    // them are neighbours; capped at two, an unarrangeable block cannot happen.
    for (const deck of decks) {
      for (let start = 0; start < DECK_SIZE; start += BLOCK_SIZE) {
        const counts = new Map()

        for (const card of deck.slice(start, start + BLOCK_SIZE)) {
          counts.set(card.answer, (counts.get(card.answer) ?? 0) + 1)
        }

        expect(Math.max(...counts.values()), `block at ${start}`).toBeLessThanOrEqual(2)
      }
    }
  })
})

describe('the reserved slots (PLAN 4.2)', () => {
  it('puts a double within ten at index 4', () => {
    for (const deck of ADD_DECKS) {
      const [a, b] = operands(deck[4])

      expect(a, deck[4].prompt.text).toBe(b)
      expect(a + b).toBeLessThanOrEqual(10)
      expect(deck[4].meta.block).toBe(BLOCKS.A)
    }
  })

  it('puts a fact with an addend of exactly 10 at index 6', () => {
    for (const deck of ADD_DECKS) {
      const [a, b] = operands(deck[6])

      expect(a === 10 || b === 10, deck[6].prompt.text).toBe(true)
      expect(deck[6].meta.block).toBe(BLOCKS.B)
    }
  })

  it('puts a double over ten at index 12', () => {
    for (const deck of ADD_DECKS) {
      const [a, b] = operands(deck[12])

      expect(a, deck[12].prompt.text).toBe(b)
      expect(a + b).toBeGreaterThanOrEqual(11)
      expect(deck[12].meta.block).toBe(BLOCKS.C)
    }
  })
})

describe('the reserved slots (PLAN 4.3)', () => {
  it('puts a minuend of exactly 10 at index 5', () => {
    for (const deck of SUB_DECKS) {
      expect(operands(deck[5])[0], deck[5].prompt.text).toBe(10)
      expect(deck[5].meta.block).toBe(BLOCKS.A)
    }
  })

  it('puts an answer of exactly 10 at index 11', () => {
    for (const deck of SUB_DECKS) {
      expect(deck[11].answer, deck[11].prompt.text).toBe(10)
      expect(deck[11].meta.block).toBe(BLOCKS.B)
    }
  })

  it('puts a subtrahend of exactly 9 at index 12', () => {
    for (const deck of SUB_DECKS) {
      expect(operands(deck[12])[1], deck[12].prompt.text).toBe(9)
      expect(deck[12].meta.block).toBe(BLOCKS.C)
    }
  })
})

describe('addition orientation (PLAN 4.2)', () => {
  it('renders block B larger-first at 6–9 and smaller-first at 10–11', () => {
    // "Block B renders larger-first at indices 6–9 and smaller-first at 10–11,
    // so she meets the flipped form only after four count-on reps." 13+4 is
    // count-on-from-larger; 4+13 requires first noticing you should flip it.
    for (const deck of ADD_DECKS) {
      for (const index of [6, 7, 8, 9]) {
        const [first, second] = operands(deck[index])
        expect(first, `${deck[index].prompt.text} at ${index}`).toBeGreaterThanOrEqual(second)
        // Block B is "max >= 10", so larger-first means the big number leads.
        expect(first).toBeGreaterThanOrEqual(10)
      }

      for (const index of [10, 11]) {
        const [first, second] = operands(deck[index])
        expect(first, `${deck[index].prompt.text} at ${index}`).toBeLessThanOrEqual(second)
        expect(second).toBeGreaterThanOrEqual(10)
      }
    }
  })

  it('takes at most one card per unordered pair', () => {
    // "Both orientations exist as cards, but a given unordered pair appears at
    // most once per deck." So `13+4` and `4+13` are never both dealt.
    for (const deck of ADD_DECKS) {
      const pairs = deck.map((card) => operands(card).sort((x, y) => x - y).join('+'))
      expect(new Set(pairs).size).toBe(DECK_SIZE)
    }
  })

  it('writes some within-ten cards each way round across sessions', () => {
    // Blocks A and C are single digits either side, so neither order is the
    // hard one and PLAN says nothing about them. They are a coin flip, which is
    // what stops every within-ten card in every session reading the same way.
    const outsideB = ADD_DECKS.flatMap((deck) => [...deck.slice(0, 6), ...deck.slice(12)])
    const flipped = outsideB.filter((card) => {
      const [first, second] = operands(card)
      return first < second
    })

    expect(flipped.length).toBeGreaterThan(0)
    expect(flipped.length).toBeLessThan(outsideB.length)
  })
})

describe('the minus sign is U+2212, not a hyphen (PLAN 4.3)', () => {
  it('is the minus sign itself', () => {
    // "at 44px+ the difference is obvious". A hyphen would render as a dash
    // between two numbers rather than as an instruction to take one away.
    expect(MINUS.codePointAt(0)).toBe(0x2212)
    expect(MINUS).not.toBe('-')
  })

  it('never lets a hyphen into a subtraction card she can see or hear', () => {
    for (const deck of SUB_DECKS) {
      for (const card of deck) {
        expect(card.prompt.text).toContain(MINUS)
        expect(card.prompt.text).not.toContain('-')
        expect(card.prompt.terms[1].v).toBe(MINUS)
      }
    }
  })

  it('uses a plain + for addition', () => {
    for (const card of ADD_DECKS[0]) {
      expect(card.prompt.terms[1].v).toBe(PLUS)
      expect(card.prompt.text).toContain(PLUS)
    }
  })
})

describe("PLAN 2.1's worked card", () => {
  it('deals SUB-17-4 exactly as the specification writes it', () => {
    // > { id:'SUB-17-4', kind:'EQUATION',
    // >   prompt:{ terms:[{t:'num',v:17},{t:'op',v:'−'},{t:'num',v:4},{t:'op',v:'='}],
    // >            text:'17 − 4 = ?' },
    // >   answer:13, meta:{ block:'B' } }
    const card = SUB_DECKS.flat().find((dealt) => dealt.id === 'SUB-17-4')

    expect(card, 'no deck in 200 seeds dealt 17 − 4').toBeDefined()
    expect(card.kind).toBe('EQUATION')
    expect(card.prompt).toEqual({
      terms: [
        { t: 'num', v: 17 },
        { t: 'op', v: MINUS },
        { t: 'num', v: 4 },
        { t: 'op', v: '=' },
      ],
      text: `17 ${MINUS} 4 = ?`,
    })
    expect(card.answer).toBe(13)
    expect(card.meta.block).toBe('B')
  })
})

// ─── the fix-up pass ─────────────────────────────────────────────────────────

describe('fixAdjacentAnswers', () => {
  const block = (...answers) => answers.map((answer, index) => ({ answer, id: index }))
  const clashes = (cards) => cards.filter((card, index) => index > 0 && card.answer === cards[index - 1].answer).length

  it('separates two neighbours that share an answer', () => {
    const fixed = fixAdjacentAnswers(block(3, 7, 7, 4, 9, 5), new Set(), seeded(1))

    expect(clashes(fixed)).toBe(0)
    expect(fixed.map((card) => card.answer).sort((a, b) => a - b)).toEqual([3, 4, 5, 7, 7, 9])
  })

  it('never moves a reserved card off its slot', () => {
    // The reserved slots are the coverage guarantee; a repair that moved one
    // would trade a repeated answer for a deck that no longer covers what PLAN
    // says it covers.
    const cards = block(5, 5, 8, 2, 6, 9)
    const fixed = fixAdjacentAnswers(cards, new Set([1]), seeded(2))

    expect(fixed[1]).toBe(cards[1])
    expect(clashes(fixed)).toBe(0)
  })

  it('never moves a card into another block', () => {
    // Block-local means the swaps are block-local: the A → B → C progression is
    // the whole point of the deck order.
    const twelve = block(1, 2, 3, 4, 5, 5, 11, 12, 13, 14, 15, 16)
    const fixed = fixAdjacentAnswers(twelve, new Set(), seeded(3))

    expect(fixed.slice(0, BLOCK_SIZE).map((card) => card.answer).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 5])
    expect(fixed.slice(BLOCK_SIZE).map((card) => card.answer)).toEqual([11, 12, 13, 14, 15, 16])
    expect(clashes(fixed)).toBe(0)
  })

  it('fixes a clash across a block boundary by moving the card on its own side', () => {
    // The B/C seam is the only place two blocks can share an answer, and the
    // first card of C is a reserved slot — so the only card that can move is
    // the last card of B.
    const twelve = block(1, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 11)
    const fixed = fixAdjacentAnswers(twelve, new Set([6]), seeded(4))

    expect(fixed[6]).toBe(twelve[6])
    expect(clashes(fixed)).toBe(0)
  })

  it('returns an unfixable block untouched rather than looping or throwing', () => {
    // Six cards that all answer 4 cannot be arranged. The engine's draw makes
    // this unreachable (an answer is capped at two per block), but a repair pass
    // that spun or threw here would be a crash in front of a six-year-old over
    // something cosmetic.
    const impossible = block(4, 4, 4, 4, 4, 4)
    const fixed = fixAdjacentAnswers(impossible, new Set(), seeded(5))

    expect(fixed).toHaveLength(6)
    expect(fixed.map((card) => card.answer)).toEqual([4, 4, 4, 4, 4, 4])
  })

  it('leaves a clean block exactly as it found it', () => {
    const clean = block(1, 2, 3, 4, 5, 6)
    expect(fixAdjacentAnswers(clean, new Set(), seeded(6))).toEqual(clean)
  })
})

// ─── the entry point ─────────────────────────────────────────────────────────

describe('generate refuses what it cannot deal', () => {
  it('needs an rng, and says so', () => {
    expect(() => generate(PARAMS[OPS.ADD])).toThrow(/rng/)
  })

  it('refuses an unknown operation', () => {
    expect(() => generate({ op: 'times', max: MAX }, seeded(1))).toThrow(/unknown params.op/)
    expect(() => generate({ max: MAX }, seeded(1))).toThrow(/unknown params.op/)
  })

  it('refuses a ceiling it has no recipe for', () => {
    // Every number in this engine is a fact about the 3–20 deck. Dealing an
    // approximate deck for max 50 would be a personal best out of the wrong
    // denominator (PLAN 2.2).
    expect(() => generate({ op: OPS.ADD, max: 50 }, seeded(1))).toThrow(/written for max 20/)
    expect(() => generate({ op: OPS.SUB }, seeded(1))).toThrow(/written for max 20/)
  })

  it('refuses an unknown op from cardSpace too', () => {
    expect(() => cardSpace('times')).toThrow(/unknown op/)
  })
})
