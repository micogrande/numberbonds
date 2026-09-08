/**
 * Oceans and seas — the manifest. (PLAN 2.2, WORLD.md)
 *
 * >>> `OCEAN`, `oceans` / `seas` AND `version: 1` ARE HALF OF A HIGH-SCORE KEY
 * >>> AND ARE STABLE FOREVER (PLAN 2.2 rule 1).
 *
 * Two levels, and the second is why this is an app rather than a card she opens
 * twice: five oceans is five facts, and the home screen slot is permanent.
 *
 * Deck sizes differ per level and that is deliberate — the oceans level has
 * exactly ten clues and deals all ten, so it is exhaustive the way Roman
 * numerals up-to-10 is. `registry.test.js` deals every option through the real
 * engine and fails if either number drifts.
 */

import { defineActivity } from '../manifestSchema'

export const OCEAN = defineActivity({
  id: 'OCEAN',
  slug: 'oceans',
  categoryId: 'oceans',
  version: 1,

  title: 'Oceans',
  subtitle: 'Which water is which?',
  accentVar: '--color-secondary',
  order: 1,

  options: [
    {
      id: 'oceans',
      label: 'The five oceans',
      short: '5',
      caption: 'all the way round the world',
      params: { level: 'oceans' },
      deckSize: 10,
    },
    {
      id: 'seas',
      label: 'Oceans and seas',
      short: '10',
      caption: 'and the Mediterranean too',
      params: { level: 'seas' },
      deckSize: 12,
    },
  ],
  optionPicker: 'list',
  defaultOptionId: 'oceans',

  inputMode: 'choice',
  inputConfig: { count: 4, choiceLayout: 'text' },

  load: () => import('./index.js'),
})

export default OCEAN
