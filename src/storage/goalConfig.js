/**
 * The standing to-do list her dad sets. (GOALS.md section 1)
 *
 *   amelia.goals.v1   { tasks: [ { activityId, optionId }, ... ] }
 *
 * > **The list is STANDING.** It applies every day until he changes it. There is
 * > no per-day setup ritual and no "you forgot to set today's goals" state.
 *
 * One to four tasks, in the order they appear on the vine. A duplicate is
 * legitimate and means "do this twice" — GOALS.md section 2 — so this file
 * deliberately does not de-duplicate.
 *
 * ── WHAT THIS FILE DOES NOT KNOW ────────────────────────────────────────────
 *
 * PLAN 2 forbids `storage/` from naming a specific activity, so the ids here are
 * opaque strings and stay that way. Two consequences worth stating, because both
 * look like omissions:
 *
 *   - Nothing is validated against the registry. A task naming an activity that
 *     no longer exists is stored and returned happily; `src/goals/` is where it
 *     gets resolved and dropped, because that is the layer allowed to look.
 *   - The fallback list, for a dad who has not chosen yet, is NOT here. It has
 *     to name three activities, so it lives in `src/goals/goals.js` and is
 *     derived from the registry rather than hardcoded.
 *
 * An unset list and an empty list are the same thing to a reader: `null`, "he
 * has not chosen", which is the signal `goals.js` needs to substitute defaults.
 */

import { isPlainObject, readObject, writeObject } from './safeStorage'

export const GOAL_CONFIG_KEY = 'amelia.goals.v1'

/**
 * The vine holds four blooms at most.
 *
 * Four is a layout constraint and a legibility one: past four she has to count
 * the flowers instead of seeing how many there are.
 */
export const MAX_TASKS = 4

/** @typedef {{ activityId: string, optionId: string }} GoalTask */

/**
 * Is this shaped like something this app wrote?
 *
 * @param {unknown} value
 * @returns {value is GoalTask}
 */
function isTask(value) {
  return (
    isPlainObject(value) &&
    typeof value.activityId === 'string' &&
    value.activityId.length > 0 &&
    typeof value.optionId === 'string' &&
    value.optionId.length > 0
  )
}

/**
 * The standing list, or `null` if nobody has set one.
 *
 * Malformed entries are dropped rather than repaired — a task nobody can
 * complete would be a flower that never blooms, which is worse than one fewer
 * flower. If dropping leaves nothing, that is indistinguishable from never
 * having chosen, and the caller supplies defaults.
 *
 * @returns {GoalTask[]|null}
 */
export function readTasks() {
  const stored = readObject(GOAL_CONFIG_KEY, null)

  if (!isPlainObject(stored) || !Array.isArray(stored.tasks)) return null

  const tasks = stored.tasks
    .filter(isTask)
    .slice(0, MAX_TASKS)
    .map(({ activityId, optionId }) => ({ activityId, optionId }))

  return tasks.length > 0 ? tasks : null
}

/**
 * Replace the standing list.
 *
 * @param {GoalTask[]} tasks 1 to MAX_TASKS entries. Order is the order on the vine.
 * @returns {boolean} whether the write reached localStorage
 */
export function writeTasks(tasks) {
  const clean = (Array.isArray(tasks) ? tasks : [])
    .filter(isTask)
    .slice(0, MAX_TASKS)
    .map(({ activityId, optionId }) => ({ activityId, optionId }))

  return writeObject(GOAL_CONFIG_KEY, { tasks: clean })
}

/**
 * Forget the standing list, so the defaults apply again.
 *
 * @returns {boolean}
 */
export function clearTasks() {
  return writeObject(GOAL_CONFIG_KEY, {})
}
