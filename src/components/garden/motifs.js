import { lazy } from 'react'

import Bunting from './Bunting'
import Globe from './Globe'
import Hedgehog from './Hedgehog'
import Pond from './Pond'
import Strawberries from './Strawberries'

/**
 * Which drawing belongs to which category slot. (PLAN 3.5)
 *
 * > numbers → a strawberry patch. […] flags → bunting · geography → hedgehog
 * > with a leaf map · continents → globe as a round flowerbed · oceans → lily
 * > pond with one orange fish · clock → a sunflower whose face is a dial
 *
 * ── WHY THIS IS NOT A CONTRACT LEAK ─────────────────────────────────────────
 *
 * The architecture rule is that nothing in `app/`, `session/`, `input/`,
 * `storage/` or `screens/` names a specific ACTIVITY, and that `registry.js` is
 * the only place that knows what exists. Neither is bent here. These are the six
 * fixed CATEGORY SLOTS, which PLAN 1 pins from day one and never reorders, and
 * this file cannot bring one into being — delete `numbers` from `categories.js`
 * and the strawberry patch is simply never asked for. It is a lookup table from
 * a slot to a drawing, in the folder where the drawings live, and PLAN 3.5
 * enumerates it by name.
 *
 * A category with no entry renders no motif rather than throwing. A missing
 * picture is a quieter card; a crash is her whole home screen.
 *
 * ── ONLY AN AWAKE CATEGORY'S DRAWING IS IN THE BOOT CHUNK ───────────────────
 *
 * A motif is drawn by `CategoryCard`, and a card is only rendered for an AWAKE
 * category — a sleeping slot draws a pot and a curled bunny instead (PLAN 3.6),
 * and never looks in this table. `numbers` is the only awake slot, so five of
 * these six drawings render nowhere. Imported statically they still shipped in
 * the first chunk she downloads: five SVG components, parsed on every cold load,
 * on a phone, for a screen that cannot show them.
 *
 * So a sleeping slot's drawing is behind a dynamic import. Nothing is deleted —
 * PLAN 3.5 names all six and they are all drawn, ready for the day their
 * category ships; they simply arrive in their own chunk, at the moment somebody
 * first renders one.
 *
 * >>> WAKING A CATEGORY MOVES ITS MOTIF UP HERE. Delete `asleep` in
 * >>> `categories.js` and this line becomes a static import, because from that
 * >>> moment the home screen draws it on first paint and a lazy motif would show
 * >>> an empty pebble for a frame. `motifs.test.js` fails if the two disagree,
 * >>> so this is a reminder rather than a trap.
 *
 * (`CategoryCard` wraps the motif in its own `Suspense` with a `null` fallback,
 * so even that frame is an empty pebble on a finished card rather than the whole
 * screen dropping to the app's "Getting ready…".)

 */
export const CATEGORY_MOTIFS = Object.freeze({
  numbers: Strawberries,
  flags: Bunting,
  geography: Hedgehog,
  continents: Globe,
  oceans: Pond,
  clock: lazy(() => import('./Sunflower')),
})

/**
 * The unopened bud in each sleeping slot. (PLAN 3.6)
 *
 * PLAN 3.1 reserves three tints for exactly this — `--garden-sky`,
 * `--garden-lilac`, `--garden-peach` — and there are five sleeping slots, so
 * two more come off the ramp's 200-level tints. All five are illustration
 * colours and none is ever text (the ink law).
 *
 * The tint is the ONLY thing that differs between the five sleeping slots. That
 * is what makes them read as five different things asleep rather than five
 * copies of one placeholder, without any of them growing an affordance.
 */
export const CATEGORY_TINTS = Object.freeze({
  numbers: 'var(--blush-200)',
  flags: 'var(--butter-200)',
  geography: 'var(--garden-peach)',
  continents: 'var(--garden-lilac)',
  oceans: 'var(--garden-sky)',
  clock: 'var(--blush-200)',
})
