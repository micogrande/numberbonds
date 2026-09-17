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
 * >>> `ADD`, `SUB`, the option ids `to20` and `to10` AND `version: 1` ARE HALF
 * >>> OF A HIGH-SCORE KEY AND ARE STABLE FOREVER (PLAN 2.2 rule 1). PLAN 2.6
 * >>> writes this activity's key out by hand — `'ADD::to20::v1'` — so these
 * >>> strings are spelled the way the specification spells them. Change one and
 * >>> every best she has set becomes unreachable. The labels are free to change;
 * >>> that is the whole point of the rule.
 * >>>
 * >>> `version` DID NOT MOVE when `to10` was added, and that is the rule rather
 * >>> than an oversight. PLAN 2.2 gives `version` exactly one job — "bump ONLY
 * >>> when the recipe changes enough to make old scores incomparable" — and a
 * >>> new option id is a new key (`ADD::to10::v1`) beside the old one, not a
 * >>> change to the old one. `ADD::to20::v1` deals the same eighteen cards from
 * >>> the same seed that it dealt before `to10` existed, which is asserted card
 * >>> for card in `arithmeticEngine.test.js`; bumping the version would have
 * >>> thrown away every best she has, for nothing.
 *
 * Nothing React is imported here, and nothing from this folder either. A
 * manifest is pure serialisable data plus `load()`, and it is loaded EAGERLY by
 * the registry — so an import of the engine or the renderer would drag them into
 * the first chunk she downloads and `load()` would stop meaning anything. The
 * literals that would otherwise be imported (the two op names, the deck size and
 * the two ceilings) are written out below, and `registry.test.js` deals every
 * option through the real engine — which throws on an unknown op or an unknown
 * ceiling — so a typo fails in the test suite rather than on her phone.
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
 * Every deck is 18 cards in three sections of six (PLAN 4.2, PLAN 4.3).
 */
const DECK_SIZE = 18
const MAX = 20

/** The ceiling of the easier option. See the note above `OPTIONS`. */
const TEN = 10

/**
 * One option: one chip on the picker, one high-score key.
 *
 * `short` is the chip face and `caption` the line under it, exactly as PLAN 3.7
 * draws the roman chips — and `short` is deliberately the OPERATOR rather than a
 * worked example or the ceiling, because `.chipShort` is set in Baloo and PLAN
 * 3.2 gives every maths digit to Nunito. So the number lives in the caption,
 * which is Nunito, and the result is what the picker needs: an activity's two
 * chips read as one operation at two heights rather than as two unrelated
 * things — the same big `+`, "up to 10" and "up to 20" beneath it, easier one
 * first. The worked preview PLAN 3.7 asks for ("addition · 8 + 5 = ?") is in the
 * subtitle above them, which is where the category screen reads it from anyway.
 *
 * `label` is the whole sentence: the aria-label of the chip and the text of the
 * start button, so the button says exactly what pressing it starts.
 *
 * @param {string} op
 * @param {string} id       Stable forever — the other half of the key (PLAN 2.6).
 * @param {number} ceiling  What "up to N" says to her.
 * @param {Object} params   OPAQUE outside this folder — only the engine reads it.
 * @returns {import('../manifestSchema').ActivityOption}
 */
const option = (op, id, ceiling, params) => ({
  id,
  label: `${op === OPS.ADD ? 'Addition' : 'Subtraction'} up to ${ceiling}`,
  short: op === OPS.ADD ? '+' : '\u2212',
  caption: `up to ${ceiling}`,
  params,
  deckSize: DECK_SIZE,
})

/**
 * ── "UP TO 10" IS NOT THE SAME CONSTRAINT TWICE ─────────────────────────────
 *
 * The owner asked for "a practice option to do it up to 10. So highest for
 * addition would be 10+10 and highest for subtraction 10-10". Read against the
 * two card spaces those halves mean different things, and `params` is where the
 * difference has to be visible or it will be lost:
 *
 *   addition     `max` STAYS 20, because 10 + 10 is twenty. The ceiling she
 *                picked caps each ADDEND, and that is `addendMax`. Writing
 *                `max: 10` here would deal a deck whose hardest card is 9 + 1
 *                under a chip that promises 10 + 10 — so the engine refuses it
 *                rather than dealing it quietly.
 *   subtraction  `max` already IS that ceiling: it has always capped the
 *                minuend. So `max: 10`, and nothing else moves.
 *
 * A judgement call is baked in here too, stated plainly so the owner can
 * overrule it in one line: **"10 - 10" is zero, and this app has no zero
 * anywhere** — no zero operand and no zero answer, in any activity. PLAN 4.3
 * argues the case at length (a zero answer reads as "nothing" to a child, and
 * pressing 0 looks like pressing nothing), so "10-10" is read as naming the
 * RANGE rather than as demanding that exact card. The top subtraction card is
 * therefore 10 − 1 = 9, and the smallest answer is 1. Wanting that one card is a
 * change to PLAN 4.3 and to both engines, not to this line.
 *
 * Easier first, which is the order the chips are drawn in. `defaultOptionId`
 * deliberately stays `to20`: it is what the picker has always opened on, her
 * remembered choice overrides it anyway, and moving it would change a screen she
 * already knows in order to advertise a chip sitting right beside the one it
 * opens on.
 */
const OPTIONS = {
  [OPS.ADD]: [
    option(OPS.ADD, 'to10', TEN, { op: OPS.ADD, max: MAX, addendMax: TEN }),
    option(OPS.ADD, 'to20', MAX, { op: OPS.ADD, max: MAX }),
  ],
  [OPS.SUB]: [
    option(OPS.SUB, 'to10', TEN, { op: OPS.SUB, max: TEN }),
    option(OPS.SUB, 'to20', MAX, { op: OPS.SUB, max: MAX }),
  ],
}

/**
 * Addition. The blank is always the result, and zero never appears: Number Bonds
 * already drills `0 + n`, and `n + 0` requires no counting or recall — it would
 * inflate the score without teaching anything.
 *
 *   up to 20   1 ≤ a ≤ 19, 1 ≤ b ≤ 19, 3 ≤ a+b ≤ 20   189 cards
 *   up to 10   1 ≤ a ≤ 10, 1 ≤ b ≤ 10, 3 ≤ a+b ≤ 20    99 cards, top card 10 + 10
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
  options: OPTIONS[OPS.ADD],
  defaultOptionId: 'to20',
  /** Two chips, two lines each. The 3–20 grid is the other shape and is not this. */
  optionPicker: 'list',
  inputMode: 'keypad',
  /**
   * PLAN 4.2: "Input cap **2 digits** (max answer is 20), overriding the hook's
   * current 3." A third digit could only ever produce a wrong answer, and both
   * ceilings top out at 20 — `up to 10` caps the addends, not the sum.
   */
  inputConfig: { maxDigits: 2 },
  load: () => import('./index.js'),
})

/**
 * Subtraction. 1 ≤ s ≤ 9 and s ≤ m-1 at both ceilings, so zero never appears and
 * the answer is never negative. The subtrahend is capped at 9 because
 * subtracting a two-digit number is a later skill that needs partitioning.
 *
 *   up to 20   3 ≤ m ≤ 20   134 cards
 *   up to 10   3 ≤ m ≤ 10    44 cards, top card 10 − 1
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
  options: OPTIONS[OPS.SUB],
  defaultOptionId: 'to20',
  optionPicker: 'list',
  inputMode: 'keypad',
  inputConfig: { maxDigits: 2 },
  load: () => import('./index.js'),
})
