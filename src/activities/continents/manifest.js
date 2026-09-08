/**
 * Continents — the manifest. (PLAN 2.2, WORLD.md)
 *
 * >>> `CONTINENT`, `all` AND `version: 1` ARE HALF OF A HIGH-SCORE KEY AND ARE
 * >>> STABLE FOREVER (PLAN 2.2 rule 1).
 *
 * One option. Seven continents is a small enough world that difficulty tiers
 * would be pretending: what varies is the place she is asked about, and every
 * place is equally fair game.
 */

import { defineActivity } from '../manifestSchema'

export const CONTINENT = defineActivity({
  id: 'CONTINENT',
  slug: 'continents',
  categoryId: 'continents',
  version: 1,

  title: 'Continents',
  subtitle: 'Which continent is it in?',
  accentVar: '--color-primary',
  order: 1,

  options: [
    {
      id: 'all',
      label: 'All seven continents',
      short: '7',
      caption: 'places around the world',
      params: {},
      deckSize: 12,
    },
  ],
  optionPicker: 'list',
  defaultOptionId: 'all',

  inputMode: 'choice',
  inputConfig: { count: 4, choiceLayout: 'text' },

  load: () => import('./index.js'),
})

export default CONTINENT
