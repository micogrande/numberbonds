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
 * ── "UP TO 10" IS NOT ONE CONSTRAINT, IT IS TWO ─────────────────────────────
 *
 * The owner asked for "a practice option to do it up to 10. So highest for
 * addition would be 10+10 and highest for subtraction 10-10". Read against the
 * two spaces above, those halves are different constraints, and the difference
 * is the entire reason this file grew a second knob.
 *
 * SUBTRACTION is `max`, and needs nothing new. `subtractionSpace(max)` already
 * caps the MINUEND, so "up to 10" is `max: 10` and the top card is a minuend of
 * ten:
 *
 *     3 <= m <= 10 · 1 <= s <= 9 · s <= m-1       44 cards
 *     A  m <= 10   44        B  0        C  0
 *
 * ADDITION is NOT `max`. `additionSpace(max)` caps the SUM, so `max: 10` would
 * top out at 9 + 1 and could never deal 10 + 10. "Highest is 10+10" is a cap on
 * each ADDEND, with sums still reaching twenty — a genuinely different
 * constraint, and it is `addendMax`:
 *
 *     1 <= a <= 10 · 1 <= b <= 10 · 3 <= a+b <= 20     99 ordered cards
 *     A  within ten          a+b <= 10                 44
 *     B  one addend is 10    a+b >= 11 and max >= 10    19
 *     C  bridging ten        a+b >= 11 and max <= 9     36
 *
 * Block B is the whole of the difference: at `addendMax` 10 "one operand is at
 * least ten" can only mean "one operand is exactly ten", so B collapses from 109
 * cards to the nineteen `n + 10` facts. Blocks A and C are the same 44 and 36
 * cards as at `to20`, because neither ever used an addend above nine.
 *
 * `addendMax` defaults to `max - 1`, which is exactly what the loops always did,
 * so the `to20` deck is unchanged card for card and seed for seed. That is not a
 * nicety: `ADD::to20::v1` is a live high-score key (PLAN 2.6) and `version`
 * exists for exactly one purpose (PLAN 2.2) — to say old scores are no longer
 * comparable. Adding an option is not that, so the old deck may not move.
 *
 * ── AN EMPTY BLOCK, AND THE RESERVED SLOTS THAT NAMED IT ────────────────────
 *
 * Subtraction at max 10 has **no block B and no block C**: both require a
 * minuend of at least eleven. Before this option existed `generate` refused the
 * ceiling outright, and behind that guard `drawBlock` threw `RangeError: no card
 * in this block is an answer of exactly 10` — PLAN 4.3 reserves slot 11 for a
 * block B card and slot 12 for a block C card, and neither block is there.
 *
 * So the deck is three **sections** of six, and a section is *assigned* a block
 * rather than *being* one. Two rules, and nothing else changes:
 *
 *   1. A block with no cards hands its section to the last block before it that
 *      has any. Subtraction at 10 is therefore three sections drawn from block
 *      A, and the A -> B -> C direction is preserved because a section can only
 *      ever fall back to something she has already met, never forward.
 *   2. A reserved slot whose block is absent is DROPPED. A coverage guarantee
 *      about a block that does not exist guarantees nothing, and the alternative
 *      — retargeting it at whichever block took the slot over — invents a
 *      pedagogy PLAN does not state. Slot 5, "a minuend of exactly 10", survives
 *      because block A survives.
 *
 * Every other deck has all three blocks, so `sectionPlan` returns A, B, C and
 * all three reserved slots, and the layout is the one that shipped.
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
 * The ceiling PLAN 4.2 and PLAN 4.3 are written for: the SUM for addition, the
 * MINUEND for subtraction. Every number in those two sections (the 189/134 card
 * spaces, the three block sizes, the reserved slots) is a fact about the 3–20
 * deck, and `generate` refuses a ceiling it has no recipe for rather than
 * dealing something approximate — exactly as the roman engine refuses a max it
 * has no template for. An option that advertises a deck the engine cannot deal
 * is a personal best out of the wrong denominator.
 */
export const MAX = 20

/**
 * "Within ten" is the boundary between count-on and bridging, and it is a fact
 * about how a six-year-old is taught rather than a fraction of MAX. Named so
 * that a `10` in a block predicate cannot be read as an arbitrary constant.
 */
