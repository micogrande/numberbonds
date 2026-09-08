/**
 * The registry. (PLAN 2)
 *
 * > A single `registry.js` is the only place that knows what exists. Home,
 * > category screens, option screens, the play host, the summary and the storage
 * > keys are all *derived* from it. Nothing in `app/`, `session/`, `input/`,
 * > `storage/` or `screens/` ever names a specific activity.
 * >
 * > Adding European flags later = one folder + one import line. That is the
 * > whole point of the shape.
 *
 * So: **one import line per activity**, and everything below it is lookup. If
 * you find yourself adding a condition to this file — "unless it is the roman
 * numerals one" — the abstraction is wrong and the fix is in the abstraction.
 *
 * The activity list is deliberately not sorted by hand. `order` is what a screen
 * renders by, because a six-year-old navigates by spatial memory and the array
 * literal is not a promise about position.
 */

import { CATEGORIES, categoriesInOrder, getCategoryBySlug } from './categories'
import { validateRegistry } from './manifestSchema'
import { ADD, SUB } from './arithmetic/manifest'
import { BOND_PARTS, BOND_WHOLE } from './number-bonds/manifest'
import { FLAG_EU } from './european-flags/manifest'
import { ROMAN } from './roman-numerals/manifest'

/** One entry per activity. This is the list. @type {readonly import('./manifestSchema').ActivityManifest[]} */
export const ACTIVITIES = Object.freeze([BOND_WHOLE, BOND_PARTS, ADD, SUB, ROMAN, FLAG_EU])

// Boot-time, dev-only, and loud. `defineActivity` has already checked every
// manifest in isolation; this is the part no single manifest can know — whether
// another one has taken its id (they would share a high score), its slug (one of
// them is unreachable by URL), or whether it is filed under a category with no
// way in. Throwing here fails the module graph before a screen renders.
if (import.meta.env.DEV) {
  const problems = validateRegistry(ACTIVITIES, CATEGORIES)

  if (problems.length > 0) {
    throw new Error(`activities/registry.js is not sound:\n  - ${problems.join('\n  - ')}`)
  }
}

/**
 * The activities in a category, in the order she has learned them.
 *
 * @param {string} categoryId
 * @returns {import('./manifestSchema').ActivityManifest[]}
 */
export function activitiesInCategory(categoryId) {
  return ACTIVITIES.filter((activity) => activity.categoryId === categoryId).sort((a, b) => a.order - b.order)
}

/**
 * @param {string} slug
 * @returns {import('./manifestSchema').ActivityManifest|null}
 */
export function getActivityBySlug(slug) {
  return ACTIVITIES.find((activity) => activity.slug === slug) ?? null
}

/**
 * One activity by its stable id, or null.
 *
 * The slug is what a URL carries; the id is what *storage* carries, because it
 * is half of a high-score key and half of a daily-goal task. Both lookups exist
 * for that reason and neither is a synonym for the other — a slug may be renamed
 * for readability, an id never may.
 *
 * Null is a real answer: a stored id can outlive the activity it named.
 *
 * @param {string} id
 * @returns {import('./manifestSchema').ActivityManifest|null}
 */
export function getActivityById(id) {
  return ACTIVITIES.find((activity) => activity.id === id) ?? null
}

/**
 * One option of one activity, or null.
 *
 * Null is a real answer and every caller has to handle it: an option id arrives
 * from the URL, and PLAN 2.5 is explicit that an unknown one redirects to `#/`
 * rather than rendering a screen with no deck behind it.
 *
 * @param {import('./manifestSchema').ActivityManifest|null} activity
 * @param {string} optionId
 * @returns {import('./manifestSchema').ActivityOption|null}
 */
export function findOption(activity, optionId) {
  return activity?.options.find((option) => option.id === optionId) ?? null
}

/**
 * The option a picker should open on: the one asked for, else the one the
 * manifest opens on, else the activity's first. Never null, because an activity
 * always has at least one option (`defineActivity` refuses an empty list).
 *
 * The preference is how PLAN 5's last low-severity bug — "target resets to 10 on
 * every return home" — stops happening. `App.jsx` holds it in state for the walk
 * home and back, and `storage/prefs.js` (step 9) mirrors it to
 * `amelia.prefs.v1` so it survives a reload too.
 *
 * A preferred id that no longer resolves is not an error here, and that is what
 * lets `prefs.js` store an id without ever validating it against the registry: a
 * stored option that a later recipe change deleted costs her one wrong
 * pre-selection, not a broken screen.
 *
 * @param {import('./manifestSchema').ActivityManifest} activity
 * @param {string} [preferredOptionId]
 * @returns {import('./manifestSchema').ActivityOption}
 */
export function defaultOption(activity, preferredOptionId) {
  return (
    findOption(activity, preferredOptionId) ??
    findOption(activity, activity.defaultOptionId) ??
    activity.options[0]
  )
}

// Re-exported so a screen needs one import to render the hub, and so nothing
// outside `activities/` has to know that categories and activities are two
// files (PLAN 2: the registry is "the only place that knows what exists").
export { CATEGORIES, categoriesInOrder, getCategoryBySlug }
