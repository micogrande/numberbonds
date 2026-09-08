/**
 * Roman numerals — the engine. (PLAN 2.2, PLAN 4.4)
 *
 * `generate(params, rng) => Question[]`: pure, `rng` last, no React, no storage,
 * no idea what a session is. `roman.js` next door decides *what four numbers*
 * are on the buttons; this file decides *which numerals she meets* and *where
 * the right button is*, and those are the only two places randomness is allowed
 * to enter (PLAN 4.4).
 *
 * ── THE DECKS ───────────────────────────────────────────────────────────────
 *
 * > Deck: **up to 10 is exhaustive** — there are only ten possible cards, so she
 * > meets all ten every session and only the order and button positions vary.
 * > That is right for a closed set of ten facts. Up to 50 and up to 100 are 12
 * > cards, stratified across five shape classes with the two hardest slots
 * > reserved: one round-ten from `{40,50}` / `{40,60,90,100}`, and the **final
 * > card** drawn from the double-subtractive set `{44,49}` / `{44,49,94,99}`.
 *
 * ── THE FIVE SHAPE CLASSES ──────────────────────────────────────────────────
 *
 * PLAN 4.4 asks for five and does not name them, so they are named here, by what
 * a child has to *do* to read the numeral rather than by how big it is:
 *
 *     TALLY        III · XXIII        count the I's
 *     FIVE         VII · LVIII        start at five and count on
 *     ROUND        X · XL · XC · C    a whole ten, nothing after it
 *     SUBTRACTIVE  IV · XIX · XLV     one pair read backwards
 *     DOUBLE       XLIV · XCIX        two of them, in one numeral
 *
 * They are a **partition**, checked first-match in that priority order, so every
 * value from 1 to 100 has exactly one class and a quota can be a fixed template
 * rather than a sample. Two of the boundaries are decisions:
 *
 *   - a round ten that is also subtractive (`XL`, `XC`) is a ROUND. "Is it a
 *     whole ten?" is the first question she asks of a numeral, and 40 and 90 are
 *     the two round tens the reserved hard slot exists to keep offering her.
 *   - DOUBLE outranks everything, because `XLIV` is the hardest thing in the
 *     range and it is only four numerals wide — it must never be diluted into
 *     the subtractive pool.
 *
 * The quota below spends the twelve cards on those five shapes. It is fixed, not
 * sampled: a session that happened to deal five tally cards and no subtractive
 * one would be a different, easier activity reached from the same button.
 *
 * WHAT THIS FILE MUST NOT LEARN: React, the score, the timer, or that a button
 * exists. It emits `Question` objects (PLAN 2.1) and stops.
 */

import { DISTRACTOR_COUNT, getDistractors, toRoman } from './roman'
import { assertRng, balancedPositions } from '../../lib/choicePositions'

// Re-exported so the move out of this file is invisible to anything that already
// imported it from here — including this activity's own test suite, which is the
// evidence that the promotion changed no behaviour.
export { balancedPositions }
import { sample, shuffle } from '../../lib/rng'

/** Render family (PLAN 2.1). Read by tests and aria only — never dispatched on. */
export const KIND = 'GLYPH'

/** PLAN 4.4: four choices in a 2×2 grid, "exactly one correct plus three distractors". */
export const CHOICE_COUNT = DISTRACTOR_COUNT + 1

/**
 * The five shape classes, hardest first — which is also the order `shapeClass`
 * checks them in, because the classes overlap and the priority is the decision.
 */
export const SHAPES = Object.freeze({
  DOUBLE: 'double',
  ROUND: 'round',
  SUBTRACTIVE: 'subtractive',
  FIVE: 'five',
  TALLY: 'tally',
})

/**
 * How the twelve cards of a 50 or 100 deck are spent. Sums to 12.
 *
 * One DOUBLE, because there are only two (or four) in the whole range and it is
 * the reserved final card. Two ROUNDs, one of which is the reserved hard one.
 * Three each of the shapes she meets most often.
 */
export const CLASS_QUOTA = Object.freeze({
  [SHAPES.DOUBLE]: 1,
  [SHAPES.ROUND]: 2,
  [SHAPES.SUBTRACTIVE]: 3,
  [SHAPES.FIVE]: 3,
  [SHAPES.TALLY]: 3,
})

/**
 * The reserved round-ten, per option. **Straight from PLAN 4.4** — these are not
 * "the round tens", they are the four hard ones: `XL` and `XC` are subtractive,
 * `L` and `C` introduce a letter, and `LX` is the one that reads as `XL` to a
 * child who has just learned the subtractive rule.
 *
 * Note that 50 is in the max-50 set and not in the max-100 set: at max 100 the
 * L/C confusion is carried by 60 and 90 instead, which exercise it harder.
 */
export const HARD_ROUNDS = Object.freeze({
  50: Object.freeze([40, 50]),
  100: Object.freeze([40, 60, 90, 100]),
})

/**
 * One template per option. `exhaustive` decks ignore the quota — there are only
 * ten cards, so the deck IS the range.
 */
const TEMPLATES = Object.freeze({
  10: Object.freeze({ size: 10, exhaustive: true }),
  50: Object.freeze({ size: 12, exhaustive: false }),
  100: Object.freeze({ size: 12, exhaustive: false }),
})

/** How many places in the numeral are a smaller letter in front of a bigger one. */
function subtractivePairs(numeral) {
  const value = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let pairs = 0

  for (let index = 0; index < numeral.length - 1; index++) {
    if (value[numeral[index]] < value[numeral[index + 1]]) pairs += 1
  }

  return pairs
}

