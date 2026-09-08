/**
 * European flags — the manifest. (PLAN 2.2, WORLD.md)
 *
 * >>> `FLAG_EU`, `starter` / `more` / `all` AND `version: 1` ARE HALF OF A
 * >>> HIGH-SCORE KEY AND ARE STABLE FOREVER (PLAN 2.2 rule 1). Change one and
 * >>> every best she has set on this activity becomes unreachable. The labels
 * >>> are free to change; that is the whole point of the rule.
 *
 * Nothing React and nothing from this folder is imported here. A manifest is
 * pure serialisable data plus `load()`, and the registry loads it EAGERLY — so
 * importing the engine or, far worse, `flagData.js` would drag every flag in
 * Europe into the first chunk she downloads and `load()` would stop meaning
 * anything. The deck size is written out as a literal for the same reason, and
 * `registry.test.js` deals every option through the real engine and fails if it
 * drifts.
 */

import { defineActivity } from '../manifestSchema'

/**
 * Three tiers, the same shape as Roman numerals' up-to-10/50/100.
 *
 * The owner asked for every country in Europe, and `all` is that. The two tiers
 * below it exist because fifty flags is not a first session: coverage is the
 * ceiling she climbs to, not the entry price.
 *
 * `starter` is exactly twelve and the deck is twelve, so that tier is
 * exhaustive — she meets all twelve every session and only the order and the
 * button positions change. Right for a closed set she is trying to learn.
 *
 * `params.tier` is OPAQUE outside this folder (PLAN 2.2 rule 2). Only
 * `flagEngine.generate` may read it.
 */
const OPTIONS = [
  { id: 'starter', short: '12', label: 'The first twelve', caption: 'the ones you see most' },
  { id: 'more', short: '24', label: 'Twenty-four flags', caption: 'and England too' },
  { id: 'all', short: 'All', label: 'All of Europe', caption: 'every country' },
]

export const FLAG_EU = defineActivity({
  id: 'FLAG_EU',
  slug: 'european-flags',
  categoryId: 'flags',
  version: 1,

  title: 'Flags',
  subtitle: 'Whose flag is this?',
  accentVar: '--color-secondary',
  order: 1,

  options: OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    short: option.short,
    caption: option.caption,
    params: { tier: option.id },
    deckSize: 12,
  })),
  optionPicker: 'list',
  defaultOptionId: 'starter',

  inputMode: 'choice',
  // `art` rather than `text`: the buttons carry country names, some of them long
  // ("Bosnia and Herzegovina"), so the grid needs the roomier layout.
  inputConfig: { count: 4, choiceLayout: 'text' },

  load: () => import('./index.js'),
})

export default FLAG_EU
