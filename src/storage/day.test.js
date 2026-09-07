import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DAY_KEY, clearToday, readToday, recordCompletion, taskKey } from './day'
import { resetMemoryFallback } from './safeStorage'

/**
 * `amelia.day.v1` — what she has finished today. (GOALS.md sections 3 and 4)
 *
 * Two properties matter more than the rest and both have their own block below:
 *
 *   1. NO HISTORY EVER REACHES THE STORE. GOALS.md rejects streaks structurally
 *      rather than by policy, and the enforcement is that there is nowhere to
 *      put a second day. `the store never grows history` is that fence as a test.
 *   2. A CLOCK CHANGE NEVER DELETES HER PROGRESS. A telling-the-time app is
 *      coming and she may well move the clock. Reading on another day shows an
 *      empty vine; it must not destroy the record, so moving the clock back
 *      brings her afternoon straight back.
 */

/** Same shim as `prefs.test.js` and `scores.test.js` — they share safeStorage. */
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

const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

const MONDAY = at(2026, 9, 7, 12)
const MONDAY_LATE = at(2026, 9, 7, 23, 55)
const TUESDAY_EARLY = at(2026, 9, 8, 0, 30) // still Monday's day — before 04:00
const TUESDAY = at(2026, 9, 8, 12)

let store

beforeEach(() => {
  store = installStorage()
  resetMemoryFallback()
})

afterEach(() => {
  delete globalThis.localStorage
  resetMemoryFallback()
})

const read = () => JSON.parse(store.get(DAY_KEY))

describe('readToday', () => {
  it('is empty before she has done anything', () => {
    expect(readToday(MONDAY)).toEqual({ day: '2026-09-07', done: {} })
  })

  it('returns what was recorded today', () => {
    recordCompletion('ADD', 'to20', MONDAY)

    expect(readToday(MONDAY).done).toEqual({ 'ADD::to20': 1 })
  })

  it('counts a task done twice', () => {
    recordCompletion('ADD', 'to20', MONDAY)
    recordCompletion('ADD', 'to20', MONDAY)

    expect(readToday(MONDAY).done).toEqual({ 'ADD::to20': 2 })
  })

  it('keeps different options of one activity apart', () => {
    recordCompletion('BOND_WHOLE', 't10', MONDAY)
    recordCompletion('BOND_WHOLE', 't7', MONDAY)

    expect(readToday(MONDAY).done).toEqual({ 'BOND_WHOLE::t10': 1, 'BOND_WHOLE::t7': 1 })
  })

  it('is empty again on a new day', () => {
    recordCompletion('ADD', 'to20', MONDAY)

    expect(readToday(TUESDAY).done).toEqual({})
  })

  it('treats a late-night game as the same evening', () => {
    recordCompletion('ADD', 'to20', MONDAY_LATE)

    // 00:30 is before the 04:00 rollover, so the vine has not reset.
    expect(readToday(TUESDAY_EARLY).done).toEqual({ 'ADD::to20': 1 })
  })

  describe('untrusted stored values', () => {
    it.each([
      ['not an object', '"hello"'],
      ['null', 'null'],
      ['an array', '[]'],
      ['unparseable', '{oh no'],
    ])('falls back to an empty day when the store holds %s', (_label, raw) => {
      store.set(DAY_KEY, raw)

      expect(readToday(MONDAY)).toEqual({ day: '2026-09-07', done: {} })
    })

    it('drops entries that are not plausible counts', () => {
      store.set(
        DAY_KEY,
        JSON.stringify({
          day: '2026-09-07',
          done: { 'ADD::to20': 2, 'SUB::to20': 0, 'ROMAN::to10': -1, 'X::y': 'lots', nosep: 3 },
        })
      )

      expect(readToday(MONDAY).done).toEqual({ 'ADD::to20': 2 })
    })

    it('ignores a malformed day key', () => {
      store.set(DAY_KEY, JSON.stringify({ day: 'today', done: { 'ADD::to20': 9 } }))

      expect(readToday(MONDAY).done).toEqual({})
    })
  })
})

