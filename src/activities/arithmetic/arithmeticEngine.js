/**
 * Arithmetic — the engine. (PLAN 2.2, PLAN 4.2, PLAN 4.3)
 *
 * `generate(params, rng) => Question[]`: pure, `rng` last, no React, no storage,
 * no idea what a session is. **One engine, two activities.** `ADD` and `SUB` are
 * separate activities with separate high scores, and they are told apart by
 * `params.op` — which is exactly what PLAN 2.2 rule 2 means by "opaque to
 * everything except this activity's `generate`". The dispatch is allowed to live
 * here because here is inside the folder.
 *
 * ── THE TWO CARD SPACES ─────────────────────────────────────────────────────
 *
 * PLAN 4.2, addition. "Numbers from 3 to 20" is the range of the **SUM**, not of
 * every operand — reading it as "every operand >= 3" would delete every `+1` and
 * `+2` fact, which are the first facts a six-year-old must be fluent in.
 *
 *     1 <= a <= 19 · 1 <= b <= 19 · 3 <= a+b <= 20 · answer = a+b
 *     0 never appears.        189 ordered cards.
 *
 *     A  within ten    a+b <= 10                 44   count-on, no bridging
 *     B  teen + small  a+b >= 11 and max >= 10   109  ones-column only (13+4)
 *     C  bridging ten  a+b >= 11 and max <= 9    36   make-ten (8+5 = 8+2+3)
 *
 * PLAN 4.3, subtraction. Same reading: 3–20 is the **minuend**. The subtrahend is
 * capped at 9, because subtracting a two-digit number is a later skill that needs
 * partitioning.
 *
 *     3 <= m <= 20 · 1 <= s <= 9 · s <= m-1 · answer = m-s, so 1 <= answer <= 19
 *     0 never appears, and the answer is never negative.   134 cards.
 *
 *     A  m <= 10                      44
 *     B  m >= 11 and answer >= 10     54   (PLAN's worked `17 - 4` lives here)
 *     C  m >= 11 and answer <= 9      36
 *
 * Those six counts are the whole proof that the block predicates are right, and
 * `arithmeticEngine.test.js` asserts every one of them by enumeration.
 *
 * ── THE TRAP, WHICH IS THE MOST LIKELY BUG IN THIS FILE ─────────────────────
 *
 * PLAN 4.3 names it: **block C thins out at the top.** Available C cards per
 * minuend are `{11:8, 12:7, 13:6, 14:5, 15:4, 16:3, 17:2, 18:1, 19:0, 20:0}` —
 * minuends 19 and 20 have NO bridging card at `s <= 9`, because the smallest
 * answer they can reach is 10 and 11. "A sampler that assumes every minuend can
 * produce a C card loops forever."
 *
 * The defence here is structural rather than careful: **nothing in this file ever
 * samples a minuend and then looks for a subtrahend to go with it.** The entire
 * card space is enumerated once, partitioned by block, and every draw is a draw
 * from a finished list (`lib/rng.js`'s `sample`, which throws rather than
 * spinning if it is asked for more than exists). There is no rejection loop in
 * this engine at all, so there is nothing that *can* loop forever. Keep it that
 * way: the moment a draw becomes "pick a number, then find a partner", the trap
 * is back.
 *
 * WHAT THIS FILE MUST NOT LEARN: React, the score, the timer, or that an answer
 * box exists. It emits `Question` objects (PLAN 2.1) and stops.
 */

import { sample, shuffle } from '../../lib/rng'

/** Render family (PLAN 2.1). Read by tests and aria only — never dispatched on. */
export const KIND = 'EQUATION'

/**
 * The two recipes this folder deals. These strings live in `option.params.op`
 * and are **opaque to everything outside `activities/arithmetic/`** (PLAN 2.2
 * rule 2). The manifest spells them by hand rather than importing them — a
 * manifest is loaded eagerly and an import from here would drag the engine into
 * the first chunk — and `registry.test.js` deals every option of every activity
 * through the real engine, so a typo fails there instead of on her phone.
 */
export const OPS = Object.freeze({ ADD: 'add', SUB: 'sub' })

