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
 * 44/54/36 for the two `to20` decks, 44/19/36 and 44/0/0 for the two `to10`
 * decks the owner asked for — are asserted by enumeration. That is the point: a
 * test that asked the engine which block a card is in and then counted the
 * answers would agree with the engine no matter how wrong the engine was.
 *
 * The four decks are kept in two halves of this file on purpose. The `to20` half
 * is a NON-REGRESSION suite: `ADD::to20::v1` and `SUB::to20::v1` are live
 * high-score keys (PLAN 2.6), so on top of the properties it always asserted
 * there is now a golden fixture pinning three whole decks per op card for card.
 * Nothing in that half may be relaxed to make a new option fit.
 *
 * The deck properties are checked over two hundred seeds rather than one,
 * because every one of them is a property of *every* deck she could be dealt,
 * not of one lucky arrangement. The seeds are fixed constants, so this file is
 * deterministic: it either passes forever or fails on the first run.
 *
 * Two hundred scattered seeds are not enough for one of those properties. "No
 * two cards in a row share an answer" used to fail on about one addition deck in
 * a thousand, and a 200-seed sample of a 1-in-1010 defect passes by luck roughly
 * four times in five — which is exactly what it did. That property therefore has
 * its own sweep (`SWEEP`) over a contiguous range wide enough that the broken
 * pass failed twenty times inside it, plus two hand-built fixtures that pin the
 * two ways it broke without depending on a seed at all. See
 * `fixAdjacentAnswers`' notes in the engine.
 *
 * The shared `activities/registry.test.js` already covers what every activity
 * owes the contract — deck size against the manifest, unique card ids, card
 * shape, determinism under a seed, no `Math.random`. Some of those are repeated
 * here anyway where PLAN states them as facts about *these* decks.
 */

const SEEDS = Array.from({ length: 200 }, (_, index) => 20260906 + index * 7919)
const seeded = (seed) => mulberry32(seed)

/**
 * The contiguous range the adjacent-answer sweep runs over: seeds 1 … 20000.
 *
 * Contiguous rather than scattered so that the range is a statement anyone can
 * re-check by hand, and 20000 rather than 200 because that is the number that
 * makes the sweep evidence instead of a coin toss. Measured against the pass as
 * it was before this range existed: **20 of these 20000 addition decks shipped
 * two consecutive cards with the same answer** — 28 repeats in all, since eight
 * of those decks carried two — the first at seed 881. A sweep that a broken pass
 * fails twenty times over cannot pass by luck.
 *
 * Subtraction has never produced one — it pins slots 11 *and* 12, so its B/C
 * seam cannot clash — and is swept anyway, because "this op happens not to hit
 * the bug" is a fact about today's reserved slots rather than a rule.
 */