describe('recordCompletion', () => {
  it('reports what it stored', () => {
    const result = recordCompletion('ROMAN', 'to50', MONDAY)

    expect(result).toEqual({ day: '2026-09-07', done: { 'ROMAN::to50': 1 }, saved: true })
  })

  it('replaces the record on a genuinely new day', () => {
    recordCompletion('ADD', 'to20', MONDAY)
    recordCompletion('SUB', 'to20', TUESDAY)

    expect(read()).toEqual({ day: '2026-09-08', done: { 'SUB::to20': 1 } })
  })

  it('re-reads the store rather than trusting a caller snapshot', () => {
    recordCompletion('ADD', 'to20', MONDAY)

    // Another tab writes in between.
    store.set(DAY_KEY, JSON.stringify({ day: '2026-09-07', done: { 'ADD::to20': 1, 'ROMAN::to10': 1 } }))

    expect(recordCompletion('SUB', 'to20', MONDAY).done).toEqual({
      'ADD::to20': 1,
      'ROMAN::to10': 1,
      'SUB::to20': 1,
    })
  })

  it('records nothing for an unusable id and leaves the store alone', () => {
    recordCompletion('ADD', 'to20', MONDAY)

    expect(recordCompletion('', 'to20', MONDAY).saved).toBe(false)
    expect(recordCompletion('ADD', null, MONDAY).saved).toBe(false)
    expect(read().done).toEqual({ 'ADD::to20': 1 })
  })

  it('does not throw when localStorage refuses the write', () => {
    installStorage({ failWrites: true })
    resetMemoryFallback()

    const result = recordCompletion('ADD', 'to20', MONDAY)

    expect(result.saved).toBe(false)
    expect(result.done).toEqual({ 'ADD::to20': 1 })
    // The in-memory fallback keeps the tab honest for the rest of the session.
    expect(readToday(MONDAY).done).toEqual({ 'ADD::to20': 1 })
  })
})

describe('a clock change never deletes her progress', () => {
  it('reading on another day does not touch the stored record', () => {
    recordCompletion('ADD', 'to20', MONDAY)

    readToday(TUESDAY)

    expect(read()).toEqual({ day: '2026-09-07', done: { 'ADD::to20': 1 } })
  })

  it('moving the clock forward and back brings her afternoon back', () => {
    recordCompletion('ADD', 'to20', MONDAY)
    recordCompletion('ROMAN', 'to10', MONDAY)

    // She sets the clock to next week, sees an empty vine...
    expect(readToday(at(2026, 9, 14, 12)).done).toEqual({})

    // ...and puts it back.
    expect(readToday(MONDAY).done).toEqual({ 'ADD::to20': 1, 'ROMAN::to10': 1 })
  })

  it('survives the clock going backwards to last year', () => {
    recordCompletion('ADD', 'to20', MONDAY)

    expect(readToday(at(2025, 1, 1, 12)).done).toEqual({})
    expect(readToday(MONDAY).done).toEqual({ 'ADD::to20': 1 })
  })

  it('only an actual completion on another day replaces it', () => {
    recordCompletion('ADD', 'to20', MONDAY)
    recordCompletion('SUB', 'to20', TUESDAY)

    expect(readToday(MONDAY).done).toEqual({})
  })
})

describe('the store never grows history', () => {
  it('holds exactly one day and nothing that could become a streak', () => {
    recordCompletion('ADD', 'to20', MONDAY)
    recordCompletion('SUB', 'to20', TUESDAY)
    recordCompletion('ROMAN', 'to10', at(2026, 9, 9, 12))

    const stored = read()

    expect(Object.keys(stored).sort()).toEqual(['day', 'done'])
    expect(stored.day).toBe('2026-09-09')

    // GOALS.md section 4: no lastPlayedDate, no days-since, no rolling window.
    const asText = JSON.stringify(stored)
    for (const forbidden of ['lastPlayed', 'streak', 'history', 'days', '2026-09-07', '2026-09-08']) {
      expect(asText).not.toContain(forbidden)
    }
  })
})

describe('taskKey', () => {
  it('uses the same :: separator as the score keys', () => {
    expect(taskKey('ADD', 'to20')).toBe('ADD::to20')
  })
})

describe('clearToday', () => {
  it('forgets today', () => {
    recordCompletion('ADD', 'to20', MONDAY)
    clearToday()

    expect(readToday(MONDAY).done).toEqual({})
  })
})
