import Bunting from './Bunting'
import Globe from './Globe'
import Hedgehog from './Hedgehog'
import Pond from './Pond'
import Strawberries from './Strawberries'
import Sunflower from './Sunflower'

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
 */
export const CATEGORY_MOTIFS = Object.freeze({
  numbers: Strawberries,
  flags: Bunting,
  geography: Hedgehog,
  continents: Globe,
  oceans: Pond,
  clock: Sunflower,
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