const SWEEP = 20000

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

  it(`still never does, over ${SWEEP} contiguous seeds`, () => {
    // The same property as the test above, swept wide enough to be evidence
    // rather than a sample. See SWEEP: the pass this replaces failed 20 times
    // inside this exact range, and the 200 scattered seeds above caught none of
    // them.
    //
    // The failures are reported all at once rather than on the first one,
    // because "seeds 881, 2661, 2681 …" says which SHAPE of deck breaks and a
    // single seed does not.
    const failures = []

    for (let seed = 1; seed <= SWEEP; seed++) {
      const deck = generate(PARAMS[op], seeded(seed))

      for (let index = 1; index < deck.length; index++) {
        if (deck[index].answer === deck[index - 1].answer) {
          failures.push(`seed ${seed} at slot ${index} (${deck[index].prompt.text} answers ${deck[index].answer} too)`)
        }
      }
    }

    expect(
      failures.slice(0, 10),
      `${failures.length} repeated answers across ${SWEEP} decks — first ten shown`
    ).toEqual([])
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

  // ── the two ways this pass used to fail ───────────────────────────────────
  //
  // Both are hand-built rather than seeded, so they keep testing what they are
  // named for however the draw above it changes. The seeds that produced them
  // are named in the comments, and swept for separately.

  it('repairs a clash against a pinned slot that no single swap can reach', () => {
    // Seed 881's addition deck, as it comes off the draw. Slot 12 is reserved
    // for a double over ten (PLAN 4.2) and may not move, so the clash at the
    // B/C seam has exactly one movable side — slot 11 — and block B is allowed
    // two cards answering 16. Every one of the four legal single swaps out of
    // slot 11 just moves the clash somewhere else inside block B:
    //
    //     11 ↔ 7   13 16 19 16 15 15   the new 15 lands next to the old one
    //     11 ↔ 8   13 15 16 16 15 19   16 next to 16
    //     11 ↔ 9   13 15 19 16 15 16   the two cards are interchangeable
    //     11 ↔ 10  13 15 19 16 16 15   16 next to 16
    //
    // so a pass that only ever swaps one card gives up here, and one addition
    // deck in about a thousand shipped a repeated answer. Two cards have to
    // move at once, which is why the unit of repair is now the block.
    const laid = block(9, 6, 10, 9, 4, 7, 13, 15, 19, 16, 15, 16, 16, 12, 13, 12, 13, 14)
    const pinned = new Set([4, 6, 12])

    expect(clashes(laid), 'the fixture must start with the clash it is named for').toBe(1)

    const fixed = fixAdjacentAnswers(laid, pinned, seeded(881))

    expect(clashes(fixed)).toBe(0)

    // The reserved slots are the coverage guarantee and none of them moved.
    for (const slot of pinned) expect(fixed[slot], `slot ${slot}`).toBe(laid[slot])

    // Every card is still in its own block: A → B → C is the point of the deck.
    for (let start = 0; start < laid.length; start += BLOCK_SIZE) {
      const before = laid.slice(start, start + BLOCK_SIZE).map((card) => card.answer).sort((x, y) => x - y)
      const after = fixed.slice(start, start + BLOCK_SIZE).map((card) => card.answer).sort((x, y) => x - y)

      expect(after, `block at ${start}`).toEqual(before)
    }
  })

  it('fixes the clashes it can even when an earlier one is impossible', () => {
    // Seed 2661's deck has two clashes, at slots 12 and 17. The pass used to
    // stop the moment the LEFTMOST one proved unrepairable, so the second one —
    // an ordinary repeat inside block C, fixable by moving one card — was never
    // even attempted.
    //
    // Made explicit here: block B is six cards that all answer 16 against a
    // pinned 16 at slot 12, which genuinely cannot be arranged. Block C's
    // repeated 3s can. An unfixable clash must cost only itself.
    const laid = block(1, 2, 3, 4, 5, 6, 16, 16, 16, 16, 16, 16, 16, 3, 3, 5, 6, 7)
    const pinned = new Set([12])

    expect(clashes(laid)).toBe(7)

    const fixed = fixAdjacentAnswers(laid, pinned, seeded(2661))

    // Six of the seven survive — the five inside block B and the seam it cannot
    // move away from. The seventh, the one that was reachable, is gone.
    expect(clashes(fixed)).toBe(6)
    expect(clashes(fixed.slice(12)), 'block C still repeats an answer').toBe(0)

    // The impossible block was left exactly as it was rather than churned.
    expect(fixed.slice(6, 12).map((card) => card.answer)).toEqual([16, 16, 16, 16, 16, 16])
    expect(fixed[12]).toBe(laid[12])
  })
})

