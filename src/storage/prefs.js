/**
 * What she chose last time. (PLAN 2.6, PLAN 7 step 9)
 *
 *   amelia.prefs.v1        { lastOption: { [activityId]: optionId } }
 *
 * One preference, and there is deliberately only one. This is not a settings
 * store: nothing in this app has a setting a six-year-old would want to change,
 * and a file called `prefs` is exactly the file that grows a theme, a sound
 * toggle and a difficulty slider if it is allowed to. It remembers which option
 * she started, so the picker opens on it.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * PLAN 5's last low-severity bug: "target resets to 10 on every return home".
 * Step 8 fixed half of it by holding `lastOption` in `App.jsx`'s React state, so
 * walking home and back kept her target — the trip she actually makes. The other
 * half is a RELOAD. PLAN 2.5: "Refresh mid-session drops it and lands on that
 * activity's option screen **with her last choice pre-selected**." Until this
 * file existed, that sentence was only true within one page load: a reload on
 * `#/play/bonds-to/t7` redirected to the picker — correctly — and then opened it
 * on the manifest's `t10`, silently undoing her choice at the exact moment she
 * least understands why. She does not refresh on purpose, so every time this
 * path runs, something has already gone wrong; landing on the wrong number makes
 * it worse.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 *
 * Not a mid-session snapshot. PLAN 8 defers that on purpose ("a corrupt snapshot
 * becomes a crash loop"), and this file is the reason it can stay deferred: the
 * cheap 90% of "carry on where I was" is one option id, and one option id cannot
 * become a crash loop.
 *
 * Not a source of truth about what exists, either. An id in here is a *hint*.
 * The registry's `defaultOption()` looks it up and falls back to the manifest
 * default when it does not resolve, so a stored `t7` that a future recipe change
 * deletes costs her one wrong pre-selection and nothing else. That is the whole
 * reason nothing here validates ids against the registry: `storage/` may never
 * name an activity (PLAN 2), and it does not need to.
 *
 * Every read is defensive because this is user-editable text in localStorage,
 * and every write goes through `safeStorage`, so a full disk or a private window
 * costs a preference and never a session.
 */

import { isPlainObject, readObject, writeObject } from './safeStorage'

export const PREFS_KEY = 'amelia.prefs.v1'

/** The one field. Named so a second one cannot be added without saying so. */
const LAST_OPTION = 'lastOption'

/**
 * Is this something we would be willing to write back?
 *
 * Both halves of the map are ids — `activity.id` and `option.id` — and PLAN 2.2
 * rule 1 makes them non-empty strings, stable forever. Anything else in the
 * stored object is somebody's hand edit or a half-written value, and is dropped
 * rather than carried forward.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
const isId = (value) => typeof value === 'string' && value.length > 0

/**
 * The `id → id` entries of a stored map, and nothing else.
 *
 * Entries that are not `id → id` are dropped silently: a preference file is not
 * worth a console warning she will never see, and the fallback — the manifest
 * default — is a perfectly good screen.
 *
 * @param {unknown} stored
 * @returns {Record<string, string>}
 */
function cleanLastOptions(stored) {
  if (!isPlainObject(stored)) return {}

  const clean = {}
  for (const [activityId, optionId] of Object.entries(stored)) {
    if (isId(activityId) && isId(optionId)) clean[activityId] = optionId
  }

  return clean
}

/**
 * Every remembered choice, as a plain object. Always an object, never null.
 *
 * @returns {Record<string, string>}
 */
export function readLastOptions() {
  return cleanLastOptions(readObject(PREFS_KEY, {})[LAST_OPTION])
}

/**
 * The option she last started for one activity, or `undefined`.
 *
 * `undefined` rather than `null` so the result can be handed straight to
 * `defaultOption(activity, …)`, whose second parameter is optional.
 *
 * @param {string} activityId
 * @returns {string|undefined}
 */
export function getLastOption(activityId) {
  return readLastOptions()[activityId]
}

/**
 * Remember that she started this option.
 *
 * Read-modify-write over the whole store, like `scores.js`: there is one writer
 * and it runs on a tap, so a merge is a line of code nobody would be able to
 * test the failure of. Unknown top-level fields are carried through rather than
 * dropped, so a newer build that stored something else here does not lose it to
 * an older tab.
 *
 * A malformed id is refused rather than stored. The ids are compile-time
 * constants off a manifest, so the live path cannot reach that — it is here so
 * that a caller bug cannot quietly poison what the picker opens on.
 *
 * @param {string} activityId
 * @param {string} optionId
 * @returns {boolean} true if it reached localStorage. Callers may ignore it —
 *   nothing user-visible depends on the write, which is the point of doing this
 *   through `safeStorage` at all.
 */
export function setLastOption(activityId, optionId) {
  if (!isId(activityId) || !isId(optionId)) return false

  const stored = readObject(PREFS_KEY, {})
  const lastOption = cleanLastOptions(stored[LAST_OPTION])

  return writeObject(PREFS_KEY, { ...stored, [LAST_OPTION]: { ...lastOption, [activityId]: optionId } })
}