const TEN = 10

/**
 * The addend cap the `to20` deck has always had, and what an option that names
 * no cap gets. Not a chosen number: with both addends at least 1 and the sum
 * capped at 20, neither addend could ever reach 20, so `MAX - 1` is the old loop
 * bound written down. It is stated HERE and nowhere else — a second copy of it
 * (a default parameter on `additionSpace`, say) would be a place where the old
 * deck could quietly stop being the old deck.
 */
const DEFAULT_ADDEND_MAX = MAX - 1

/**
 * The ceilings this engine has a recipe for. Anything else is refused by
 * `generate`, with the reason.
 *
 * Addition's ceiling is on the ADDENDS and its sum cap never moves: `TEN` is the
 * owner's "highest is 10+10", `DEFAULT_ADDEND_MAX` is the `to20` deck. That
 * subtraction's ceiling is on the MINUEND — which is what `max` has always meant
 * here — is the whole asymmetry, and these two lists side by side are where it
 * is easiest to see.
 */
export const ADDEND_MAXES = Object.freeze([TEN, DEFAULT_ADDEND_MAX])
export const SUB_MAXES = Object.freeze([TEN, MAX])

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
 * Capping an answer at two per SECTION makes an unrepairable *section*
 * impossible (any multiset of six with no answer appearing more than three
 * times can be laid out with no two alike adjacent), and it costs nothing:
 * every pool a section draws from has at least eight distinct answers
 * available, so the cap never empties one. The tightest case is subtraction at
 * max 10, where all three sections share block A's 44 cards and only nine
 * distinct answers exist — the third section still sees at least seven of them
 * with cards left, which is fourteen drawable against a need for six.
 *
 * What the cap does NOT buy, and used to be credited with: a guarantee that the
 * fix-up pass always succeeds. Two blocks meet at a seam, one side of that seam
 * can be a reserved slot that may not move, and the cap says nothing about
 * either. That gap shipped a repeated answer once in about a thousand addition
 * decks until the pass learned to rearrange a whole block — see
 * `fixAdjacentAnswers`.
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
 * **Two caps, and they are not the same cap.** `max` is on the SUM, which is how
 * PLAN 4.2 reads "numbers from 3 to 20". `addendMax` is on each ADDEND, which is
 * how the owner's "highest would be 10+10" reads — 10 + 10 is a sum of twenty,
 * so capping the sum at ten cannot express it and capping the addends at ten
 * cannot be expressed by `max`.
 *
 * Both are REQUIRED. `DEFAULT_ADDEND_MAX` is the cap an option that names none
 * gets, and the recipe above resolves it — a default parameter here as well
 * would be a second, silent copy of the rule that keeps `ADD::to20::v1`
 * comparable, and the only thing worse than one place to change it is two.
 *
 * @param {number} max        Cap on a+b.
 * @param {number} addendMax  Cap on a and on b.
 * @returns {Fact[]}
 */