/**
 * Which of the five shapes this number is written in. First match wins; see the
 * priority note at the top of the file.
 *
 * @param {number} value
 * @returns {string} one of SHAPES
 */
export function shapeClass(value) {
  const numeral = toRoman(value)
  const pairs = subtractivePairs(numeral)

  if (pairs >= 2) return SHAPES.DOUBLE
  if (value % 10 === 0) return SHAPES.ROUND
  if (pairs === 1) return SHAPES.SUBTRACTIVE
  if (numeral.includes('V')) return SHAPES.FIVE

  return SHAPES.TALLY
}

/**
 * Every value from 1 to `max`, bucketed by shape.
 *
 * @param {number} max
 * @returns {Record<string, number[]>}
 */
function poolsUpTo(max) {
  const pools = {}
  for (const shape of Object.values(SHAPES)) pools[shape] = []

  for (let value = 1; value <= max; value++) {
    pools[shapeClass(value)].push(value)
  }

  return pools
}

/**
 * The twelve values of a stratified deck, in the order they will be played.
 *
 * The two reserved slots are drawn first and the quota is spent around them, so
 * "one hard round-ten" and "a double-subtractive last card" are true of every
 * deck by construction rather than by a repair pass afterwards.
 *
 * @param {number} max
 * @param {() => number} rng
 * @returns {number[]}
 */
function stratifiedValues(max, rng) {
  const pools = poolsUpTo(max)

  // Reserved: the hardest card in the range, and it goes last.
  const finale = sample(pools[SHAPES.DOUBLE], 1, rng)[0]
  // Reserved: one of PLAN 4.4's hard round-tens, anywhere in the deck.
  const hardRound = sample(HARD_ROUNDS[max], 1, rng)[0]

  const taken = new Set([finale, hardRound])
  const owed = { ...CLASS_QUOTA }
  owed[SHAPES.DOUBLE] -= 1
  owed[SHAPES.ROUND] -= 1

  const body = [hardRound]

  for (const [shape, wanted] of Object.entries(owed)) {
    if (wanted === 0) continue

    const drawn = sample(
      pools[shape].filter((value) => !taken.has(value)),
      wanted,
      rng
    )

    for (const value of drawn) taken.add(value)
    body.push(...drawn)
  }

  // The eleven others are shuffled; the hardest card is put back on the end.
  return [...shuffle(body, rng), finale]
}

/**
 * One card. (PLAN 2.1's worked example is `ROM-40`, and this is it.)
 *
 * The three distractors are shuffled into the slots the correct answer did not
 * take — "Choices are shuffled, not sorted — sorted order leaks structure,
 * because the reversal distractor sits at a fixed offset" (PLAN 4.4).
 *
 * @param {number} value
 * @param {number} max
 * @param {number} position  Which slot the correct answer takes.
 * @param {() => number} rng
 * @returns {Object} a PLAN 2.1 Question
 */
function glyphCard(value, max, position, rng) {
  const numeral = toRoman(value)
  const wrong = shuffle(getDistractors(value, max), rng)

  const choices = []
  for (let slot = 0; slot < CHOICE_COUNT; slot++) {
    const id = slot === position ? value : wrong[slot < position ? slot : slot - 1]
    choices.push({ id, label: String(id) })
  }

  return {
    id: `ROM-${value}`,
    kind: KIND,
    prompt: {
      glyph: numeral,
      // Spaced, exactly as PLAN 2.1's card is written: a screen reader says
      // "X L" rather than guessing at a word. `GlyphPrompt.jsx` reads it as the
      // accessible name and draws `glyph` unspaced.
      text: numeral.split('').join(' '),
    },
    answer: value,
    // Order is final: the engine has already placed the correct answer
    // (PLAN 2.1). Nothing downstream re-sorts or re-shuffles them.
    choices,
    // Difficulty tags. Read by TESTS only, never rendered (PLAN 2.1). A fresh
    // object per card — one shared `meta` across a deck is invisible until
    // something mutates it.
    meta: { max, shape: shapeClass(value) },
  }
}

/**
 * The activity entry point. (PLAN 2.2: `generate(params, rng) => Question[]`,
 * pure, `rng` last.)
 *
 * `params.max` is **opaque to everything outside this folder** (PLAN 2.2 rule
 * 2): the manifest writes it, this function reads it, and the day a screen or
 * the session reducer looks at it the contract has leaked.
 *
 * It throws on a ceiling it has no template for rather than dealing something
 * approximate. An option that advertises a deck size the engine cannot deal is a
 * personal best out of the wrong denominator.
 *
 * @param {{ max: number }} params
 * @param {() => number} rng
 * @returns {Object[]}
 */
export function generate(params, rng) {
  assertRng(rng, 'roman-numerals generate')

  const max = params?.max
  const template = TEMPLATES[max]

  if (template === undefined) {
    throw new TypeError(
      `roman-numerals generate(): unknown params.max ${JSON.stringify(max)}. ` +
        `Expected one of: ${Object.keys(TEMPLATES).join(', ')}.`
    )
  }

  const values = template.exhaustive
    ? // All ten, every session. Only the order and the button positions vary.
      shuffle(
        Array.from({ length: max }, (_, index) => index + 1),
        rng
      )
    : stratifiedValues(max, rng)

  const positions = balancedPositions(values.length, CHOICE_COUNT, rng)

  return values.map((value, index) => glyphCard(value, max, positions[index], rng))
}