/**
 * **U+2212 MINUS SIGN, not a hyphen** (PLAN 4.3). At 44px the difference is
 * obvious: a hyphen is a short, high tick and the minus is a full-width bar on
 * the maths axis, so a hyphen reads as a dash between two numbers rather than as
 * an instruction to take one away.
 *
 * Written as an escape on purpose. A literal `−` in source survives a UTF-8
 * round trip perfectly well until one editor, one `git config` or one paste
 * through a Windows console silently rewrites it as `-`, and the failure would
 * be invisible in review — the two characters look nearly identical in a
 * monospace font. `−` cannot be mangled by anything that can still parse
 * JavaScript, and the test asserts the code point.
 */
export const MINUS = '\u2212'
export const PLUS = '+'
export const EQUALS = '='

/** The three blocks, in the order she meets them (PLAN 4.2). */
export const BLOCKS = Object.freeze({ A: 'A', B: 'B', C: 'C' })
export const BLOCK_ORDER = Object.freeze([BLOCKS.A, BLOCKS.B, BLOCKS.C])

/** "Deck = 6 A, then 6 B, then 6 C, in that order." (PLAN 4.2) */
export const BLOCK_SIZE = 6
export const DECK_SIZE = BLOCK_ORDER.length * BLOCK_SIZE

/**
 * The only ceiling either recipe is written for. Both PLAN 4.2 and PLAN 4.3
 * specify one deck each — "up to 20" — and every number below (the 189/134 card
 * spaces, the three block sizes, the reserved slots) is a fact about *that*
 * deck. `generate` therefore refuses any other ceiling rather than dealing
 * something approximate, exactly as the roman engine refuses a max it has no
 * template for: an option that advertises a deck the engine cannot deal is a
 * personal best out of the wrong denominator.
 */
export const MAX = 20

/**
 * "Within ten" is the boundary between count-on and bridging, and it is a fact
 * about how a six-year-old is taught rather than a fraction of MAX. Named so
 * that a `10` in a block predicate cannot be read as an arbitrary constant.
 */
const TEN = 10

/** PLAN 4.3: "Subtrahend capped at 9". This is what makes block C thin out. */
const MAX_SUBTRAHEND = 9

/**
 * How many cards in one block may share an answer.
 *
 * Not in PLAN — an implementation decision, and the reason it is here rather
 * than left to chance is the fix-up pass below. PLAN 4.2 asks that no two
 * *adjacent* cards share an answer, and a swap-based repair can only deliver
 * that if the block is repairable at all: six cards that all answered 20 cannot
 * be arranged so that no two of them are neighbours, and a repair pass faced
 * with that either loops, throws in her face, or gives up silently.
 *
 * Capping an answer at two per block makes an unrepairable block impossible (any
 * multiset of six with no answer appearing more than three times can be laid out
 * with no two alike adjacent), and it costs nothing: every block has at least
 * eight distinct answers available, so the cap never empties a pool.
 *
 * It does not make the fix-up pass decoration either. Six cards drawn from eight
 * to ten possible answers repeat one almost every time — measured over a
 * thousand decks, 998 of them held a duplicated answer inside some block — and a
 * duplicate lands next to itself often enough that the pass is doing real work
 * on a real deck rather than waiting for a case that never comes.
 */
const MAX_PER_ANSWER = 2

/**
 * Loud, not silent — the same guard both other engines use, for the same reason:
 * a forgotten generator otherwise surfaces as "rng is not a function" from
 * inside a shuffle three frames later.
 *
 * @param {unknown} rng
 * @param {string} caller
 */
function assertRng(rng, caller) {
  if (typeof rng !== 'function') {
    throw new TypeError(`${caller}(): needs an rng function — see lib/rng.js (PLAN 2.2 rule 3)`)
  }
}

/**
 * One fact of the card space: the two numbers, what they make, and which block
 * they belong to.
 *
 * `left` and `right` are the operands **as the arithmetic states them**, not as
 * they are rendered. For subtraction that is the whole story (`m - s` is not
 * reorderable). For addition the pool holds each unordered pair once with
 * `left <= right`, and which of the two goes first is decided at render time by
 * the slot the card lands in — see `rendersSmallerFirst`.
 *
 * @typedef {Object} Fact
 * @property {number} left
 * @property {number} right
 * @property {number} answer
 * @property {string} block
 */
const fact = (left, right, answer, block) => Object.freeze({ left, right, answer, block })

/**
 * Which block an addition fact belongs to. (PLAN 4.2's table.)
 *
 * @param {number} a
 * @param {number} b
 * @returns {string}
 */