describe('the two seeds whose decks used to ship a repeated answer', () => {
  // Kept as named regressions beside the sweep. The sweep says the defect class
  // is gone; these two say the exact reported cases are, and they are cheap
  // enough to read: 881 is the unrepairable pinned seam, 2661 is the seam plus
  // a second clash that the old pass abandoned along with it.
  it.each([
    [881, 'a clash at slot 12, the pinned B/C seam'],
    [2661, 'clashes at slots 12 and 17, of which 17 was never attempted'],
  ])('seed %d dealt %s', (seed) => {
    const deck = generate(PARAMS[OPS.ADD], seeded(seed))

    for (let index = 1; index < deck.length; index++) {
      expect(
        deck[index].answer,
        `slot ${index}: ${deck[index - 1].prompt.text} then ${deck[index].prompt.text}`
      ).not.toBe(deck[index - 1].answer)
    }
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
    // Every number in this engine is a fact about a particular ceiling. Dealing
    // an approximate deck for max 50 would be a personal best out of the wrong
    // denominator (PLAN 2.2).
    expect(() => generate({ op: OPS.ADD, max: 50 }, seeded(1))).toThrow(/addition always sums to 20/)
    expect(() => generate({ op: OPS.ADD, max: MAX, addendMax: 5 }, seeded(1))).toThrow(/no addition recipe for addendMax/)
    expect(() => generate({ op: OPS.SUB, max: 15 }, seeded(1))).toThrow(/no subtraction recipe for max/)
    expect(() => generate({ op: OPS.SUB }, seeded(1))).toThrow(/no subtraction recipe for max/)
  })

  it('refuses addition at max 10, because that deck tops out at 9 + 1', () => {
    // The whole trap this option had to get past. `max` caps the SUM, so the
    // obvious-looking reading of "up to 10" deals a deck that can never contain
    // the 10 + 10 the owner asked for — under a chip that promises it. The
    // engine says which knob to turn instead of dealing it.
    expect(() => generate({ op: OPS.ADD, max: 10 }, seeded(1))).toThrow(/caps the ADDENDS, not the sum/)
    expect(() => generate({ op: OPS.ADD, max: 10 }, seeded(1))).toThrow(/addendMax: 10/)
  })

  it('refuses addendMax on subtraction rather than ignoring it', () => {
    // Silently ignoring it would deal the full 3–20 deck under a "up to 10"
    // chip, which is the same class of mistake in the other direction.
    expect(() => generate({ op: OPS.SUB, max: 10, addendMax: 10 }, seeded(1))).toThrow(/subtraction has no addends/)
  })

  it('refuses an unknown op from cardSpace too', () => {
    expect(() => cardSpace('times')).toThrow(/unknown op/)
    expect(() => cardSpace({ op: 'times' })).toThrow(/unknown op/)
  })
})

// ─── "up to 10", which is not the same constraint twice ──────────────────────
//
// The owner: "can we add a practice option to do it up to 10. So highest for
// addition would be 10+10 and highest for subtraction 10-10". Everything below
// is written from THAT sentence and from PLAN's block predicates, never from the
// engine — the counts are enumerated here in PLAN's own words, exactly as the
// 44/109/36 and 44/54/36 blocks above are.

const ADD10 = { op: OPS.ADD, max: MAX, addendMax: 10 }
const SUB10 = { op: OPS.SUB, max: 10 }

const ADD10_DECKS = SEEDS.map((seed) => generate(ADD10, seeded(seed)))
const SUB10_DECKS = SEEDS.map((seed) => generate(SUB10, seeded(seed)))

