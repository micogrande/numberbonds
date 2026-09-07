/**
 * Number Bonds — the engine. (PLAN 2.2, PLAN 4.1)
 *
 * **Behaviour is unchanged.** Same two recipes, same card counts, same
 * randomised choice of which slot is blank. What changes is the *shape* of what
 * comes out and where the randomness comes from:
 *
 *   - it emits the `Question` shape from PLAN 2.1 — `{ id, kind, prompt, answer,
 *     meta }` — instead of a bare bond object, so the session loop can run this
 *     deck, a subtraction deck and a multiple-choice roman-numeral deck through
 *     the same reducer without a single conditional;
 *   - `missing: 'whole' | 'part0' | 'part1'` replaces `missingIndex: 0|1|'WHOLE'`,
 *     which overloaded a number with a sentinel string. A third position (a
 *     three-part bond) would have had nowhere to go, and `idx === missingIndex`
 *     in the renderer was one careless `==` away from `0 === 'WHOLE'` nonsense;
 *   - `rng` is injected and taken **last** (PLAN 2.2 rule 3). Nothing in here
 *     calls `Math.random` — the tests stub it to throw. That single rule is what
 *     makes the deck deterministic under a seed and therefore testable at all.
 *
 * The **answer is derived in exactly one place**, from `missing`. The old file
 * assigned `answer` twice: once to a coin-flip that had nothing to do with the
 * missing slot, and then again two lines later to the correct value. It read as
 * deliberate, it burned an RNG draw per card, and it was one deleted line away
 * from shipping a deck whose answers were random. There is now one expression
 * that can produce an answer and it is `answerFor` below.
 *
 * WHAT THIS FILE MUST NOT LEARN: React, storage, or the session. It is a pure
 * function of `(params, rng)`. The manifest that wraps these two recipes into
 * `generate(params, rng)` arrives with the registry at step 8; the recipes
 * themselves are finished here.
 */

import { shuffle } from '../../lib/rng'

/** Render family (PLAN 2.1). Read by tests and aria only — never dispatched on. */
export const KIND = 'BOND'

/**
 * The two decks this folder can deal, named.
 *
 * These strings live in `option.params.recipe` and are **opaque to everything
 * outside `activities/number-bonds/`** (PLAN 2.2 rule 2). They are declared here
 * rather than spelled by hand in the manifest so a typo is a build error instead
 * of a deck that fails to deal on her phone.
 */
export const RECIPES = Object.freeze({
  BONDS_TO: 'bonds-to',
  PARTS_UP_TO: 'parts-up-to',
})

/**
 * Which slot of the bond is blank. Strings, not indices: `'whole'` is not a
 * position in `parts`, and pretending it was is what made the old sentinel
 * necessary.
 */
export const MISSING = {
  WHOLE: 'whole',
  PART0: 'part0',
  PART1: 'part1',
}

/**
 * The `missing` slot, abbreviated for the id. PLAN 2.1's worked example is
 * `'BOND-W10-P3-p1'`, so this is pinned to that spelling rather than chosen.
 */
const ID_SLOT = {
  [MISSING.WHOLE]: 'w',
  [MISSING.PART0]: 'p0',
  [MISSING.PART1]: 'p1',
}

/**
 * The graded value. One expression, one place.
 *
 * @param {number} whole
 * @param {[number, number]} parts
 * @param {string} missing
 * @returns {number}
 */
function answerFor(whole, parts, missing) {
  if (missing === MISSING.WHOLE) return whole
  return missing === MISSING.PART0 ? parts[0] : parts[1]
}

/**
 * The spoken reading of the card. This is `prompt.text` from PLAN 2.1 — the
 * string a screen reader gets, and the one place the bond is stated in words
 * rather than circles.
 *
 * @param {number} whole
 * @param {[number, number]} parts
 * @param {string} missing
 * @returns {string}
 */
function promptText(whole, parts, missing) {
  switch (missing) {
    case MISSING.WHOLE:
      return `${parts[0]} and ${parts[1]} make what?`
    case MISSING.PART0:
      return `What and ${parts[1]} make ${whole}?`
    default:
      return `${parts[0]} and what make ${whole}?`
  }
}

