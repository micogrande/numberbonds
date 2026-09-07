/**
 * What she has finished today. (GOALS.md sections 3 and 4)
 *
 *   amelia.day.v1   { day: 'YYYY-MM-DD', done: { '<activityId>::<optionId>': count } }
 *
 * One day. Not a week, not a rolling window, not a list. This is the smallest
 * store in the app and it is small on purpose.
 *
 * ── THE ABSENCE OF HISTORY IS THE FEATURE ───────────────────────────────────
 *
 * GOALS.md section 4 rejects streaks, streak freezes, forgiving streaks, and any
 * stored history of days. This file is where that decision is enforced, and it
 * is enforced structurally rather than by policy: there is nowhere to put a
 * second day. No `lastPlayedDate`, no array of recent days, no count of days
 * missed. If the value does not exist in state, no screen can render a reproach
 * and no future agent can add one "helpfully" — they would have to change the
 * schema first, which is a conversation rather than an afternoon.
 *
 * A six-year-old cannot make her family less busy on a Tuesday. A number that
 * resets to zero would record a failure she did not control.
 *
 * **If you are here to add a two-week garden view: that is a deliberate schema
 * change, and history starts collecting from the day you make it, not before.
 * GOALS.md records that the owner has seen and accepted that trade.**
 *
 * ── THE CLOCK CAN MOVE, AND HER PROGRESS SURVIVES ───────────────────────────
 *
 * A telling-the-time activity is on the roadmap, so a six-year-old with a phone
 * and a new interest in clocks may well change the device clock — to play with
 * it, or to see what the vine does. Whatever the clock does, the answer is never
 * "her progress is deleted".
 *
 * So reading and writing are deliberately asymmetric:
 *
 *   - A READ on a different day returns an empty day and **writes nothing**. The
 *     stored record stays exactly where it is.
 *   - A WRITE on a different day replaces the record, because that is a genuine
 *     new day's first completion.
 *
 * The consequence is the property we want: moving the clock forward shows an
 * empty vine, and moving it back shows her afternoon again, because nothing was
 * destroyed in between. Only actually finishing something on a different day
 * replaces the record — and by then she has earned a new one.
 *
 * ── NAMES NOTHING ───────────────────────────────────────────────────────────
 *
 * PLAN 2: "Nothing in `app/`, `session/`, `input/`, `storage/` or `screens/`
 * ever names a specific activity." Ids arrive here as opaque strings and are
 * stored as opaque strings. What a task *means* — and what the default list is
 * when nobody has chosen one — lives in `src/goals/`, which is allowed to read
 * the registry. This file cannot tell a number bond from an ocean.
 */

import { dayKey, isDayKey } from '../lib/day'
import { isPlainObject, readObject, writeObject } from './safeStorage'

export const DAY_KEY = 'amelia.day.v1'

/**
 * The separator between an activity id and an option id.
 *
 * The same `::` the score keys use, and forbidden inside an id by
 * `validateRegistry`, so a task key splits back cleanly and can never be
 * ambiguous the way the old `PRACTICE_PARTS_10` key was.
 */
const SEP = '::'

/**
 * The storage key for one task.
 *
 * @param {string} activityId
 * @param {string} optionId
 * @returns {string}
 */
export function taskKey(activityId, optionId) {
  return `${activityId}${SEP}${optionId}`
}

/** An empty day. Frozen so a caller cannot accidentally make it un-empty. */
const emptyDay = (day) => Object.freeze({ day, done: Object.freeze({}) })

/**
 * Only the counts that could have been written by this app.
 *
 * localStorage is user-editable text, so every value here is untrusted. A
 * malformed entry is dropped rather than repaired: a wrong count is a wrong
 * flower, and an absent flower is easier to explain than a lying one.
 *
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
function cleanCounts(raw) {
  if (!isPlainObject(raw)) return {}

  const done = {}

  for (const [key, count] of Object.entries(raw)) {
    if (typeof key !== 'string' || !key.includes(SEP)) continue
    if (!Number.isInteger(count) || count <= 0) continue

    done[key] = count
  }

  return done
}

/**
 * What she has finished today, or an empty day.
 *
 * Never writes. A stored record for another day is left untouched — see the
 * clock note above.
 *
 * @param {number|Date} now
 * @returns {{ day: string, done: Record<string, number> }}
 */
export function readToday(now) {
  const today = dayKey(now)
  const stored = readObject(DAY_KEY, null)

  if (!isPlainObject(stored)) return emptyDay(today)
  if (!isDayKey(stored.day) || stored.day !== today) return emptyDay(today)

  return { day: today, done: cleanCounts(stored.done) }
}

/**
 * Record one finished session.
 *
 * Completion is contingent on FINISHING, never on score (GOALS.md section 2): a
 * session scored 4/18 counts exactly as 18/18 does. The caller decides what
 * counts as finished; this only records it.
 *
 * @param {string} activityId
 * @param {string} optionId
 * @param {number|Date} now
 * @returns {{ day: string, done: Record<string, number>, saved: boolean }}
 */
export function recordCompletion(activityId, optionId, now) {
  const today = dayKey(now)

  if (typeof activityId !== 'string' || !activityId || typeof optionId !== 'string' || !optionId) {
    // Nothing usable to record. Do not touch the store on the way past.
    return { ...readToday(now), saved: false }
  }

  // Deliberately re-reads rather than trusting a caller's snapshot: two tabs, or
  // a stale render, must not roll each other back.
  const stored = readObject(DAY_KEY, null)
  const carryOver =
    isPlainObject(stored) && isDayKey(stored.day) && stored.day === today ? cleanCounts(stored.done) : {}

  const key = taskKey(activityId, optionId)
  const done = { ...carryOver, [key]: (carryOver[key] ?? 0) + 1 }

  const saved = writeObject(DAY_KEY, { day: today, done })

  return { day: today, done, saved }
}

/**
 * Forget today. Exists for the grown-ups screen and for tests; nothing in the
 * child's path calls it.
 *
 * @returns {boolean} whether the write reached localStorage
 */
export function clearToday() {
  return writeObject(DAY_KEY, {})
}
