/**
 * Number Bonds — the manifests. (PLAN 2.2, PLAN 3.7, PLAN 9.4)
 *
 * **Two activities, not one.** That is an owner decision (PLAN 9.4) and it is
 * not a candidate for tidying: "Bonds to 10" and "Parts up to 10" are perfectly
 * distinguishable to a child who reads, they are different skills, and they have
 * separate high scores that already exist on her phone.
 *
 * >>> THE IDS AND OPTION IDS BELOW ARE HALF OF A HIGH-SCORE KEY AND ARE STABLE
 * >>> FOREVER (PLAN 2.2 rule 1). `storage/migrations.js` has already rewritten
 * >>> Amelia's real records into `BOND_WHOLE::t10::v1` and `BOND_PARTS::t10::v1`.
 * >>> Change `id`, `option.id` or `version` here and her bests become unreachable.
 * >>> `registry.test.js` pins all three against the migration, so an edit that
 * >>> breaks the pairing fails at the moment it is made rather than on her phone.
 *
 * The labels are free to change. That is the whole point of the rule.
 *
 * Nothing React is imported here. A manifest is pure serialisable data plus
 * `load()`, so the home screen can list every activity in the app without
 * pulling a single renderer into the first chunk.
 */

import { defineActivity } from '../manifestSchema'

/**
 * The two decks this folder deals, spelled as literals rather than imported
 * from `bondEngine.js`.
 *
 * That is deliberate and it is about the code-splitting boundary: a manifest is
 * loaded eagerly by the registry, so anything it imports from inside the folder
 * is dragged into the first chunk she downloads and `load()` stops meaning
 * anything. The engine already exports these two names for its own use
 * (`RECIPES`); duplicating them here costs two strings and keeps the engine
 * behind the dynamic import.
 *
 * Nothing outside this folder may read them (PLAN 2.2 rule 2), and a typo is not
 * silent: `registry.test.js` deals every option of every activity through the
 * real engine, which throws on an unknown recipe.
 */
const RECIPES = { BONDS_TO: 'bonds-to', PARTS_UP_TO: 'parts-up-to' }

/**
 * The 3–20 target grid, as options.
 *
 * >>> OWNER DECISION (PLAN 9.2), CONFIRMED ON HER ACTUAL PHONE: this range and
 * >>> the grid that draws it keep their current size and layout. Do not trim the
 * >>> range, do not restructure it into levels, do not "simplify" it to a few
 * >>> presets. Restyling is step 12's business; resizing is nobody's.
 *
 * 18 options per activity, `t3` … `t20`, which is exactly the option-id scheme
 * the migration wrote (`legacyBondOption`).
 */
const TARGETS = Array.from({ length: 18 }, (_, index) => index + 3)

/**
 * @param {string} recipe                      Which of the two decks. OPAQUE outside this folder.
 * @param {(target: number) => string} label   What she reads on the button.
 * @param {(target: number) => number} deckSize  How many cards that recipe deals.
 * @returns {import('../manifestSchema').ActivityOption[]}
 */
const targetOptions = (recipe, label, deckSize) =>
  TARGETS.map((target) => ({
    // Stable forever. `t10`, matching what is already in her storage.
    id: `t${target}`,
    label: label(target),
    /** What fits on a 50px grid button. */
    short: String(target),
    /** OPAQUE outside this folder — only `bondEngine.generate` may read it. */
    params: { recipe, target },
    deckSize: deckSize(target),
  }))

/**
 * "Bonds to N" — the whole is given, one part is blank. `N + 1` cards: every
 * pair that makes N, from `0 + N` to `N + 0`.
 */
export const BOND_WHOLE = defineActivity({
  id: 'BOND_WHOLE',
  slug: 'bonds-to',
  categoryId: 'numbers',
  version: 1,
  title: 'Bonds to…',
  subtitle: 'One part is missing. What fills the gap?',
  accentVar: '--color-primary',
  order: 1,
  options: targetOptions(RECIPES.BONDS_TO, (target) => `Bonds to ${target}`, (target) => target + 1),
  /** What the app has always opened on. Not a favourite — a habit worth keeping. */
  defaultOptionId: 't10',
  optionPicker: 'grid',
  inputMode: 'keypad',
  /**
   * Two digits. Every answer is a whole or a part of a target between 3 and 20,
   * so a third digit could only ever produce a wrong answer. This is the value
   * `App.jsx` hardcoded for the whole app until the manifests landed.
   */
  inputConfig: { maxDigits: 2 },
  load: () => import('./index.js'),
})

/**
 * "Parts up to N" — both parts are given, the whole is blank. `N - 2` cards, one
 * per whole from 3 to N.
 */
export const BOND_PARTS = defineActivity({
  id: 'BOND_PARTS',
  slug: 'parts-up-to',
  categoryId: 'numbers',
  version: 1,
  title: 'Parts up to…',
  subtitle: 'Both parts are there. What do they make?',
  accentVar: '--color-secondary',
  order: 2,
  options: targetOptions(RECIPES.PARTS_UP_TO, (target) => `Parts up to ${target}`, (target) => target - 2),
  defaultOptionId: 't10',
  optionPicker: 'grid',
  inputMode: 'keypad',
  inputConfig: { maxDigits: 2 },
  load: () => import('./index.js'),
})
