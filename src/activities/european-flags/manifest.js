/**
 * European flags — the manifest. (PLAN 2.2, WORLD.md)
 *
 * >>> `FLAG_EU` AND `starter` / `more` / `all` ARE HALF OF A HIGH-SCORE KEY AND
 * >>> ARE STABLE FOREVER (PLAN 2.2 rule 1). Change one and every best she has
 * >>> set on this activity becomes unreachable. The labels are free to change;
 * >>> that is the whole point of the rule.
 *
 * Nothing React and nothing from this folder is imported here. A manifest is
 * pure serialisable data plus `load()`, and the registry loads it EAGERLY — so
 * importing the engine or, far worse, `flagData.js` would drag every flag in
 * Europe into the first chunk she downloads and `load()` would stop meaning
 * anything. The deck sizes are therefore written out as literals, and TWO tests
 * pin them against the real pools: `flags.test.js` compares each literal to
 * `deckSizeFor(tier)` and names the tier when they disagree, and
 * `registry.test.js` deals every option through the real engine.
 *
 * ── WHY version IS 2 ────────────────────────────────────────────────────────
 *
 * PLAN 2.2: "`version` — Deck-recipe version. Bump ONLY when the recipe changes
 * enough to make old scores incomparable." This is exactly that situation, and
 * it is the only situation this field exists for.
 *
 * `more` went from dealing twelve of its twenty-four flags to dealing all
 * twenty-four; `all` went from twelve of fifty-one to all fifty-one. A stored
 * "10" against `more` used to mean ten out of twelve and now means ten out of
 * twenty-four — the denominator moved, so the number is not comparable across
 * the change. Worse than merely stale: `beatsBest` ranks on the raw score, so an
 * untouched v1 record of 12/12 on `all` — a *perfect* run — would be beaten and
 * overwritten by a 13/51, and the summary would print "Previous best: 12 / 12"
 * under a "13 / 51" that is in every real sense worse. `BestRecord.total` is
 * stored precisely so that line reads as a fraction, and here the fraction it
 * would read as is a lie about which run was better.
 *
 * `version` is activity-wide, so this also retires `starter`'s records, whose
 * recipe has NOT changed — that is the genuine cost of the decision and there is
 * no way to avoid it from inside this folder. It is paid because: flags shipped
 * days ago so at most a handful of records exist; option ids are append-only and
 * stable forever, so "rename `more` and leave `starter` alone" is forbidden by
 * the rule that makes any of these keys trustworthy; and a wrong previous-best
 * on the summary is a thing a six-year-old reads and believes. A clean slate on
 * one tier is cheaper than a lie on two.
 *
 * The v1 records are not deleted. They stay in `amelia.scores.v1` under the old
 * keys, inert, the same way the legacy bonds key was kept as a backup.
 */

import { defineActivity } from '../manifestSchema'

/**
 * Three tiers, the same shape as Roman numerals' up-to-10/50/100.
 *
 * The owner asked for every country in Europe, and `all` is that. The two tiers
 * below it exist because fifty flags is not a first session: coverage is the
 * ceiling she climbs to, not the entry price.
 *
 * EVERY tier is exhaustive — the deck is the tier's whole pool, shuffled, so she
 * meets every flag in the tier she picked exactly once and only the order and
 * the button positions change. That is right for a closed set she is trying to
 * learn, and it is what the owner asked for: "the option for 24 should have 24
 * questions and the option for all should have a question for each European
 * country."
 *
 * `deckSize` is the pool size and nothing else. `all` is 51 rather than 50
 * because England is a flag in that tier: WORLD.md has the St George cross
 * sitting beside the Union Jack so the two teach the distinction by existing
 * together, and a tier that claims "every country" while silently dropping a
 * card it owns would be the stranger choice.
 *
 * `params.tier` is OPAQUE outside this folder (PLAN 2.2 rule 2). Only
 * `flagEngine.generate` may read it.
 */
const OPTIONS = [
  { id: 'starter', short: '12', label: 'The first twelve', caption: 'the ones you see most', deckSize: 12 },
  { id: 'more', short: '24', label: 'Twenty-four flags', caption: 'and England too', deckSize: 24 },
  { id: 'all', short: 'All', label: 'All of Europe', caption: 'every country', deckSize: 51 },
]

export const FLAG_EU = defineActivity({
  id: 'FLAG_EU',
  slug: 'european-flags',
  categoryId: 'flags',
  // Bumped 1 → 2 when `more` and `all` became exhaustive. See the note above
  // before you touch this: it is half a high-score key.
  version: 2,

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
    deckSize: option.deckSize,
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
