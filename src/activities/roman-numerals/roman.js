/**
 * Roman numerals — the numeral table and the distractor ladder. (PLAN 4.4)
 *
 * Pure arithmetic on strings and numbers. No React, no rng, no session, nothing
 * from outside this folder. `romanEngine.js` deals the deck; this file answers
 * two questions about one number: *how is it written*, and *what would she
 * plausibly confuse it with*.
 *
 * ── WHY THE DISTRACTORS TAKE NO RNG ─────────────────────────────────────────
 *
 * PLAN 4.4, and it is the most valuable decision in this activity:
 *
 * > **Distractors are a pure function of `(value, max)` with no randomness at
 * > all**, so every set is assertable with an exact expected array. Randomness
 * > enters only in which values are sampled and where the buttons go.
 *
 * The alternative — sampling three wrong answers near the right one — is
 * testable only as a distribution, which in practice means it is not tested at
 * all and a bad set (an option out of range, a giveaway 60 next to a 4) reaches
 * her phone before anyone notices. Here, `roman.test.js` pins six exact arrays
 * copied from PLAN and then checks all 480 sets against four invariants.
 *
 * ── THE LADDER ──────────────────────────────────────────────────────────────
 *
 * Evaluated in order until three are accepted, rejecting anything outside
 * `[1, max]`, equal to the answer, or already taken. One rule per confusion
 * family, hardest-to-spot first, so the three buttons she is choosing between
 * are the three mistakes she is actually at risk of making:
 *
 *     R1a  subtractive read additively           XL → 60 · IX → 11 · IV → 6
 *     R1b  additive read subtractively           LX → 40 · XI → 9
 *          (TRAILING PAIR ONLY)
 *     R2   tally miscount                        ±1
 *     R3   ten slip (ONLY when value ≥ 10)       ±10
 *     R4   five slip (V read as X)               ±5
 *     R5   fifty slip (L/C)                      ±50
 *     R6   nearest-neighbour backstop            ±2, ±3, …
 *
 * TWO GATES CARRY THE WHOLE FILE, and both are in PLAN 4.4 by name:
 *
 *   - **R1b matches the last two characters, not `includes`.** `XIII` contains
 *     the substring `XI`, and an `includes` check would therefore offer 9 as a
 *     distractor for 13. No child misreads the leading `XI` of `XIII` as `IX` —
 *     they have already read past it. The confusion is about the *final* pair.
 *
 *   - **R3 is gated on `value ≥ 10`.** Without it, `I` generates 11, which is
 *     not a real confusion: there is no ten in the numeral to slip. At max 10 the
 *     range would hide the bug (11 is out of range anyway); at max 50 and 100 it
 *     would ship.
 *
 * A third gate is not in PLAN's table and is written down here because the
 * exhaustive check is what found it: **R5 fires only when the numeral actually
 * contains an L or a C**, which is what "(L/C)" in PLAN's table names. Ungated,
 * `getDistractors(1, 100)` reaches R5 (R2 gives only 2, R3 is gated off, R4
 * gives only 6) and offers 51 as a distractor for `I` — in range, but 50 away,
 * which breaks PLAN's own verified invariant that every distractor is within 20
 * of the answer. It is the same gate as R3's, said in letters instead of
 * numbers: you cannot slip a fifty that is not there.
 */

/**
 * The standard greedy table, largest first. Every value from 1 to 3999 is
 * written by subtracting the largest entry that fits, repeatedly.
 *
 * The four subtractive entries (`CM`, `CD`, `XC`, `XL`, `IX`, `IV`) sit in the
 * table rather than being patched in afterwards, which is what makes the greedy
 * walk produce `IV` and never `IIII` — a clock-face convention, not a numeral,
 * and two spellings of one number is two answers to one card.
 */
const NUMERALS = Object.freeze([
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
])

/** What one letter is worth. `fromRoman` and the ladder both read this. */
const LETTERS = Object.freeze({ I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 })

/** PLAN 4.4: four choices — "exactly one correct plus three distractors". */
export const DISTRACTOR_COUNT = 3

/**
 * How far R6 may wander, and the invariant the whole ladder is checked against:
 * "every one within 20 of the answer — no absurd option ever reaches a button".
 *
 * It is a real limit, not a formality. A distractor 30 away from the answer is
 * eliminable by size alone, which turns a four-way choice into a three-way one
 * without her reading the numeral.
 */
export const NEIGHBOUR_LIMIT = 20

/**
 * A number as a Roman numeral.
 *
 * @param {number} value  A positive integer.
 * @returns {string} e.g. 44 → 'XLIV'
 */
export function toRoman(value) {
  if (!Number.isInteger(value) || value < 1 || value > 3999) {
    throw new RangeError(`toRoman(): expected a whole number from 1 to 3999, got ${JSON.stringify(value)}`)
  }

  let left = value
  let out = ''

  for (const [amount, letters] of NUMERALS) {
    while (left >= amount) {
      out += letters
      left -= amount
    }
  }

  return out
}