function additionBlock(a, b) {
  if (a + b <= TEN) return BLOCKS.A
  return Math.max(a, b) >= TEN ? BLOCKS.B : BLOCKS.C
}

/**
 * Which block a subtraction fact belongs to. (PLAN 4.3's table.)
 *
 * @param {number} m
 * @param {number} s
 * @returns {string}
 */
function subtractionBlock(m, s) {
  if (m <= TEN) return BLOCKS.A
  return m - s >= TEN ? BLOCKS.B : BLOCKS.C
}

/**
 * Every addition card there is: 189 of them at max 20, ordered, so `13+4` and
 * `4+13` are both here. (They are genuinely different problems at this age —
 * one is count-on-from-larger, the other requires first noticing you should
 * flip it — but a deck takes at most one card per unordered pair.)
 *
 * @param {number} [max]
 * @returns {Fact[]}
 */
function additionSpace(max = MAX) {
  const cards = []

  for (let a = 1; a <= max - 1; a++) {
    for (let b = 1; b <= max - 1; b++) {
      const sum = a + b
      // 3 <= a+b <= max. Zero cannot appear: both loops start at 1, because
      // Number Bonds already drills `0 + n` and `n + 0` teaches nothing.
      if (sum < 3 || sum > max) continue

      cards.push(fact(a, b, sum, additionBlock(a, b)))
    }
  }

  return cards
}

/**
 * Every subtraction card there is: 134 of them at max 20.
 *
 * The `s <= m - 1` bound is what excludes `n - n = 0`: PLAN 4.3 rules it out
 * because it is a rule to be told rather than a fact to be recalled, and because
 * the answer box shows `?` when empty and a big `0` when answered, and both read
 * as "nothing" to a child.
 *
 * @param {number} [max]
 * @returns {Fact[]}
 */
function subtractionSpace(max = MAX) {
  const cards = []

  for (let m = 3; m <= max; m++) {
    for (let s = 1; s <= MAX_SUBTRAHEND; s++) {
      if (s > m - 1) continue

      cards.push(fact(m, s, m - s, subtractionBlock(m, s)))
    }
  }

  return cards
}

/**
 * The reserved slots, by absolute deck index. (PLAN 4.2 and PLAN 4.3.)
 *
 * > Reserved slots guarantee coverage: index 4 a double <= 10, index 6 a fact
 * > with an addend of exactly 10, index 12 a double >= 11.
 *
 * > Reserved: index 5 `m === 10`, index 11 `answer === 10`, index 12 `s === 9`.
 *
 * Each predicate is applied to its own block's pool, so "a double <= 10" is
 * `isDouble` filtered through block A and needs no second condition. Every one
 * of these leaves at least four candidates, and `sample` throws rather than
 * spinning if a future edit ever leaves none.
 */
const isDouble = (candidate) => candidate.left === candidate.right

const RECIPES = Object.freeze({
  [OPS.ADD]: Object.freeze({
    op: OPS.ADD,
    symbol: PLUS,
    space: additionSpace,
    /**
     * "a given unordered pair appears **at most once per deck**" (PLAN 4.2).
     * Structural rather than checked: the pool holds one entry per unordered
     * pair, so a deck of distinct pool entries is a deck of distinct pairs.
     */
    unordered: true,
    reserved: Object.freeze({
      [BLOCKS.A]: Object.freeze({ slot: 4, is: isDouble, what: 'a double within ten' }),
      [BLOCKS.B]: Object.freeze({
        slot: 6,
        is: (candidate) => candidate.left === TEN || candidate.right === TEN,
        what: 'a fact with an addend of exactly 10',
      }),
      [BLOCKS.C]: Object.freeze({ slot: 12, is: isDouble, what: 'a double over ten' }),
    }),
  }),

  [OPS.SUB]: Object.freeze({
    op: OPS.SUB,
    symbol: MINUS,
    space: subtractionSpace,
    /** `m - s` is not reorderable; there is no unordered pair to collapse. */
    unordered: false,
    reserved: Object.freeze({
      [BLOCKS.A]: Object.freeze({ slot: 5, is: (candidate) => candidate.left === TEN, what: 'a minuend of exactly 10' }),
      [BLOCKS.B]: Object.freeze({ slot: 11, is: (candidate) => candidate.answer === TEN, what: 'an answer of exactly 10' }),
      [BLOCKS.C]: Object.freeze({
        slot: 12,
        is: (candidate) => candidate.right === MAX_SUBTRAHEND,
        what: 'a subtrahend of exactly 9',
      }),
    }),
  }),
})

