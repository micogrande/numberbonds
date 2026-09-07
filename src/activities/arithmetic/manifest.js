/**
 * Arithmetic — the manifests. (PLAN 2.2, PLAN 3.7, PLAN 4.2, PLAN 4.3)
 *
 * **Two activities, one folder.** `ADD` and `SUB` are separate activities with
 * separate high scores — she is fluent in one long before the other, and a
 * combined best would hide that — but they share one engine and one renderer,
 * which is exactly the case PLAN 8 says needs no machinery: "Two activities
 * sharing `EquationPrompt` needs no machinery at all." So there is no dispatch
 * table anywhere in this folder; `params.op` tells the engine which recipe to
 * deal and nothing else in the app ever looks at it.
 *
 * >>> `ADD`, `SUB`, the option id `to20` AND `version: 1` ARE HALF OF A
 * >>> HIGH-SCORE KEY AND ARE STABLE FOREVER (PLAN 2.2 rule 1). PLAN 2.6 writes
 * >>> this activity's key out by hand — `'ADD::to20::v1'` — so these strings are
 * >>> spelled the way the specification spells them. Change one and every best
 * >>> she has set becomes unreachable. The labels are free to change; that is
 * >>> the whole point of the rule.
 *
 * Nothing React is imported here, and nothing from this folder either. A
 * manifest is pure serialisable data plus `load()`, and it is loaded EAGERLY by
 * the registry — so an import of the engine or the renderer would drag them into
 * the first chunk she downloads and `load()` would stop meaning anything. The
 * three literals that would otherwise be imported (the two op names and the deck
 * size) are written out below, and `registry.test.js` deals every option through
 * the real engine — which throws on an unknown op — so a typo fails in the test
 * suite rather than on her phone.
 */

import { defineActivity } from '../manifestSchema'

/**
 * The two recipes, spelled by hand rather than imported from the engine. See the
 * note above about the code-splitting boundary; `number-bonds/manifest.js` keeps
 * its `RECIPES` for the same reason.
 *
 * OPAQUE outside this folder (PLAN 2.2 rule 2). Only `arithmetic/generate` may
 * read `params.op`, and the day a screen or the session reducer looks at it the
 * contract has leaked.
 */
const OPS = { ADD: 'add', SUB: 'sub' }

/**
 * "Numbers from 3 to 20" — the sum for addition, the minuend for subtraction.
 * Both decks are 18 cards: 6 within-ten, 6 teen-and-small, 6 bridging-ten, in
 * that order (PLAN 4.2, PLAN 4.3).
 */
const DECK_SIZE = 18
const MAX = 20

/**
 * The one option each activity has, and therefore the one chip on its picker.
 *
 * `short` is the chip face and `caption` the line under it, exactly as PLAN 3.7
 * draws the roman chips — and `short` is deliberately the OPERATOR rather than a
 * worked example, because `.chipShort` is set in Baloo and PLAN 3.2 forbids
 * setting a numeral in the display face. The worked preview PLAN 3.7 asks for
 * ("addition · 8 + 5 = ?") is in the subtitle instead, which is Nunito and is
 * where the category screen reads it from anyway.
 *
 * `label` is the whole sentence: the aria-label of the chip and the text of the
 * start button, so the button says exactly what pressing it starts.
 *
 * @param {string} op
 * @param {string} label
 * @returns {import('../manifestSchema').ActivityOption}
 */
const upTo20 = (op, label) => ({
  // Stable forever — the other half of the high-score key (PLAN 2.6).
  id: 'to20',
  label,
  short: op === OPS.ADD ? '+' : '\u2212',
  caption: `up to ${MAX}`,
  /** OPAQUE outside this folder — only `arithmeticEngine.generate` reads it. */
  params: { op, max: MAX },
  deckSize: DECK_SIZE,
})

/**
 * Addition. 1 ≤ a ≤ 19, 1 ≤ b ≤ 19, 3 ≤ a+b ≤ 20, and the blank is always the
 * result. Zero never appears: Number Bonds already drills `0 + n`, and `n + 0`
 * requires no counting or recall — it would inflate the score without teaching
 * anything.
 */
export const ADD = defineActivity({
  id: 'ADD',
  slug: 'addition',
  categoryId: 'numbers',
  version: 1,
  title: 'Addition',
  /** PLAN 3.7's worked preview, in the body face where digits belong. */
  subtitle: 'Add them up. 8 + 5 = ?',
  /**
   * The garden's deep leaf green. White on it measures 5.05:1, so it obeys the
   * ink law wherever a screen eventually paints with it — nothing reads
   * `accentVar` yet, and step 12 is where activity accents get drawn.
   */
  accentVar: '--color-success',
  /**
   * Third and fourth in *numbers*, which is the order PLAN 1 and PLAN 3.7 both
   * list: number bonds, addition, subtraction, roman numerals. Roman numerals
   * was built first (step 10) and deliberately took 5, leaving 3 and 4 free so
   * two agents building in parallel never argued about a position she navigates
   * by.
   */
  order: 3,
  options: [upTo20(OPS.ADD, `Addition up to ${MAX}`)],
  defaultOptionId: 'to20',
  /** One chip, two lines. The 3–20 grid is the other shape and is not this. */
  optionPicker: 'list',
  inputMode: 'keypad',
  /**
   * PLAN 4.2: "Input cap **2 digits** (max answer is 20), overriding the hook's
   * current 3." A third digit could only ever produce a wrong answer.
   */
  inputConfig: { maxDigits: 2 },
  load: () => import('./index.js'),
})

/**
 * Subtraction. 3 ≤ m ≤ 20, 1 ≤ s ≤ 9, s ≤ m-1, so zero never appears and the
 * answer is never negative. The subtrahend is capped at 9 because subtracting a
 * two-digit number is a later skill that needs partitioning.
 *
 * Not Number Bonds re-skinned: Number Bonds never renders a `−` anywhere, and
 * subtraction as an operation with its own symbol, read left to right, is
 * genuinely new content (PLAN 4.3).
 */
export const SUB = defineActivity({
  id: 'SUB',
  slug: 'subtraction',
  categoryId: 'numbers',
  version: 1,
  title: 'Subtraction',
  /** The minus here is U+2212, the same character the cards are dealt with. */
  subtitle: 'Take one away. 17 \u2212 4 = ?',
  /**
   * The garden's wood tone. White on it measures 4.94:1. It comes from the raw
   * ramp rather than the semantic tier because the semantic tier has no fifth
   * accent left that carries white text — sage, blush and amber are taken by the
   * three activities before it, and green is taken by addition above.
   */
  accentVar: '--bark',
  order: 4,
  options: [upTo20(OPS.SUB, `Subtraction up to ${MAX}`)],
  defaultOptionId: 'to20',
  optionPicker: 'list',
  inputMode: 'keypad',
  inputConfig: { maxDigits: 2 },
  load: () => import('./index.js'),
})
