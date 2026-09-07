/**
 * The day's to-do list, resolved. (GOALS.md)
 *
 * This is the join: `storage/goalConfig` holds opaque ids, `storage/day` holds
 * opaque counts, and the registry knows what any of it means. Neither storage
 * file may name an activity (PLAN 2), so the knowing happens here.
 *
 * ── THE RULES THIS FILE IMPLEMENTS ──────────────────────────────────────────
 *
 * From GOALS.md section 2, all of them owner decisions:
 *
 *   - A task names an activity AND an option. "Bonds to 10" and "Bonds to 20"
 *     are different practice.
 *   - A duplicate task is honoured: listing Addition twice is two flowers and
 *     needs two finished sessions.
 *   - Completion is contingent on FINISHING, never on score. A session scored
 *     4/18 blooms its flower exactly as 18/18 does.
 *   - Playing something not on the list is never punished. It blooms nothing and
 *     still records personal bests. There is no ceiling.
 *
 * ── PURE CORE, THIN SHELL ───────────────────────────────────────────────────
 *
 * `deriveGoals` is a pure function of (tasks, done). Everything that touches
 * localStorage is in `readGoals`, which is four lines. The interesting logic —
 * how duplicates consume completions — is therefore testable without a store.
 */

import { ACTIVITIES, defaultOption, findOption, getActivityById } from '../activities/registry'
import { readToday, taskKey } from '../storage/day'
import { MAX_TASKS, readTasks } from '../storage/goalConfig'

/**
 * The ids we would like the starting vine to hold, best first.
 *
 * Only a preference. Each is looked up in the registry and skipped if it is not
 * there, and the list is topped up from whatever else exists, so deleting an
 * activity degrades this to "three other activities" instead of to a crash. That
 * is why this is a list of ids rather than three imported manifests.
 *
 * GOALS.md: "**No list set yet** falls back to one Bonds to 10, one Addition,
 * one Roman numerals up to 10 — never an empty vine."
 */
const PREFERRED_DEFAULT_IDS = ['BOND_WHOLE', 'ADD', 'ROMAN']

/** How many tasks a dad who has not chosen gets. */
const DEFAULT_TASK_COUNT = 3

/**
 * @typedef {Object} ResolvedTask
 * @property {string} activityId
 * @property {string} optionId
 * @property {import('../activities/manifestSchema').ActivityManifest} activity
 * @property {import('../activities/manifestSchema').ActivityOption} option
 * @property {string} key       `activityId::optionId`, the completion key.
 * @property {number} occurrence 1 for the first listing of this task, 2 for the second.
 */

/**
 * Turn one stored `{activityId, optionId}` into something renderable, or null.
 *
 * Null is expected, not exceptional: ids outlive the things they name. A task
 * whose activity is gone is dropped; a task whose *option* is gone falls back to
 * that activity's default option, because "Bonds to 7" disappearing is a recipe
 * change and she should still get her bonds practice.
 *
 * @param {{activityId: string, optionId: string}} task
 * @returns {Omit<ResolvedTask, 'occurrence'>|null}
 */
function resolveOne(task) {
  const activity = getActivityById(task?.activityId)
  if (!activity) return null

  const option = findOption(activity, task.optionId) ?? defaultOption(activity)
  if (!option) return null

  return { activityId: activity.id, optionId: option.id, activity, option, key: taskKey(activity.id, option.id) }
}

/**
 * The list a dad who has not chosen anything gets.
 *
 * @returns {{activityId: string, optionId: string}[]}
 */
export function defaultTasks() {
  const chosen = []
  const seen = new Set()

  const take = (activity) => {
    if (!activity || seen.has(activity.id) || chosen.length >= DEFAULT_TASK_COUNT) return
    const option = defaultOption(activity)
    if (!option) return

    seen.add(activity.id)
    chosen.push({ activityId: activity.id, optionId: option.id })
  }

  for (const id of PREFERRED_DEFAULT_IDS) take(getActivityById(id))

  // Top up if the preferred ones are not all there any more.
  if (chosen.length < DEFAULT_TASK_COUNT) {
    for (const activity of listableActivities()) take(activity)
  }

  return chosen
}

/**
 * Every activity a task may name, in a stable order.
 *
 * Hidden activities are excluded — a manifest marked `hidden` is staging work,
 * and a dad should not be able to put one on the vine by accident.
 *
 * @returns {import('../activities/manifestSchema').ActivityManifest[]}
 */
export function listableActivities() {
  return ACTIVITIES.filter((activity) => !activity.hidden)
    .slice()
    .sort((a, b) => a.order - b.order)
}

/**
 * Resolve a stored list against the registry, substituting defaults if needed.
 *
 * @param {{activityId: string, optionId: string}[]|null} storedTasks
 * @returns {ResolvedTask[]}
 */
export function resolveTasks(storedTasks) {
  const source = Array.isArray(storedTasks) && storedTasks.length > 0 ? storedTasks : defaultTasks()

  const resolved = []
  const counts = new Map()

  for (const task of source.slice(0, MAX_TASKS)) {
    const one = resolveOne(task)
    if (!one) continue

    const occurrence = (counts.get(one.key) ?? 0) + 1
    counts.set(one.key, occurrence)
    resolved.push({ ...one, occurrence })
  }

  // Everything the dad chose was unresolvable. Rather than an empty vine, fall
  // back — but only once, and only if we were not already looking at defaults.
  if (resolved.length === 0 && source !== storedTasks) return []
  if (resolved.length === 0) return resolveTasks(null)

  return resolved
}

/**
 * @typedef {ResolvedTask & { done: boolean }} GoalTaskState
 */

/**
 * The vine, given a resolved list and today's completion counts.
 *
 * Duplicates consume completions in order: with Addition listed twice and one
 * finished session, the first flower is bloomed and the second is not.
 *
 * @param {ResolvedTask[]} tasks
 * @param {Record<string, number>} done
 * @returns {{ tasks: GoalTaskState[], completed: number, total: number, allDone: boolean }}
 */
export function deriveGoals(tasks, done) {
  const counts = { ...(done ?? {}) }

  const states = tasks.map((task) => {
    const remaining = counts[task.key] ?? 0

    if (remaining > 0) {
      counts[task.key] = remaining - 1
      return { ...task, done: true }
    }

    return { ...task, done: false }
  })

  const completed = states.filter((task) => task.done).length

  return {
    tasks: states,
    completed,
    total: states.length,
    allDone: states.length > 0 && completed === states.length,
  }
}

/**
 * The vine as it should be drawn right now.
 *
 * @param {number|Date} now
 * @returns {{ tasks: GoalTaskState[], completed: number, total: number, allDone: boolean }}
 */
export function readGoals(now) {
  return deriveGoals(resolveTasks(readTasks()), readToday(now).done)
}