describe('the addition card space at addendMax 10', () => {
  const space = cardSpace(ADD10)

  it('tops out at 10 + 10, which is what the owner asked for', () => {
    expect(space.some((card) => card.left === 10 && card.right === 10 && card.answer === 20)).toBe(true)
    expect(Math.max(...space.map((card) => card.answer))).toBe(20)
  })

  it('obeys 1 <= a <= 10 · 1 <= b <= 10 · 3 <= a+b <= 20, and zero never appears', () => {
    for (const card of space) {
      const { left: a, right: b } = card

      expect(a, `a in ${a}+${b}`).toBeGreaterThanOrEqual(1)
      expect(a).toBeLessThanOrEqual(10)
      expect(b).toBeGreaterThanOrEqual(1)
      expect(b).toBeLessThanOrEqual(10)
      expect(a + b).toBeGreaterThanOrEqual(3)
      expect(a + b).toBeLessThanOrEqual(MAX)
      expect(card.answer).toBe(a + b)
    }

    expect(space.some((card) => card.left === 0 || card.right === 0 || card.answer === 0)).toBe(false)
  })

  it('is 99 ordered cards and partitions into A 44 / B 19 / C 36', () => {
    // Worked out from PLAN 4.2's three predicates against the new bounds, and
    // re-stated in PLAN's words rather than read off the engine:
    //
    //   ordered pairs with 1 <= a,b <= 10        100
    //   minus the one with a+b < 3, namely 1+1     1   =  99
    //
    //   A  a+b <= 10                    sum_{s=3..10}(s-1)          = 44
    //   B  a+b >= 11 and max >= 10      a = 10 or b = 10, so 10+10-1 = 19
    //   C  a+b >= 11 and max <= 9       81 - 45                     = 36
    const within = space.filter((card) => card.left + card.right <= 10)
    const teen = space.filter((card) => card.left + card.right >= 11 && Math.max(card.left, card.right) >= 10)
    const bridging = space.filter((card) => card.left + card.right >= 11 && Math.max(card.left, card.right) <= 9)

    expect(within).toHaveLength(44)
    expect(teen).toHaveLength(19)
    expect(bridging).toHaveLength(36)
    expect(within.length + teen.length + bridging.length).toBe(99)
    expect(space).toHaveLength(99)

    for (const card of within) expect(card.block, `${card.left}+${card.right}`).toBe(BLOCKS.A)
    for (const card of teen) expect(card.block, `${card.left}+${card.right}`).toBe(BLOCKS.B)
    for (const card of bridging) expect(card.block, `${card.left}+${card.right}`).toBe(BLOCKS.C)
  })

  it('makes block B exactly the cards where one addend is 10', () => {
    // "max >= 10" and "max <= 10" together leave only "max === 10", so PLAN
    // 4.2's teen block becomes the nineteen `n + 10` facts — which is also
    // precisely what its reserved slot 6 asks for.
    const teen = space.filter((card) => card.block === BLOCKS.B)

    expect(teen.every((card) => card.left === 10 || card.right === 10)).toBe(true)
    expect(space.filter((card) => card.left === 10 || card.right === 10)).toHaveLength(19)
  })

  it('leaves blocks A and C exactly as the to20 deck has them', () => {
    // Neither block ever used an addend above nine, so a cap of ten cannot touch
    // either. Block B is the whole of the difference: 109 cards down to 19.
    const named = (space_, block) =>
      space_
        .filter((card) => card.block === block)
        .map((card) => `${card.left}+${card.right}`)
        .sort()

    const to20 = cardSpace(OPS.ADD)

    expect(named(space, BLOCKS.A)).toEqual(named(to20, BLOCKS.A))
    expect(named(space, BLOCKS.C)).toEqual(named(to20, BLOCKS.C))
    expect(named(space, BLOCKS.B)).not.toEqual(named(to20, BLOCKS.B))
  })

  it('defaults addendMax to the bound the loops always had', () => {
    // 1 <= a,b and a+b <= 20 already meant neither addend could reach 20, so
    // `max - 1` is the old behaviour written down rather than a chosen value.
    // This is what makes to20 unchanged.
    expect(cardSpace({ op: OPS.ADD })).toEqual(cardSpace({ op: OPS.ADD, addendMax: MAX - 1 }))
    expect(cardSpace({ op: OPS.ADD })).toHaveLength(189)
  })
})