/** Where block `n` starts in the deck. */
const blockStart = (index) => index * BLOCK_SIZE

/** Which block a deck index falls in. Blocks are contiguous and equal-sized. */
const blockOfIndex = (index) => Math.floor(index / BLOCK_SIZE)

/** The first slot of block B, and the slot its orientation flips at (PLAN 4.2). */
const B_START = blockStart(BLOCK_ORDER.indexOf(BLOCKS.B))
const B_FLIPS_AT = B_START + 4

/**
 * Which way round an addition card is written in this slot.
 *
 * > Block B renders larger-first at indices 6–9 and smaller-first at 10–11, so
 * > she meets the flipped form only after four count-on reps.
 *
 * That rule is about block B and only block B, because block B is where the
 * flip is a different problem: `13 + 4` is count-on-from-larger, `4 + 13`
 * requires first noticing you should flip it. In blocks A and C both operands
 * are single digits, neither order is the "hard" one, and PLAN says nothing —
 * so it is a coin flip, which is also what stops every within-ten card in every
 * session being written the same way round.
 *
 * Subtraction never asks: `17 - 4` and `4 - 17` are not the same card.
 *
 * @param {number} index  Absolute deck index.
 * @param {() => number} rng
 * @returns {boolean}
 */
function rendersSmallerFirst(index, rng) {
  if (index >= B_START && index < B_FLIPS_AT) return false
  if (index >= B_FLIPS_AT && index < B_START + BLOCK_SIZE) return true

  return rng() < 0.5
}

/**
 * The card space, partitioned into the three blocks and reduced to what a deck
 * may draw from: for addition, one entry per unordered pair.
 *
 * @param {Object} recipe
 * @param {number} max
 * @returns {Record<string, Fact[]>}
 */
function poolsFor(recipe, max) {
  const space = recipe.space(max)
  const drawable = recipe.unordered ? space.filter((candidate) => candidate.left <= candidate.right) : space

  const pools = {}
  for (const block of BLOCK_ORDER) {
    pools[block] = drawable.filter((candidate) => candidate.block === block)
  }

  return pools
}

/**
 * Six facts for one block: the reserved one first, then five more, with no
 * answer used more than `MAX_PER_ANSWER` times.
 *
 * Drawing the reserved card FIRST is what makes "index 4 is always a double" a
 * property of every deck by construction rather than something a repair pass has
 * to go back and arrange. Nothing here is a rejection loop: every draw is a
 * `sample` from a finished, filtered list, so there is no way for this to spin
 * on a pool that cannot satisfy it (see the trap at the top of the file).
 *
 * @param {Fact[]} pool
 * @param {{ is: (fact: Fact) => boolean, what: string }} reserved
 * @param {() => number} rng
 * @returns {{ pinned: Fact, rest: Fact[] }}
 */
function drawBlock(pool, reserved, rng) {
  const eligible = pool.filter(reserved.is)

  if (eligible.length === 0) {
    throw new RangeError(
      `arithmetic drawBlock(): no card in this block is ${reserved.what}. ` +
        `A reserved slot that cannot be filled is a deck that does not cover what PLAN 4.2/4.3 says it covers.`
    )
  }

  const [pinned] = sample(eligible, 1, rng)

  const chosen = [pinned]
  const used = new Map([[pinned.answer, 1]])

  while (chosen.length < BLOCK_SIZE) {
    const candidates = pool.filter(
      (candidate) => !chosen.includes(candidate) && (used.get(candidate.answer) ?? 0) < MAX_PER_ANSWER
    )

    if (candidates.length === 0) {
      // Unreachable: every block has at least eight distinct answers and the cap
      // is two, so at least sixteen cards are always drawable. It stays because
      // the alternative to a sentence is `sample` throwing about an empty array.
      throw new RangeError(
        `arithmetic drawBlock(): ran out of cards for a block of ${BLOCK_SIZE} ` +
          `with at most ${MAX_PER_ANSWER} cards per answer.`
      )
    }

    const [next] = sample(candidates, 1, rng)

    chosen.push(next)
    used.set(next.answer, (used.get(next.answer) ?? 0) + 1)
  }

  return { pinned, rest: chosen.filter((candidate) => candidate !== pinned) }
}

