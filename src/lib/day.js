/**
 * Which day a moment belongs to. (GOALS.md section 3)
 *
 * > **A new day** clears the flowers and returns the bunny to the left. The day
 * > rolls over at **04:00 local**, not midnight: a session at 23:55 and one at
 * > 00:05 are the same evening to a six-year-old, and a bedtime game should not
 * > land in tomorrow.
 *
 * That is the whole feature of this file. Everything else here exists to make it
 * safe to depend on.
 *
 * ── PURE, AND IT TAKES `now` ────────────────────────────────────────────────
 *
 * Nothing here reads the clock ambiently. Every function takes `now`, the same
 * way the engines take `rng`, so the day boundary is testable by passing a
 * timestamp instead of by mocking a global. A test that has to freeze time is a
 * test nobody writes, and an untested day boundary is one that quietly puts her
 * Tuesday evening into Wednesday.
 *
 * ── WHY LOCAL CALENDAR FIELDS AND NOT ARITHMETIC ────────────────────────────
 *
 * The obvious implementation is `new Date(now - 4 * HOUR)`, and it is wrong
 * twice a year. Subtracting four hours of *elapsed time* is not the same as
 * moving back four hours on the *wall clock* when the clock itself jumped: on
 * the spring-forward day an hour does not exist, and on the autumn day an hour
 * happens twice. This reads `getHours()` and decrements a calendar date instead,
 * so it asks the platform "what does the wall clock say" and never does time
 * arithmetic across a transition.
 *
 * Known and accepted: in the handful of zones that transition AT midnight, local
 * midnight can be a moment that does not exist, and `new Date(y, m, d)` lands on
 * 01:00 instead. Only the date fields are ever read back, and those are still
 * right, so this costs nothing here.
 */

/**
 * When a day starts, on the local wall clock.
 *
 * 04:00 rather than 00:00. She is asleep at four; she is very much awake at
 * five past midnight on a Friday, and that game belongs to Thursday's vine.
 */
export const DAY_START_HOUR = 4

const pad = (n) => String(n).padStart(2, '0')

/**
 * The identity of the day a moment belongs to, as a sortable `YYYY-MM-DD`
 * string in local time.
 *
 * This is an *identity*, not a date: two moments belong to the same day exactly
 * when their keys are equal. Do not parse it back into a Date and do arithmetic
 * on it — ask this function again with the other timestamp.
 *
 * @param {number|Date} now
 * @param {number} [startHour] Exposed for tests. Production always uses the default.
 * @returns {string} e.g. `'2026-09-07'`
 */
export function dayKey(now, startHour = DAY_START_HOUR) {
  const at = now instanceof Date ? now : new Date(now)

  if (Number.isNaN(at.getTime())) {
    throw new TypeError(`dayKey(): not a usable time: ${String(now)}`)
  }

  // Midnight on the calendar date the wall clock is showing...
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate())

  // ...and if we have not reached the start hour yet, this is still yesterday.
  if (at.getHours() < startHour) {
    day.setDate(day.getDate() - 1)
  }

  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

/**
 * Do these two moments belong to the same day?
 *
 * @param {number|Date} a
 * @param {number|Date} b
 * @param {number} [startHour]
 * @returns {boolean}
 */
export function isSameDay(a, b, startHour = DAY_START_HOUR) {
  return dayKey(a, startHour) === dayKey(b, startHour)
}

/**
 * Is this a day key this app could have written?
 *
 * Used on the way *out* of storage, where the value is user-editable text. A
 * malformed key is not an error to throw over — it just means the stored day is
 * not today, which is already a case every caller handles.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDayKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
