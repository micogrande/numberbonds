import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GOAL_CONFIG_KEY, MAX_TASKS, clearTasks, readTasks, writeTasks } from './goalConfig'
import { resetMemoryFallback } from './safeStorage'

/**
 * `amelia.goals.v1` — the standing to-do list. (GOALS.md section 1)
 *
 * It is STANDING: set once, applies every day. The two things worth testing are
 * that an unset list is distinguishable from an empty one (so `goals.js` knows
 * to substitute defaults) and that nothing malformed survives a read, because
 * this is user-editable text and a malformed task is a flower that can never
 * bloom.
 */

function installStorage({ failWrites = false } = {}) {
  const store = new Map()

  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem(key, value) {
      if (failWrites) throw new Error('QuotaExceededError')
      store.set(key, String(value))
    },
  }

  return store
}

const task = (activityId, optionId) => ({ activityId, optionId })

let store

beforeEach(() => {
  store = installStorage()
  resetMemoryFallback()
})

afterEach(() => {
  delete globalThis.localStorage
  resetMemoryFallback()
})

describe('readTasks', () => {
  it('is null before anyone has chosen', () => {
    expect(readTasks()).toBeNull()
  })

  it('returns what was written, in order', () => {
    writeTasks([task('ADD', 'to20'), task('ROMAN', 'to10')])

    expect(readTasks()).toEqual([task('ADD', 'to20'), task('ROMAN', 'to10')])
  })

  it('keeps a deliberate duplicate — it means "do this twice"', () => {
    writeTasks([task('ADD', 'to20'), task('ADD', 'to20')])

    expect(readTasks()).toHaveLength(2)
  })

  it('is null rather than empty when the list was cleared', () => {
    writeTasks([task('ADD', 'to20')])
    clearTasks()

    expect(readTasks()).toBeNull()
  })

  describe('untrusted stored values', () => {
    it.each([
      ['not an object', '"hello"'],
      ['null', 'null'],
      ['unparseable', '{oh no'],
      ['no tasks array', '{"tasks":"lots"}'],
    ])('is null when the store holds %s', (_label, raw) => {
      store.set(GOAL_CONFIG_KEY, raw)

      expect(readTasks()).toBeNull()
    })

    it('drops malformed entries and keeps the good ones', () => {
      store.set(
        GOAL_CONFIG_KEY,
        JSON.stringify({
          tasks: [
            { activityId: 'ADD', optionId: 'to20' },
            { activityId: '', optionId: 'to20' },
            { activityId: 'SUB' },
            null,
            'ROMAN',
            { activityId: 'ROMAN', optionId: 'to10' },
          ],
        })
      )

      expect(readTasks()).toEqual([task('ADD', 'to20'), task('ROMAN', 'to10')])
    })

    it('is null when every entry is malformed', () => {
      store.set(GOAL_CONFIG_KEY, JSON.stringify({ tasks: [null, 3, {}] }))

      expect(readTasks()).toBeNull()
    })

    it('ignores extra fields somebody added by hand', () => {
      store.set(
        GOAL_CONFIG_KEY,
        JSON.stringify({ tasks: [{ activityId: 'ADD', optionId: 'to20', streak: 12 }] })
      )

      expect(readTasks()).toEqual([task('ADD', 'to20')])
    })
  })
})

describe('writeTasks', () => {
  it('caps the list at four, because the vine holds four blooms', () => {
    writeTasks(Array.from({ length: 9 }, () => task('ADD', 'to20')))

    expect(readTasks()).toHaveLength(MAX_TASKS)
  })

  it('stores only the two fields it needs', () => {
    writeTasks([{ activityId: 'ADD', optionId: 'to20', note: 'her favourite' }])

    expect(JSON.parse(store.get(GOAL_CONFIG_KEY)).tasks[0]).toEqual(task('ADD', 'to20'))
  })

  it('does not throw when localStorage refuses the write', () => {
    installStorage({ failWrites: true })
    resetMemoryFallback()

    expect(writeTasks([task('ADD', 'to20')])).toBe(false)
    // The fallback keeps the tab consistent for the rest of the session.
    expect(readTasks()).toEqual([task('ADD', 'to20')])
  })

  it('ignores a non-array', () => {
    writeTasks(null)

    expect(readTasks()).toBeNull()
  })
})
