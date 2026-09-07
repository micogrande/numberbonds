/**
 * Roman numerals — the manifest. (PLAN 2.2, PLAN 3.7, PLAN 4.4)
 *
 * >>> `ROMAN`, `to10` / `to50` / `to100` AND `version: 1` ARE HALF OF A
 * >>> HIGH-SCORE KEY AND ARE STABLE FOREVER (PLAN 2.2 rule 1). PLAN 2.6 writes
 * >>> the key for this activity out by hand — `'ROMAN::to100::v1'` — so these
 * >>> four strings are spelled the way the specification spells them. Change one
 * >>> and every best she has set becomes unreachable. The labels are free to
 * >>> change; that is the whole point of the rule.
 *
 * Nothing React is imported here, and nothing from this folder either. A
 * manifest is pure serialisable data plus `load()`, and it is loaded EAGERLY by
 * the registry — so an import of the engine or the renderer would drag them into
 * the first chunk she downloads and `load()` would stop meaning anything. The
 * two literals that would otherwise be imported (the deck sizes) are written out
 * below, and `registry.test.js` deals every option through the real engine and
 * fails if either drifts.
 */

import { defineActivity } from '../manifestSchema'

/**
 * The three options. (PLAN 3.7: "roman numerals → three chips reading **X**,
 * **L**, **C** with 'up to 10 / 50 / 100' beneath".)
 *
 * `short` is the chip face, `caption` the line under it, `label` the whole
 * sentence — the aria-label of the chip and the text of the start button. The
 * shared `ActivityScreen` draws all three from the manifest; a captioned option
 * is what turns a list row into a chip, and the 3–20 grid refuses one outright
 * (PLAN 9.2), which is why this activity is `optionPicker: 'list'`.
 *
 * `params.max` is OPAQUE outside this folder (PLAN 2.2 rule 2). Only
 * `romanEngine.generate` may read it.
 *
 * `deckSize`: 10 up to ten, because that deck is exhaustive — "there are only
 * ten possible cards, so she meets all ten every session". 12 for the other two,
 * stratified across the five shape classes (PLAN 4.4).
 */
const OPTIONS = [
  { id: 'to10', short: 'X', max: 10, deckSize: 10 },
  { id: 'to50', short: 'L', max: 50, deckSize: 12 },
  { id: 'to100', short: 'C', max: 100, deckSize: 12 },
].map(({ id, short, max, deckSize }) => ({
  id,
  label: `Roman numerals up to ${max}`,
  short,
  caption: `up to ${max}`,
  params: { max },
  deckSize,
}))

export const ROMAN = defineActivity({
  id: 'ROMAN',
  slug: 'roman-numerals',
  categoryId: 'numbers',
  version: 1,
  title: 'Roman numerals',
  subtitle: 'Four numbers. Which one is this?',
  /**
   * The warm bark-amber of the garden palette. It is the third accent in the
   * semantic tier — the two Number Bonds activities have taken sage and blush —
   * and the only other one that meets the ink law at text sizes (4.98:1 on the
   * cream page). The name says "warning" because that is what the palette calls
   * the tone; nothing in this app treats an activity accent as an alarm.
   */
  accentVar: '--color-warning',
  /**
   * Third in the *numbers* category on screen, but numbered 5: PLAN 1 and PLAN
   * 3.7 both list addition and subtraction before roman numerals, and they are
   * step 11 (`ADD`, `SUB`) to this activity's step 10. Leaving 3 and 4 free is
   * how two activities being built in parallel avoid arguing about a position
   * she navigates by.
   */
  order: 5,
  options: OPTIONS,
  /** Ten facts, closed set, all ten every session. The place to start. */
  defaultOptionId: 'to10',
  /** PLAN 3.7's chips. The 3–20 grid is the other shape and is not this. */
  optionPicker: 'list',
  /**
   * PLAN 4.4: "Four choices in a 2×2 grid, each ≥88px tall. Three choices give a
   * 33% guess floor that makes the score noise; six would halve the button
   * height or push the numeral off screen."
   *
   * Two columns is the `choice` adapter's own default; it is stated here anyway
   * because the 2×2 is a decision of PLAN 4.4's, not a default this activity
   * happened to inherit. No `Art`: the buttons are numbers and she reads them.
   */
  inputMode: 'choice',
  inputConfig: { columns: 2 },
  load: () => import('./index.js'),
})