describe('the subtraction card space at max 10', () => {
  const space = cardSpace(SUB10)

  it('is 44 cards and partitions into A 44 / B 0 / C 0', () => {
    const small = space.filter((card) => card.left <= 10)
    const teen = space.filter((card) => card.left >= 11 && card.answer >= 10)
    const bridging = space.filter((card) => card.left >= 11 && card.answer <= 9)

    expect(small).toHaveLength(44)
    expect(teen).toHaveLength(0)
    expect(bridging).toHaveLength(0)
    expect(space).toHaveLength(44)

    // The same 44 cards block A has always had — `max` only ever removed the
    // minuends above it, and block A was defined as the ones at or below ten.
    expect(small.map((card) => `${card.left}-${card.right}`).sort()).toEqual(
      cardSpace(OPS.SUB)
        .filter((card) => card.block === BLOCKS.A)
        .map((card) => `${card.left}-${card.right}`)
        .sort()
    )
  })

  it('is empty in B and C because both need a minuend of at least 11', () => {
    // Not a coincidence to be tolerated — the reason. B is "m >= 11 and answer
    // >= 10" and C is "m >= 11 and answer <= 9"; both open with m >= 11, and the
    // biggest minuend here is 10.
    expect(Math.max(...space.map((card) => card.left))).toBe(10)
    expect(space.some((card) => card.block !== BLOCKS.A)).toBe(false)
  })

  it('tops out at 10 − 1 = 9 and never reaches zero', () => {
    // THE JUDGEMENT CALL, so it fails loudly if anyone changes their mind:
    // the owner wrote "10-10", which is zero, and PLAN 4.3 excludes a zero
    // answer everywhere ("a rule to be told, not a fact to be recalled", and a
    // big 0 in the answer box reads as "nothing" exactly like the empty ?). So
    // "10-10" is read as naming the RANGE. The minuend of ten is here; the card
    // 10 − 10 is not.
    expect(space.some((card) => card.left === 10)).toBe(true)
    expect(space.some((card) => card.left === 10 && card.right === 10)).toBe(false)
    expect(Math.max(...space.map((card) => card.answer))).toBe(9)
    expect(Math.min(...space.map((card) => card.answer))).toBe(1)
    expect(space.some((card) => card.answer === 0)).toBe(false)
  })

  it('still contains the hardest subtrahend there is, 10 − 9', () => {
    // One card in forty-four. It matters below: PLAN 4.3 reserves slot 12 for a
    // subtrahend of nine, and this is the only card that could ever fill it.
    expect(space.filter((card) => card.right === 9)).toHaveLength(1)
    expect(space.find((card) => card.right === 9)).toMatchObject({ left: 10, right: 9, answer: 1 })
  })
})