/** How many neighbouring pairs in this arrangement share an answer. */
function adjacentClashes(cards) {
  let clashes = 0

  for (let index = 1; index < cards.length; index++) {
    if (cards[index].answer === cards[index - 1].answer) clashes += 1
  }

  return clashes
}

/**
 * The fix-up pass. (PLAN 4.2: "A final block-local fix-up pass prevents two
 * adjacent cards sharing an answer.")
 *
 * Two cards in a row that both answer 14 make the second one free: she reads the
 * first two numbers, recognises nothing, and types what she typed last time.
 * It is not a broken card, which is exactly why this is a *pass* over a laid-out
 * deck rather than a constraint on the draw — the deck is already correct when
 * this runs, and this only makes it teach better.
 *
 * **Block-local means the swaps are block-local, not the collisions.** A card
 * never leaves its block: the A → B → C progression is the point of the deck,
 * and the reserved slots would move with it. Collisions are looked for across
 * the whole deck, because the one that matters most is at the B/C seam — block B
 * and block C both answer 11 and up, so the boundary between slots 11 and 12 is
 * the only place two blocks can collide, and a strictly block-local *scan* would
 * be blind to precisely that.
 *
 * Every swap must **strictly reduce** the number of clashing neighbours, which
 * is what makes this terminate: the count is a non-negative integer that falls
 * by at least one each round.
 *
 * If a clash cannot be resolved it is **left alone**. Not a throw: the defect is
 * cosmetic and a throw here would put an error boundary in front of a
 * six-year-old over a repeated answer. The draw's `MAX_PER_ANSWER` cap is what
 * makes that outcome unreachable in practice, and the test asserts a clean deck
 * over two hundred seeds for both activities rather than trusting this note.
 *
 * @param {Fact[]} cards   The laid-out deck.
 * @param {Set<number>} pinned  Deck indices that may not move (the reserved slots).
 * @param {() => number} rng
 * @returns {Fact[]} a new array
 */
export function fixAdjacentAnswers(cards, pinned, rng) {
  assertRng(rng, 'fixAdjacentAnswers')

  let best = [...cards]
  let clashes = adjacentClashes(best)

  // At most one round per clash, since each round removes at least one.
  for (let round = 0; round < cards.length && clashes > 0; round++) {
    const at = best.findIndex((card, index) => index > 0 && card.answer === best[index - 1].answer)

    // Either side of the clash can be the one that moves; a reserved slot cannot.
    const movable = [at, at - 1].filter((index) => !pinned.has(index))
    let improved = null

    for (const from of movable) {
      const partners = shuffle(
        best
          .map((_, index) => index)
          .filter((index) => index !== from && !pinned.has(index) && blockOfIndex(index) === blockOfIndex(from)),
        rng
      )

      for (const to of partners) {
        const trial = [...best]
        ;[trial[from], trial[to]] = [trial[to], trial[from]]

        const after = adjacentClashes(trial)
        if (after < clashes) {
          improved = { trial, after }
          break
        }
      }

      if (improved) break
    }

    // Nothing helped. Leave the deck as it is — see the note above.
    if (!improved) break

    best = improved.trial
    clashes = improved.after
  }

  return best
}

/**
 * One card. (PLAN 2.1's worked example is `SUB-17-4`, and this is it.)
 *
 * ```js
 * { id:'SUB-17-4', kind:'EQUATION',
 *   prompt:{ terms:[{t:'num',v:17},{t:'op',v:'−'},{t:'num',v:4},{t:'op',v:'='}],
 *            text:'17 − 4 = ?' },
 *   answer:13, meta:{ block:'B' } }
 * ```
 *
 * The terms stop at the `=`. **The blank is always the result** — 100% of cards,
 * PLAN 4.2 — so there is nothing after the equals sign for the engine to
 * describe: the renderer puts the answer box there. Missing-addend is precisely
 * what Number Bonds already is, and keeping the unknown always immediately right
 * of `=` gives one stable visual grammar while she is still learning what `=`
 * means.
 *
 * @param {Object} recipe
 * @param {Fact} card
 * @param {number} index  Absolute deck index — it decides the orientation.
 * @param {() => number} rng
 * @returns {Object} a PLAN 2.1 Question
 */