function additionSpace(max, addendMax) {
  const cards = []

  for (let a = 1; a <= addendMax; a++) {
    for (let b = 1; b <= addendMax; b++) {
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
 * Every subtraction card there is: 134 of them at max 20, 44 at max 10.
 *
 * `max` caps the MINUEND, which is already what "up to N" means here — so the
 * owner's "up to 10" needs nothing new from this function, only the ceiling. At
 * max 10 every card is a block A card and blocks B and C are empty; `generate`
 * deals with that rather than this function.
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
 * `isDouble` filtered through block A and needs no second condition. At every
 * ceiling this engine deals, each one that is still in play leaves at least four
 * candidates, and `sample` throws rather than spinning if a future edit ever
 * leaves none.
 *
 * A reserved slot whose BLOCK IS EMPTY is dropped rather than retargeted — see
 * `sectionPlan`. Subtraction at max 10 is the case: slots 11 and 12 name blocks
 * B and C, both of which need a minuend of at least eleven.
 */
const isDouble = (candidate) => candidate.left === candidate.right

/**
 * What each recipe's `params` may say, and what `generate` refuses.
 *
 * This is where the asymmetry in the owner's request lives, stated once. Both
 * decks are "up to 10" to her; underneath, one is a cap on the minuend and the
 * other a cap on the addends, and a reader of this table can see which is which
 * without knowing the rest of the file.
 *
 * `refuse` throws the TypeError itself so the message can name the actual
 * mistake rather than "bad params".
 *
 * @param {string} detail
 * @returns {never}
 */
function refuse(detail) {
  throw new TypeError(`arithmetic generate(): ${detail}`)
}

const RECIPES = Object.freeze({
  [OPS.ADD]: Object.freeze({
    op: OPS.ADD,
    symbol: PLUS,
    /**
     * Addition's sum cap never moves; the ceiling she picks caps the ADDENDS.
     * `max: 10` is refused loudly rather than honoured, because honouring it
     * would deal a deck whose top card is 9 + 1 under a label that promises
     * 10 + 10.
     *
     * @param {{ max: number, addendMax?: number }} params
     * @returns {Fact[]}
     */
    space(params) {
      if (params.max !== MAX) {
        refuse(
          `addition always sums to ${MAX} and got max ${JSON.stringify(params.max)}. ` +
            `"Up to 10" caps the ADDENDS, not the sum — 10 + 10 is 20 — so it is params.addendMax: ${TEN}.`
        )
      }

      const addendMax = params.addendMax ?? DEFAULT_ADDEND_MAX

      if (!ADDEND_MAXES.includes(addendMax)) {
        refuse(
          `no addition recipe for addendMax ${JSON.stringify(params.addendMax)}. ` +
            `Expected one of: ${ADDEND_MAXES.join(', ')} (omit it for the ${DEFAULT_ADDEND_MAX} the to20 deck has always used). ` +
            `A new ceiling is a new recipe, and a new option id with it (PLAN 2.2).`
        )
      }

      return additionSpace(MAX, addendMax)
    },
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
    /**
     * Subtraction's ceiling is the minuend, which is what `max` has always
     * meant here — so "up to 10" is `max: 10` and nothing else moves.
     *
     * @param {{ max: number, addendMax?: number }} params
     * @returns {Fact[]}
     */
    space(params) {
      if (params.addendMax !== undefined) {
        refuse(`subtraction has no addends, so params.addendMax means nothing here. Its ceiling is params.max.`)
      }

      if (!SUB_MAXES.includes(params.max)) {
        refuse(
          `no subtraction recipe for max ${JSON.stringify(params.max)}. Expected one of: ${SUB_MAXES.join(', ')}. ` +
            `The card space, the block sizes and the reserved slots are facts about a particular ceiling ` +
            `(PLAN 4.3); a new one is a new recipe, and a new option id with it (PLAN 2.2).`
        )
      }

      return subtractionSpace(params.max)
    },
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

/** Where section `n` starts in the deck. A section is one six-card group. */
const blockStart = (index) => index * BLOCK_SIZE

/** How many of block B's six slots render larger-first (PLAN 4.2's "6–9"). */
const B_LARGER_FIRST = 4

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
 * Asked of the CARD's block rather than of the raw index. Those were the same
 * question while every deck was A·B·C and block B always owned slots 6–11 —
 * both addition decks still are, so this is unchanged for either of them, and
 * `index % BLOCK_SIZE` is the slot's position inside its own section. The card
 * is what the rule is actually about, and a section plan that ever moved block B
 * would otherwise flip the wrong six cards in silence.
 *
 * Subtraction never asks: `17 - 4` and `4 - 17` are not the same card.
 *
 * @param {Fact} card
 * @param {number} index  Absolute deck index.
 * @param {() => number} rng
 * @returns {boolean}
 */
function rendersSmallerFirst(card, index, rng) {
  if (card.block !== BLOCKS.B) return rng() < 0.5

  return index % BLOCK_SIZE >= B_LARGER_FIRST
}

/**
 * The card space, partitioned into the three blocks and reduced to what a deck
 * may draw from: for addition, one entry per unordered pair.
 *
 * A pool may legitimately be EMPTY — subtraction at max 10 has no block B and no
 * block C — and `sectionPlan` is what decides who gets those six slots.
 *
 * @param {Object} recipe
 * @param {Fact[]} space
 * @returns {Record<string, Fact[]>}
 */
function poolsFor(recipe, space) {
  const drawable = recipe.unordered ? space.filter((candidate) => candidate.left <= candidate.right) : space

  const pools = {}
  for (const block of BLOCK_ORDER) {
    pools[block] = drawable.filter((candidate) => candidate.block === block)
  }

  return pools
}

/**
 * Which block each of the deck's three sections draws from, and which reserved
 * slot it still owes.
 *
 * Normally the answer is the boring one: section 0 is block A, section 1 is
 * block B, section 2 is block C, each with the reserved slot PLAN 4.2/4.3 gives
 * it, and the deck laid out here is the deck that shipped. The interesting case
 * is subtraction at max 10, where blocks B and C are empty because both need a
 * minuend of at least eleven.
 *
 * **A block with no cards hands its section to the last block before it that has
 * any.** Backwards, never forwards: a section may only fall back to something
 * she has already met this deck, so the A -> B -> C direction survives even when
 * two thirds of it is missing. Subtraction at 10 is therefore eighteen
 * within-ten cards in three sections, which is the honest shape of "up to 10" —
 * there is no bridging to grade up to when nothing crosses ten.
 *
 * **A reserved slot whose block is absent is dropped.** It is a coverage
 * guarantee about that block, and a guarantee about a block with no cards
 * guarantees nothing. The alternative — handing slot 12's "a subtrahend of
 * exactly 9" to whichever block inherited the section — sounds harmless and is
 * not: at max 10 exactly one card in the entire space has a subtrahend of nine
 * (10 − 9), so it would be pinned into every single session she ever plays.
 *
 * @param {Record<string, Fact[]>} pools
 * @param {Record<string, { slot: number, is: Function, what: string }>} reserved
 * @returns {{ block: string, reserved: Object|null }[]} one entry per section
 */
function sectionPlan(pools, reserved) {
  const first = BLOCK_ORDER.find((block) => pools[block].length > 0)

  if (first === undefined) {
    throw new RangeError(
      `arithmetic sectionPlan(): every block is empty, so there is no deck to deal. ` +
        `A ceiling with no cards at all is a recipe mistake, not a shortfall.`
    )
  }

  let fallback = first
  const plan = []

  BLOCK_ORDER.forEach((block, sectionIndex) => {
    if (pools[block].length === 0) {
      plan.push({ block: fallback, reserved: null })
      return
    }

    fallback = block

    const slot = reserved[block].slot
    const start = blockStart(sectionIndex)

    if (slot < start || slot >= start + BLOCK_SIZE) {
      // Cannot happen while a present block keeps its own position, which is the
      // rule above — only ABSENT blocks are reassigned. Loud anyway: a reserved
      // slot that landed in someone else's section would silently overwrite one
      // of their cards and leave a hole in this one.
      throw new RangeError(
        `arithmetic sectionPlan(): block ${block} reserves slot ${slot}, which is outside its own section ` +
          `(${start}…${start + BLOCK_SIZE - 1}).`
      )
    }

    plan.push({ block, reserved: reserved[block] })
  })

  return plan
}

/**
 * Six facts for one section: the reserved one first, then five more, with no
 * answer used more than `MAX_PER_ANSWER` times.
 *
 * Drawing the reserved card FIRST is what makes "index 4 is always a double" a
 * property of every deck by construction rather than something a repair pass has
 * to go back and arrange. Nothing here is a rejection loop: every draw is a
 * `sample` from a finished, filtered list, so there is no way for this to spin
 * on a pool that cannot satisfy it (see the trap at the top of the file).
 *
 * `reserved` is null for a section whose block was empty and which is therefore
 * drawing from a neighbour's pool — there is no coverage left for it to
 * guarantee. `taken` is what stops two such sections dealing the same card:
 * while every section had its own block the pools were disjoint and no card
 * could appear twice, and the moment two sections share one pool that stops
 * being true for free.
 *
 * @param {Fact[]} pool
 * @param {{ is: (fact: Fact) => boolean, what: string }|null} reserved
 * @param {Set<Fact>} taken  Cards already dealt into earlier sections.
 * @param {() => number} rng
 * @returns {{ pinned: Fact|null, rest: Fact[] }}
 */
function drawBlock(pool, reserved, taken, rng) {
  const chosen = []
  const used = new Map()
  let pinned = null

  if (reserved !== null) {
    const eligible = pool.filter((candidate) => !taken.has(candidate) && reserved.is(candidate))

    if (eligible.length === 0) {
      throw new RangeError(
        `arithmetic drawBlock(): no card in this block is ${reserved.what}. ` +
          `A reserved slot that cannot be filled is a deck that does not cover what PLAN 4.2/4.3 says it covers.`
      )
    }

    ;[pinned] = sample(eligible, 1, rng)

    chosen.push(pinned)
    used.set(pinned.answer, 1)
  }

  while (chosen.length < BLOCK_SIZE) {
    const candidates = pool.filter(
      (candidate) =>
        !taken.has(candidate) && !chosen.includes(candidate) && (used.get(candidate.answer) ?? 0) < MAX_PER_ANSWER
    )

    if (candidates.length === 0) {
      // Unreachable at every ceiling this engine deals. The tightest is
      // subtraction at max 10, where all three sections share block A's 44
      // cards: the third one still sees at least seven distinct answers with
      // cards left, which is fourteen drawable against a need for six. It stays
      // because the alternative to a sentence is `sample` throwing about an
      // empty array.
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

/** How many blocks a deck of this length is laid out in. */
const blockCount = (length) => Math.ceil(length / BLOCK_SIZE)

/**
 * Does a clash sit anywhere this block could move it?
 *
 * A clash at index `i` is the pair `(i - 1, i)`. Rearranging one block can only
 * change the pairs whose slots it owns plus the two seams either side of it, so
 * the pairs it can touch are exactly those with `i` in `[start, end]`. A block
 * with none of them clashing has nothing to gain from being rearranged, which is
 * what keeps the search below off the two blocks that are already fine.
 *
 * @param {Fact[]} cards
 * @param {number} blockIndex
 * @returns {boolean}
 */
function touchesClash(cards, blockIndex) {
  const start = blockStart(blockIndex)
  const end = Math.min(start + BLOCK_SIZE, cards.length)

  for (let index = Math.max(start, 1); index <= Math.min(end, cards.length - 1); index++) {
    if (cards[index].answer === cards[index - 1].answer) return true
  }

  return false
}

/**
 * Every ordering of `items`, one at a time.
 *
 * The caller only ever passes one block's movable cards, so the whole space is
 * at most `BLOCK_SIZE!` = 720 orderings of six. Enumerating it is what makes the
 * pass *exact*: it finds a clean arrangement whenever one exists, rather than
 * whenever a hill-climb happens to find a single swap that improves things.
 *
 * A generator rather than an array because the caller stops at the first clean
 * arrangement it sees, and its source order is shuffled — so the common repair
 * looks at a handful of orderings and never builds the other seven hundred.
 *
 * @template T
 * @param {readonly T[]} items
 * @yields {T[]}
 */
function* permutations(items) {
  if (items.length <= 1) {
    yield [...items]
    return
  }

  for (let index = 0; index < items.length; index++) {
    const rest = items.filter((_, other) => other !== index)

    for (const tail of permutations(rest)) yield [items[index], ...tail]
  }
}

/**
 * The best block-local rearrangement of one block, or null if nothing beats the
 * arrangement it already has.
 *
 * @param {Fact[]} cards
 * @param {number} blockIndex
 * @param {Set<number>} pinned
 * @param {() => number} rng
 * @param {number} clashes  The whole deck's current clash count — the bar to beat.
 * @returns {{ cards: Fact[], clashes: number }|null}
 */
function bestRearrangement(cards, blockIndex, pinned, rng, clashes) {
  const start = blockStart(blockIndex)
  const end = Math.min(start + BLOCK_SIZE, cards.length)

  const slots = []
  for (let slot = start; slot < end; slot++) {
    if (!pinned.has(slot)) slots.push(slot)
  }

  // One movable card has nothing to trade places with.
  if (slots.length < 2) return null

  // Shuffled so that two arrangements that are equally good are not always
  // broken the same way. The deck she is dealt varies with the seed and so
  // should its repair; without this, every repaired block in every session would
  // settle into the same shape.
  const movable = shuffle(
    slots.map((slot) => cards[slot]),
    rng
  )

  let best = null
  let bestClashes = clashes

  for (const order of permutations(movable)) {
    const trial = [...cards]
    slots.forEach((slot, position) => {
      trial[slot] = order[position]
    })

    const after = adjacentClashes(trial)

    // Strictly better, never merely equal. That is the termination argument:
    // the count is a non-negative integer and every accepted rearrangement
    // drops it by at least one.
    if (after < bestClashes) {
      best = trial
      bestClashes = after

      if (after === 0) break
    }
  }

  return best === null ? null : { cards: best, clashes: bestClashes }
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
 * **Block-local means the moves are block-local, not the collisions.** A card
 * never leaves its block: the A → B → C progression is the point of the deck,
 * and the reserved slots would move with it. Collisions are looked for across
 * the whole deck, because the one that matters most is at the B/C seam — block B
 * and block C both answer 11 and up, so the boundary between slots 11 and 12 is
 * the only place two blocks can collide, and a strictly block-local *scan* would
 * be blind to precisely that.
 *
 * ── WHY THIS IS A BLOCK REARRANGEMENT AND NOT A SWAP ────────────────────────
 *
 * It used to be: find the leftmost clash, try to swap one of the two cards with
 * another card in its own block, keep the first swap that strictly reduced the
 * clash count, and stop the whole pass the moment no single swap helped. Both
 * halves of that were wrong, and both were reproducible rather than theoretical.
 *
 * 1. **The pinned B/C seam could not be repaired at all.** Addition reserves
 *    slot 12, the first card of block C, for a double over ten. A clash there is
 *    between slot 11 and a slot that may not move, so the only card the swap
 *    could relocate was the one at 11 — and block B is allowed two cards with
 *    the same answer, so moving one of them to 11 just moves the clash inside
 *    block B. Seed 881 is the smallest case: block B answers 13·15·19·16·15·16
 *    against a 16 at slot 12, and *none* of the four legal single swaps beats
 *    one clash, while the arrangement 13·15·16·15·16·19 has none. Measured over
 *    seeds 1–200000, 198 addition decks — one in 1010 — shipped two consecutive
 *    cards with the same answer, which is precisely what this pass exists to
 *    prevent. (Subtraction never hit it: it pins slots 11 *and* 12, and the card
 *    at 11 always answers 10 while a block C card always answers 9 or less, so
 *    that seam cannot clash in the first place.)
 *
 * 2. **One unrepairable clash abandoned every other one.** The loop broke out
 *    of the whole pass rather than moving on, so a deck whose leftmost clash was
 *    the stuck seam kept every later clash too, however easy. Seed 881's deck
 *    has one clash; seed 2661's has two, at slots 12 and 17, and the one at 17
 *    is a plain within-block repeat that was never even attempted.
 *
 * So the unit of repair is now a block rather than a card. For each block that
 * touches a clash, every arrangement of its movable cards is enumerated and the
 * best one kept — exact rather than greedy, so slot 11 and slot 8 can move at
 * once, which is what case 1 needs. Every block is visited every round, so an
 * unrepairable clash costs only itself, which is what case 2 needs.
 *
 * If a clash still cannot be resolved it is **left alone**. Not a throw: the
 * defect is cosmetic and a throw here would put an error boundary in front of a
 * six-year-old over a repeated answer. A genuinely unarrangeable block is
 * possible on paper — six cards that all answer 4 — and the draw's
 * `MAX_PER_ANSWER` cap is what keeps it off her screen. That cap is *not* a
 * proof that this pass always succeeds, which is the claim that used to stand
 * here and was false; the proof is the test, which sweeps a contiguous range of
 * seeds wide enough that the old pass failed twenty times inside it.
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

  const blocks = blockCount(cards.length)

  // At most one round per clash, since a round that changes nothing stops the
  // pass and a round that changes something removes at least one clash.
  for (let round = 0; round < cards.length && clashes > 0; round++) {
    let improved = false

    for (let blockIndex = 0; blockIndex < blocks; blockIndex++) {
      // A block that cannot see a clash cannot remove one. Skipping it is the
      // difference between three searches per round and one.
      if (!touchesClash(best, blockIndex)) continue

      const attempt = bestRearrangement(best, blockIndex, pinned, rng, clashes)

      // This block is already as good as it can be made. Move to the next one
      // rather than abandoning the deck — the whole of defect 2 above.
      if (attempt === null) continue

      best = attempt.cards
      clashes = attempt.clashes
      improved = true

      if (clashes === 0) return best
    }

    // Every block that can see a clash is already arranged as well as a
    // block-local rearrangement can arrange it. Leave the deck as it is.
    if (!improved) break
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
  const smallerFirst = !recipe.unordered || rendersSmallerFirst(card, index, rng)
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
 * `params` is **opaque to everything outside this folder** (PLAN 2.2 rule 2):
 * the manifest writes it, this function reads it, and the day a screen or the
 * session reducer looks at any field of it the contract has leaked.
 *
 * ```js
 * { op: 'add', max: 20 }                   // ADD::to20 — sums to 20, addends to 19
 * { op: 'add', max: 20, addendMax: 10 }    // ADD::to10 — sums to 20, addends to 10
 * { op: 'sub', max: 20 }                   // SUB::to20 — minuends to 20
 * { op: 'sub', max: 10 }                   // SUB::to10 — minuends to 10
 * ```
 *
 * The asymmetry is the point and is not a slip: "up to 10" caps the ADDENDS for
 * addition (10 + 10 = 20 is a sum of twenty) and the MINUEND for subtraction.
 * See the header.
 *
 * @param {{ op: string, max: number, addendMax?: number }} params
 * @param {() => number} rng
 * @returns {Object[]} 18 cards in three sections of six — A, B, C where all
 *   three blocks have cards, and see `sectionPlan` where they do not.
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

  // Validates the ceiling and throws with the reason. Each recipe owns its own
  // because the two ceilings are different quantities.
  const pools = poolsFor(recipe, recipe.space(params))

  const laid = new Array(DECK_SIZE)
  const pinned = new Set()
  // Only ever non-empty when two sections share one block's pool; see drawBlock.
  const taken = new Set()

  sectionPlan(pools, recipe.reserved).forEach((section, sectionIndex) => {
    const start = blockStart(sectionIndex)
    const { pinned: reservedCard, rest } = drawBlock(pools[section.block], section.reserved, taken, rng)

    if (reservedCard !== null) taken.add(reservedCard)
    for (const card of rest) taken.add(card)

    const others = shuffle(rest, rng)
    let next = 0

    for (let slot = start; slot < start + BLOCK_SIZE; slot++) {
      laid[slot] = section.reserved !== null && slot === section.reserved.slot ? reservedCard : others[next++]
    }

    if (section.reserved !== null) pinned.add(section.reserved.slot)
  })

  return fixAdjacentAnswers(laid, pinned, rng).map((card, index) => equationCard(recipe, card, index, rng))
}

/**
 * The whole card space of one recipe, for tests.
 *
 * Exported because the block sizes — 44/109/36, 44/54/36, 44/19/36 and 44/0/0 —
 * are how you know the block predicates are right, and a test that
 * re-implemented the space to count it would only be testing itself. Nothing in
 * the app calls this; `generate` goes through `recipe.space`, which validates
 * the ceiling as well.
 *
 * Takes the same params `generate` does, so a test states a deck the way the
 * manifest states it and cannot accidentally describe a space no option has.
 *
 * @param {{ op: string, max?: number, addendMax?: number }|string} params  An op
 *   on its own is the to20 deck, which is what every existing caller means.
 * @returns {Fact[]}
 */
export function cardSpace(params) {
  const asked = typeof params === 'string' ? { op: params } : (params ?? {})
  const recipe = RECIPES[asked.op]

  if (recipe === undefined) {
    throw new TypeError(
      `cardSpace(): unknown op ${JSON.stringify(asked.op)}. Expected one of: ${Object.values(OPS).join(', ')}.`
    )
  }

  return recipe.space({ max: MAX, ...asked })
}
