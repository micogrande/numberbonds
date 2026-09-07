import { describe, expect, it } from 'vitest'

import { defaultTasks, deriveGoals, listableActivities, resolveTasks } from './goals'
import { ACTIVITIES } from '../activities/registry'

/**
 * The join between the standing to-do list, today's completions and the
 * registry. (GOALS.md section 2)
 *
 * The headline behaviour is `duplicates`: listing one activity twice is a
 * legitimate way to say "do this twice", and it is the only rule here that is
 * not obvious from the types.
 */

const task = (activityId, optionId) => ({ activityId, optionId })

describe('defaultTasks', () => {
  it('is never empty, so the vine always has something on it', () => {
    expect(defaultTasks().length).toBeGreaterThan(0)
  })

  it('gives three tasks', () => {
    expect(defaultTasks()).toHaveLength(3)
  })

  it('names only activities that exist, with options that exist', () => {
    for (const { activityId, optionId } of defaultTasks()) {
      const activity = ACTIVITIES.find((a) => a.id === activityId)

      expect(activity, `unknown activity ${activityId}`).toBeTruthy()
      expect(activity.options.some((o) => o.id === optionId), `unknown option ${optionId}`).toBe(true)
    }
  })

  it('does not repeat an activity', () => {
    const ids = defaultTasks().map((t) => t.activityId)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('resolveTasks', () => {
  it('resolves a stored list against the registry', () => {
    const [first] = listableActivities()
    const resolved = resolveTasks([task(first.id, first.options[0].id)])

    expect(resolved).toHaveLength(1)
    expect(resolved[0].activity.id).toBe(first.id)
    expect(resolved[0].option.id).toBe(first.options[0].id)
    expect(resolved[0].key).toBe(`${first.id}::${first.options[0].id}`)
  })

  it('falls back to the defaults when nothing is stored', () => {
    expect(resolveTasks(null).map((t) => t.activityId)).toEqual(defaultTasks().map((t) => t.activityId))
    expect(resolveTasks([]).map((t) => t.activityId)).toEqual(defaultTasks().map((t) => t.activityId))
  })

  it('drops a task naming an activity that no longer exists', () => {
    const [first] = listableActivities()
    const resolved = resolveTasks([task('GONE_FOREVER', 'x'), task(first.id, first.options[0].id)])

    expect(resolved).toHaveLength(1)
    expect(resolved[0].activityId).toBe(first.id)
  })

  it('keeps the activity when only its option has gone, using that activity default', () => {
    const [first] = listableActivities()
    const resolved = resolveTasks([task(first.id, 'an-option-from-a-past-recipe')])

    expect(resolved).toHaveLength(1)
    expect(resolved[0].activityId).toBe(first.id)
    expect(first.options.some((o) => o.id === resolved[0].optionId)).toBe(true)
  })

  it('falls back to the defaults when every stored task is unresolvable', () => {
    expect(resolveTasks([task('NOPE', 'x'), task('ALSO_NOPE', 'y')]).length).toBeGreaterThan(0)
  })

  it('never returns more than four, however many are stored', () => {
    const [first] = listableActivities()
    const many = Array.from({ length: 9 }, () => task(first.id, first.options[0].id))

    expect(resolveTasks(many)).toHaveLength(4)
  })

  it('numbers repeated tasks so two flowers are distinguishable', () => {
    const [first] = listableActivities()
    const id = first.options[0].id
    const resolved = resolveTasks([task(first.id, id), task(first.id, id)])

    expect(resolved.map((t) => t.occurrence)).toEqual([1, 2])
  })
})

describe('deriveGoals', () => {
  const [a, b] = listableActivities()
  const taskA = resolveTasks([task(a.id, a.options[0].id)])[0]
  const taskB = resolveTasks([task(b.id, b.options[0].id)])[0]

  it('blooms nothing on an empty day', () => {
    const day = deriveGoals([taskA, taskB], {})

    expect(day.completed).toBe(0)
    expect(day.total).toBe(2)
    expect(day.allDone).toBe(false)
    expect(day.tasks.map((t) => t.done)).toEqual([false, false])
  })

  it('blooms the task she finished', () => {
    const day = deriveGoals([taskA, taskB], { [taskA.key]: 1 })

    expect(day.tasks.map((t) => t.done)).toEqual([true, false])
    expect(day.completed).toBe(1)
    expect(day.allDone).toBe(false)
  })

  it('reports a finished day', () => {
    const day = deriveGoals([taskA, taskB], { [taskA.key]: 1, [taskB.key]: 1 })

    expect(day.completed).toBe(2)
    expect(day.allDone).toBe(true)
  })

  it('does not bloom anything for an activity that is not on the list', () => {
    const day = deriveGoals([taskA], { 'SOMETHING::else': 4 })

    expect(day.completed).toBe(0)
  })

  describe('duplicates', () => {
    const twice = resolveTasks([task(a.id, a.options[0].id), task(a.id, a.options[0].id)])

    it('one finished session blooms only the first of two', () => {
      const day = deriveGoals(twice, { [taskA.key]: 1 })

      expect(day.tasks.map((t) => t.done)).toEqual([true, false])
      expect(day.completed).toBe(1)
      expect(day.allDone).toBe(false)
    })

    it('two finished sessions bloom both', () => {
      const day = deriveGoals(twice, { [taskA.key]: 2 })

      expect(day.tasks.map((t) => t.done)).toEqual([true, true])
      expect(day.allDone).toBe(true)
    })

    it('a third session does not overflow onto anything else', () => {
      const day = deriveGoals([...twice, taskB], { [taskA.key]: 3 })

      expect(day.tasks.map((t) => t.done)).toEqual([true, true, false])
      expect(day.completed).toBe(2)
    })
  })

  it('an empty list is not a finished day', () => {
    expect(deriveGoals([], {}).allDone).toBe(false)
  })

  it('tolerates a missing completions object', () => {
    expect(deriveGoals([taskA], undefined).completed).toBe(0)
  })
})