function equationCard(recipe, card, index, rng) {
  // The addition pool holds `left <= right`, so "larger first" means writing
  // `right` first. Subtraction is never reordered — `17 - 4` and `4 - 17` are
  // different cards — and short-circuits before the rng is touched, so its deck
  // is not silently reshaped by adding an orientation to the other recipe.
  const smallerFirst = !recipe.unordered || rendersSmallerFirst(index, rng)
  const first = smallerFirst ? card.left : card.right
  const second = smallerFirst ? card.right : card.left

  const text = `${first} ${recipe.symbol} ${second} ${EQUALS} ?`

  return {
    // The rendered order, so the id names the card she actually sees. Unique
    // within a deck: subtraction draws distinct `(m, s)` cards, and addition
    // draws distinct unordered pairs.
    id: `${recipe.op.toUpperCase()}-${first}-${second}`,
    kind: KIND,
    prompt: {
      terms: [
        { t: 'num', v: first },
        { t: 'op', v: recipe.symbol },
        { t: 'num', v: second },
        { t: 'op', v: EQUALS },
      ],
      // What a screen reader gets, and the one place the card is stated in
      // words rather than as a row of boxes.
      text,
    },
    answer: card.answer,
    // Difficulty tags. Read by TESTS only, never rendered (PLAN 2.1) — the
    // shared registry test cannot check a stratification, so the block a card
    // came from has to be legible from the card. A fresh object per card: one
    // shared `meta` across a deck is invisible until something mutates it.
    meta: { op: recipe.op, block: card.block },
  }
}

/**
 * The activity entry point. (PLAN 2.2: `generate(params, rng) => Question[]`,
 * pure, `rng` last.)
 *
 * `params.op` and `params.max` are **opaque to everything outside this folder**
 * (PLAN 2.2 rule 2): the manifest writes them, this function reads them, and the
 * day a screen or the session reducer looks at either the contract has leaked.
 *
 * @param {{ op: string, max: number }} params
 * @param {() => number} rng
 * @returns {Object[]} 18 cards: 6 A, then 6 B, then 6 C.
 */
export function generate(params, rng) {
  assertRng(rng, 'arithmetic generate')

  const recipe = RECIPES[params?.op]

  if (recipe === undefined) {
    throw new TypeError(
      `arithmetic generate(): unknown params.op ${JSON.stringify(params?.op)}. ` +
        `Expected one of: ${Object.values(OPS).join(', ')}.`
    )
  }

  if (params?.max !== MAX) {
    throw new TypeError(
      `arithmetic generate(): this recipe is written for max ${MAX} and got ${JSON.stringify(params?.max)}. ` +
        `The card space, the three block sizes and the reserved slots are all facts about the 3–20 deck ` +
        `(PLAN 4.2, PLAN 4.3); a new ceiling is a new recipe, and a new option id with it.`
    )
  }

  const pools = poolsFor(recipe, MAX)

  const laid = new Array(DECK_SIZE)
  const pinned = new Set()

  BLOCK_ORDER.forEach((block, blockIndex) => {
    const start = blockStart(blockIndex)
    const reserved = recipe.reserved[block]
    const { pinned: reservedCard, rest } = drawBlock(pools[block], reserved, rng)

    const others = shuffle(rest, rng)
    let next = 0

    for (let slot = start; slot < start + BLOCK_SIZE; slot++) {
      laid[slot] = slot === reserved.slot ? reservedCard : others[next++]
    }

    pinned.add(reserved.slot)
  })

  return fixAdjacentAnswers(laid, pinned, rng).map((card, index) => equationCard(recipe, card, index, rng))
}

/**
 * The whole card space of one recipe, for tests.
 *
 * Exported because the three block sizes — 44/109/36 and 44/54/36 — are how you
 * know the block predicates are right, and a test that re-implemented the space
 * to count it would only be testing itself. Nothing in the app calls this;
 * `generate` uses the same two functions directly.
 *
 * @param {string} op
 * @param {number} [max]
 * @returns {Fact[]}
 */
export function cardSpace(op, max = MAX) {
  const recipe = RECIPES[op]

  if (recipe === undefined) {
    throw new TypeError(`cardSpace(): unknown op ${JSON.stringify(op)}. Expected one of: ${Object.values(OPS).join(', ')}.`)
  }

  return recipe.space(max)
}
