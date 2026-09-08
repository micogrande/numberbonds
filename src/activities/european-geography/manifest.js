/**
 * European geography — the manifest. (PLAN 2.2, WORLD.md)
 *
 * >>> `GEO_EU`, `capitals` AND `version: 1` ARE HALF OF A HIGH-SCORE KEY AND ARE
 * >>> STABLE FOREVER (PLAN 2.2 rule 1). The labels are free to change.
 *
 * The owner chose one app with two options, capitals and find-on-map. Only
 * capitals is built: the map needs simplified border geometry generated outside
 * the repo, and shipping half an app she can use beats shipping none. `find` is
 * a NEW option id when it lands, so it cannot disturb a best set on `capitals`.
 *
 * Nothing React and nothing from this folder is imported here — a manifest is
 * loaded eagerly by the registry, so an import of the engine would drag the
 * country data into the first chunk she downloads.
 */

import { defineActivity } from '../manifestSchema'

export const GEO_EU = defineActivity({
  id: 'GEO_EU',
  slug: 'european-geography',
  categoryId: 'geography',
  version: 1,

  title: 'Capitals',
  subtitle: 'Which city is the capital?',
  accentVar: '--color-primary',
  order: 1,

  options: [
    {
      id: 'starter',
      label: 'The first twelve',
      short: '12',
      caption: 'countries you know',
      params: { tier: 'starter' },
      deckSize: 12,
    },
    {
      id: 'all',
      label: 'All of Europe',
      short: 'All',
      caption: 'every country',
      params: { tier: 'all' },
      deckSize: 12,
    },
  ],
  optionPicker: 'list',
  defaultOptionId: 'starter',

  inputMode: 'choice',
  inputConfig: { count: 4, choiceLayout: 'text' },

  load: () => import('./index.js'),
})

export default GEO_EU