describe.each([
  ['addition up to 10', ADD10, ADD10_DECKS, 'AAAAAABBBBBBCCCCCC'],
  ['subtraction up to 10', SUB10, SUB10_DECKS, 'AAAAAAAAAAAAAAAAAA'],
])('%s deals a playable 18-card deck', (_name, params, decks, sections) => {
  it('is 18 cards, in the sections its blocks can actually fill', () => {
    for (const deck of decks) {
      expect(deck).toHaveLength(DECK_SIZE)
      expect(deck.map((card) => card.meta.block).join('')).toBe(sections)
      expect(deck.every((card) => card.meta.op === params.op)).toBe(true)
    }
  })

  it('never repeats a card inside a deck', () => {
    // Load-bearing in a way it was not before: subtraction at 10 draws all three
    // sections from ONE pool, so nothing but the `taken` set stops a card being
    // dealt twice. The card id is also the React key (PLAN 2.1).
    for (const deck of decks) {
      expect(new Set(deck.map((card) => card.id)).size).toBe(DECK_SIZE)
    }
  })

  it('never puts the same answer on two cards in a row', () => {
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

  it(`still never does, over ${SWEEP} contiguous seeds`, () => {
    // Same sweep, same reason as the to20 decks: eighteen cards drawn from as
    // few as nine distinct answers repeat one constantly, so the fix-up pass is
    // doing real work on every deck and a 200-seed sample would not be evidence.
    const failures = []

    for (let seed = 1; seed <= SWEEP; seed++) {
      const deck = generate(params, seeded(seed))

      for (let index = 1; index < deck.length; index++) {
        if (deck[index].answer === deck[index - 1].answer) {
          failures.push(`seed ${seed} at slot ${index} (${deck[index].prompt.text} answers ${deck[index].answer} too)`)
        }
      }
    }

    expect(
      failures.slice(0, 10),
      `${failures.length} repeated answers across ${SWEEP} decks — first ten shown`
    ).toEqual([])
  })

  it('never deals the same card twice, over the same sweep', () => {
    const failures = []

    for (let seed = 1; seed <= SWEEP; seed++) {
      const deck = generate(params, seeded(seed))
      if (new Set(deck.map((card) => card.id)).size !== DECK_SIZE) failures.push(`seed ${seed}`)
    }

    expect(failures.slice(0, 10), `${failures.length} decks with a duplicate card`).toEqual([])
  })

  it('deals the same deck twice from the same seed, and different decks from different seeds', () => {
    expect(generate(params, seeded(SEEDS[0]))).toEqual(generate(params, seeded(SEEDS[0])))

    const shapes = new Set(decks.map((deck) => deck.map((card) => card.id).join(' ')))
    expect(shapes.size).toBeGreaterThan(SEEDS.length / 2)
  })

  it('never reaches for Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('the arithmetic engine called Math.random — engines take rng last (PLAN 2.2 rule 3)')
    })

    try {
      expect(() => generate(params, seeded(SEEDS[0]))).not.toThrow()
    } finally {
      random.mockRestore()
    }
  })

  it('caps a section at two cards with the same answer', () => {
    for (const deck of decks) {
      for (let start = 0; start < DECK_SIZE; start += BLOCK_SIZE) {
        const counts = new Map()

        for (const card of deck.slice(start, start + BLOCK_SIZE)) {
          counts.set(card.answer, (counts.get(card.answer) ?? 0) + 1)
        }

        expect(Math.max(...counts.values()), `section at ${start}`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('never writes a zero and never asks for one', () => {
    for (const deck of decks) {
      for (const card of deck) {
        const [first, second] = operands(card)

        expect(first, card.prompt.text).toBeGreaterThan(0)
        expect(second).toBeGreaterThan(0)
        expect(card.answer).toBeGreaterThan(0)
      }
    }
  })
})

describe('addition up to 10 — the deck', () => {
  it('never writes an operand above 10, and does reach 10 + 10', () => {
    for (const deck of ADD10_DECKS) {
      for (const card of deck) {
        for (const value of operands(card)) {
          expect(value, card.prompt.text).toBeLessThanOrEqual(10)
        }
      }
    }

    expect(
      ADD10_DECKS.flat().some((card) => card.id === 'ADD-10-10'),
      'no deck in 200 seeds dealt the card the owner actually named'
    ).toBe(true)
  })

  it('keeps all three reserved slots, because all three blocks have cards', () => {
    // PLAN 4.2 unchanged: index 4 a double <= 10, index 6 an addend of exactly
    // 10, index 12 a double >= 11.
    for (const deck of ADD10_DECKS) {
      const [a4, b4] = operands(deck[4])
      expect(a4, deck[4].prompt.text).toBe(b4)
      expect(a4 + b4).toBeLessThanOrEqual(10)

      const [a6, b6] = operands(deck[6])
      expect(a6 === 10 || b6 === 10, deck[6].prompt.text).toBe(true)

      const [a12, b12] = operands(deck[12])
      expect(a12, deck[12].prompt.text).toBe(b12)
      expect(a12 + b12).toBeGreaterThanOrEqual(11)
    }
  })

  it('still renders block B larger-first at 6–9 and smaller-first at 10–11', () => {
    // The rule survives the smaller block B: every B card here is `n + 10`, so
    // larger-first is "10 leads" and she still meets the flipped form only after
    // four count-on reps.
    for (const deck of ADD10_DECKS) {
      for (const index of [6, 7, 8, 9]) {
        const [first, second] = operands(deck[index])
        expect(first, `${deck[index].prompt.text} at ${index}`).toBeGreaterThanOrEqual(second)
        expect(first).toBe(10)
      }

      for (const index of [10, 11]) {
        const [first, second] = operands(deck[index])
        expect(first, `${deck[index].prompt.text} at ${index}`).toBeLessThanOrEqual(second)
        expect(second).toBe(10)
      }
    }
  })

  it('takes at most one card per unordered pair', () => {
    for (const deck of ADD10_DECKS) {
      const pairs = deck.map((card) => operands(card).sort((x, y) => x - y).join('+'))
      expect(new Set(pairs).size).toBe(DECK_SIZE)
    }
  })
})

describe('subtraction up to 10 — the two blocks that are not there', () => {
  it('deals, where it used to throw', () => {
    // Recorded because it is the whole of the work. Before this option existed,
    // `generate({ op:'sub', max:10 })` threw at the ceiling guard, and with that
    // guard relaxed it threw one step later:
    //
    //   RangeError: arithmetic drawBlock(): no card in this block is an answer
    //   of exactly 10.
    //
    // PLAN 4.3 reserves slot 11 for a block B card and slot 12 for a block C
    // card, and at max 10 neither block exists.
    expect(() => generate(SUB10, seeded(1))).not.toThrow()
    expect(generate(SUB10, seeded(1))).toHaveLength(DECK_SIZE)
  })

  it('draws all eighteen cards from block A, the only block with any', () => {
    for (const deck of SUB10_DECKS) {
      for (const card of deck) {
        const [m] = operands(card)

        expect(card.meta.block, card.prompt.text).toBe(BLOCKS.A)
        expect(m).toBeLessThanOrEqual(10)
        expect(m).toBeGreaterThanOrEqual(3)
        expect(card.answer).toBeLessThanOrEqual(9)
        expect(card.answer).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('keeps slot 5 — a minuend of exactly 10 — because block A is still there', () => {
    // The one reserved slot that survives, and it is the one worth keeping: it
    // guarantees she meets "take away from ten" in every session.
    for (const deck of SUB10_DECKS) {
      expect(operands(deck[5])[0], deck[5].prompt.text).toBe(10)
    }
  })

  it('pins nothing at all in the two sections whose reserved slots were dropped', () => {
    // Slot 11 wants an answer of exactly 10 (block B) and slot 12 a subtrahend
    // of 9 (block C). Neither block is here, so both guarantees are dropped —
    // and dropped means dropped, not quietly handed to the block that inherited
    // the section. Retargeting is the tempting version and it is the worst one
    // available: exactly ONE card in the whole space has a subtrahend of nine
    // (10 − 9), so slot 12 would hold the same card in every session she ever
    // played; and no card at all has an answer of ten, so slot 11 would throw.
    //
    // What "dropped" looks like from outside is that NOTHING in slots 6–17 is
    // constant. Checked on all three of a card's visible facts, because a
    // retargeted predicate pins one of them and leaves the other two roaming:
    // `left === 10` would pin the minuend, `right === 9` the subtrahend,
    // `answer === n` the answer.
    for (let slot = BLOCK_SIZE; slot < DECK_SIZE; slot++) {
      for (const [what, of] of [
        ['minuend', (card) => operands(card)[0]],
        ['subtrahend', (card) => operands(card)[1]],
        ['answer', (card) => card.answer],
      ]) {
        const seen = new Set(SUB10_DECKS.map((deck) => of(deck[slot])))

        expect(seen.size, `slot ${slot} is pinned to a ${what} of ${[...seen]}`).toBeGreaterThan(1)
      }
    }

    // Slot 5, in the section block A still owns, is pinned — that one survived.
    expect(new Set(SUB10_DECKS.map((deck) => operands(deck[5])[0]))).toEqual(new Set([10]))

    // And she still meets 10 − 9 sometimes: it is one card in forty-four, drawn
    // like any other rather than banished.
    expect(SUB10_DECKS.flat().some((card) => card.id === 'SUB-10-9')).toBe(true)
  })

  it('never lets a hyphen in, and never renders a minuend it does not have', () => {
    for (const deck of SUB10_DECKS) {
      for (const card of deck) {
        expect(card.prompt.text).toContain(MINUS)
        expect(card.prompt.text).not.toContain('-')
        expect(card.answer).toBe(operands(card)[0] - operands(card)[1])
      }
    }
  })
})

// ─── the to20 decks did not move ─────────────────────────────────────────────

describe('adding to10 did not disturb the to20 decks (PLAN 2.2, the version rule)', () => {
  /**
   * The whole reason `version` stayed at 1.
   *
   * These six arrays were dealt by the engine as it stood BEFORE `addendMax`,
   * `sectionPlan` and the second option existed, and were checked card for card
   * against the engine as it stands now over seeds 1…5000 for both ops — 10000
   * decks, every field identical. Three of them are pinned here so the guarantee
   * outlives that one-off comparison: `ADD::to20::v1` and `SUB::to20::v1` are
   * live high-score keys on her phone (PLAN 2.6), and a deck that quietly
   * changed shape would make every best she has incomparable without anything
   * saying so.
   *
   * This is a golden fixture and it is meant to be brittle. If it fails, the
   * question is not "what should these arrays be now" — it is whether the deck
   * recipe changed, and if it genuinely did, whether `version` must be bumped.
   */
  const GOLDEN = {
    [OPS.ADD]: {
      1: ['ADD-2-1', 'ADD-6-1', 'ADD-2-6', 'ADD-5-5', 'ADD-4-4', 'ADD-4-6', 'ADD-10-5', 'ADD-14-2', 'ADD-19-1', 'ADD-17-1', 'ADD-3-17', 'ADD-3-12', 'ADD-7-7', 'ADD-6-6', 'ADD-2-9', 'ADD-8-8', 'ADD-9-6', 'ADD-4-7'],
      2: ['ADD-7-2', 'ADD-3-7', 'ADD-8-1', 'ADD-1-9', 'ADD-4-4', 'ADD-4-2', 'ADD-10-8', 'ADD-14-3', 'ADD-10-2', 'ADD-10-7', 'ADD-4-14', 'ADD-1-15', 'ADD-9-9', 'ADD-3-9', 'ADD-8-3', 'ADD-4-9', 'ADD-9-8', 'ADD-7-4'],
      3: ['ADD-2-6', 'ADD-2-5', 'ADD-6-3', 'ADD-2-1', 'ADD-4-4', 'ADD-4-1', 'ADD-10-2', 'ADD-17-3', 'ADD-14-1', 'ADD-10-7', 'ADD-5-15', 'ADD-6-11', 'ADD-8-8', 'ADD-8-7', 'ADD-2-9', 'ADD-5-9', 'ADD-9-8', 'ADD-9-4'],
    },
    [OPS.SUB]: {
      1: ['SUB-6-4', 'SUB-10-7', 'SUB-8-4', 'SUB-3-1', 'SUB-10-9', 'SUB-10-6', 'SUB-15-4', 'SUB-15-1', 'SUB-14-2', 'SUB-17-6', 'SUB-17-2', 'SUB-15-5', 'SUB-13-9', 'SUB-13-8', 'SUB-13-5', 'SUB-15-8', 'SUB-11-8', 'SUB-11-3'],
      2: ['SUB-10-4', 'SUB-6-5', 'SUB-9-2', 'SUB-6-3', 'SUB-8-6', 'SUB-10-7', 'SUB-14-1', 'SUB-15-1', 'SUB-20-1', 'SUB-17-3', 'SUB-18-2', 'SUB-18-8', 'SUB-18-9', 'SUB-11-7', 'SUB-11-4', 'SUB-11-3', 'SUB-16-9', 'SUB-12-3'],
      3: ['SUB-3-2', 'SUB-9-6', 'SUB-4-3', 'SUB-8-1', 'SUB-8-4', 'SUB-10-7', 'SUB-20-1', 'SUB-20-4', 'SUB-13-3', 'SUB-17-6', 'SUB-19-5', 'SUB-12-2', 'SUB-15-9', 'SUB-12-4', 'SUB-13-7', 'SUB-11-2', 'SUB-16-8', 'SUB-16-7'],
    },
  }

  it.each([
    [OPS.ADD, 1],
    [OPS.ADD, 2],
    [OPS.ADD, 3],
    [OPS.SUB, 1],
    [OPS.SUB, 2],
    [OPS.SUB, 3],
  ])('%s to20, seed %d, is the deck it has always been', (op, seed) => {
    expect(generate(PARAMS[op], seeded(seed)).map((card) => card.id)).toEqual(GOLDEN[op][seed])
  })

  it('still deals the same to20 deck whether or not addendMax is spelled out', () => {
    // `addendMax` defaults to `MAX - 1`, which is the bound the loops always
    // had, so writing it changes nothing. The manifest omits it for to20.
    expect(generate({ op: OPS.ADD, max: MAX, addendMax: MAX - 1 }, seeded(7))).toEqual(
      generate({ op: OPS.ADD, max: MAX }, seeded(7))
    )
  })
})