/**
 * Build one card.
 *
 * The id is unique within either deck by construction: `generateDeck` walks
 * `parts[0]` from 0 to `whole` exactly once, and `generateMixedDeck` produces
 * exactly one card per whole. It is the React key, which is what finally makes
 * each card genuinely remount and replay its entrance animation (PLAN 5,
 * `BondDiagram.jsx:54` — index keys meant the animation played on card 1 of a
 * session and never again).
 *
 * @param {{ whole: number, parts: [number, number], missing: string, meta: Object }} spec
 * @returns {Object} a PLAN 2.1 Question
 */
function bondQuestion({ whole, parts, missing, meta }) {
  return {
    id: `BOND-W${whole}-P${parts[0]}-${ID_SLOT[missing]}`,
    kind: KIND,
    prompt: { whole, parts, missing, text: promptText(whole, parts, missing) },
    answer: answerFor(whole, parts, missing),
    meta,
  }
}

/**
 * Loud, not silent. Forgetting the generator would otherwise surface as
 * "rng is not a function" from inside a shuffle three frames later.
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
 * "Bonds to N" — the whole is given, one part is blank.
 *
 * Every pair that makes `whole` appears exactly once, `0 + N` through `N + 0`,
 * which is `whole + 1` cards. Which of the two parts is blanked is a coin flip
 * per card, so `3 + ␣ = 10` and `␣ + 7 = 10` are both reachable for the same
 * pair across sessions.
 *
 * @param {number} whole
 * @param {() => number} rng
 * @returns {Object[]} `whole + 1` cards, shuffled.
 */
export function generateDeck(whole, rng) {
  assertRng(rng, 'generateDeck')

  const cards = []

  for (let i = 0; i <= whole; i++) {
    cards.push(
      bondQuestion({
        whole,
        parts: [i, whole - i],
        missing: rng() < 0.5 ? MISSING.PART0 : MISSING.PART1,
        // A fresh object per card. Hoisting it out of the loop would have every
        // card in the deck alias one `meta`, which is the kind of sharing that
        // is invisible until something mutates it.
        meta: { recipe: RECIPES.BONDS_TO, max: whole },
      })
    )
  }

  return shuffle(cards, rng)
}

/**
 * "Parts up to N" — both parts are given, the whole is blank.
 *
 * One card per whole from 3 to `max`, which is `max - 2` cards. PLAN 4.2 reads
 * this same phrasing for arithmetic and is explicit about it: 3 to N is the
 * range of the **whole**, not of every operand, which is why a part is drawn
 * freely from `0 … w`.
 *
 * @param {number} max
 * @param {() => number} rng
 * @returns {Object[]} `max - 2` cards, shuffled (none at all below 3).
 */
export function generateMixedDeck(max, rng) {
  assertRng(rng, 'generateMixedDeck')

  const cards = []

  for (let w = 3; w <= max; w++) {
    const first = Math.floor(rng() * (w + 1))

    cards.push(
      bondQuestion({
        whole: w,
        parts: [first, w - first],
        missing: MISSING.WHOLE,
        meta: { recipe: RECIPES.PARTS_UP_TO, max },
      })
    )
  }

  return shuffle(cards, rng)
}

/**
 * The activity entry point. (PLAN 2.2: `generate(params, rng) => Question[]`,
 * pure, `rng` last.)
 *
 * Both Number Bonds activities load the same module and are told apart by
 * `params.recipe` — which is exactly what PLAN 2.2 rule 2 means by "opaque to
 * everything except this activity's `generate`". The dispatch is allowed to live
 * here because here is inside the folder; the day a screen or the session
 * reducer reads `params.recipe`, the contract has leaked.
 *
 * It throws on an unknown recipe rather than dealing a default deck. A manifest
 * asking for a recipe that does not exist is a wiring mistake, and the cheapest
 * moment to learn about it is the first deal with the name in the message.
 *
 * @param {{ recipe: string, target: number }} params
 * @param {() => number} rng
 * @returns {Object[]}
 */
export function generate(params, rng) {
  const recipe = params?.recipe
  const target = params?.target

  if (!Number.isInteger(target)) {
    throw new TypeError(`number-bonds generate(): params.target must be an integer, got ${String(target)}`)
  }

  switch (recipe) {
    case RECIPES.BONDS_TO:
      return generateDeck(target, rng)

    case RECIPES.PARTS_UP_TO:
      return generateMixedDeck(target, rng)

    default:
      throw new TypeError(
        `number-bonds generate(): unknown params.recipe ${JSON.stringify(recipe)}. ` +
          `Expected one of: ${Object.values(RECIPES).join(', ')}.`
      )
  }
}