/**
 * A Roman numeral as a number. Case-insensitive; throws on a letter that is not
 * one, so a typo in a test or a fixture is loud rather than silently worth zero.
 *
 * The classic right-to-left walk: a letter smaller than the one after it is
 * subtracted. It reads `IIII` as 4 as happily as `IV` — it is the inverse of
 * `toRoman` for everything `toRoman` can produce, which is all this activity
 * ever asks of it, and being liberal here costs nothing.
 *
 * @param {string} numeral
 * @returns {number}
 */
export function fromRoman(numeral) {
  if (typeof numeral !== 'string' || numeral.trim() === '') {
    throw new TypeError(`fromRoman(): expected a numeral string, got ${JSON.stringify(numeral)}`)
  }

  const letters = numeral.trim().toUpperCase()
  let total = 0

  for (let index = 0; index < letters.length; index++) {
    const here = LETTERS[letters[index]]
    const next = LETTERS[letters[index + 1]]

    if (here === undefined) {
      throw new TypeError(`fromRoman(): ${JSON.stringify(numeral)} contains ${JSON.stringify(letters[index])}, which is not a Roman letter`)
    }

    total += next !== undefined && here < next ? -here : here
  }

  return total
}

/**
 * Every candidate the ladder can offer, in ladder order. A generator, so a rule
 * that is never reached is never evaluated and the order is the code's order —
 * the rules read top to bottom exactly as PLAN 4.4's table does.
 *
 * @param {number} value
 * @returns {Generator<number>}
 */
function* ladder(value) {
  const numeral = toRoman(value)
  const at = (index) => LETTERS[numeral[index]]

  // ── R1a · subtractive read additively ──────────────────────────────────
  // She knows the letters and not yet the rule, so `XL` is "ten and fifty".
  // Reading the pair additively adds twice the smaller letter: 40 → 60.
  // Every pair in the numeral, left to right, so XLIV offers 64 before 46.
  for (let index = 0; index < numeral.length - 1; index++) {
    if (at(index) < at(index + 1)) yield value + 2 * at(index)
  }

  // ── R1b · additive read subtractively, TRAILING PAIR ONLY ──────────────
  // The mirror image: she has learned that a small letter beside a big one
  // means subtract, and applies it to a pair that is simply additive, so `LX`
  // becomes 40. Only the LAST two characters, which is the gate that stops
  // `XIII` (whose trailing pair is `II`) from offering 9.
  if (numeral.length >= 2 && at(numeral.length - 1) < at(numeral.length - 2)) {
    yield value - 2 * at(numeral.length - 1)
  }

  // ── R2 · tally miscount ────────────────────────────────────────────────
  // `III` counted as two or four. The commonest slip there is.
  yield value + 1
  yield value - 1

  // ── R3 · ten slip — ONLY when there is a ten to slip ───────────────────
  // An `X` counted once too often or once too few. Gated on `value ≥ 10`:
  // `I` offering 11 is not a confusion, it is noise.
  if (value >= 10) {
    yield value + 10
    yield value - 10
  }

  // ── R4 · five slip ─────────────────────────────────────────────────────
  // `V` read as `X` or the other way about. Deliberately NOT gated on the
  // numeral containing a V: `C → 95` is one of PLAN 4.4's verified outputs and
  // `C` has no V in it. A five away is a near miss whatever the letters are.
  yield value + 5
  yield value - 5

  // ── R5 · fifty slip, only when there is an L or a C ────────────────────
  // `L` read as `C`. Same gate as R3, in letters rather than numbers — see the
  // note at the top of this file: ungated, `I` at max 100 offers 51.
  if (numeral.includes('L') || numeral.includes('C')) {
    yield value + 50
    yield value - 50
  }

  // ── R6 · nearest-neighbour backstop ────────────────────────────────────
  // Not a confusion family: the guarantee that three buttons always fill. It
  // is reached only near the edges of the range, where half the ladder has
  // been rejected for being out of bounds — `I` gets 3 from here.
  for (let step = 2; step <= NEIGHBOUR_LIMIT; step++) {
    yield value + step
    yield value - step
  }
}

/**
 * The three wrong answers for one card. Pure: same `(value, max)`, same array,
 * forever, and a fresh array each call so a caller cannot poison the next one.
 *
 * @param {number} value  The answer. Must be within `[1, max]`.
 * @param {number} max    The option's advertised ceiling — 10, 50 or 100.
 * @returns {number[]} exactly three, distinct, in range, each within 20 of `value`
 */
export function getDistractors(value, max) {
  if (!Number.isInteger(value) || !Number.isInteger(max) || value < 1 || value > max) {
    throw new RangeError(`getDistractors(): value must be a whole number in [1, ${JSON.stringify(max)}], got ${JSON.stringify(value)}`)
  }

  const taken = new Set([value])
  const out = []

  for (const candidate of ladder(value)) {
    if (candidate < 1 || candidate > max || taken.has(candidate)) continue

    taken.add(candidate)
    out.push(candidate)

    if (out.length === DISTRACTOR_COUNT) return out
  }

  // Unreachable for every max this activity offers (R6 alone sweeps 40 values
  // around the answer). It throws rather than returning two, because a card with
  // three buttons is a different game with a different guess floor — and PLAN
  // 4.4 chose four for a reason.
  throw new RangeError(
    `getDistractors(${value}, ${max}): the ladder ran out after ${out.length} — a range this narrow cannot fill four buttons`
  )
}
