import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetMemoryFallback } from './safeStorage'
import { SCORES_KEY, readAllBests } from './scores'
import {
  BONDS_MIGRATION_ID,
  LEGACY_SCORES_KEY,
  MIGRATIONS_KEY,
  legacyDeckTotal,
  migrateLegacyScores,
  parseLegacyKey,
} from './migrations'

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

/** Put a legacy `number_bonds_scores` blob in place. */
function seedLegacy(store, entries) {
  store.set(LEGACY_SCORES_KEY, JSON.stringify(entries))
}

let store

beforeEach(() => {
  resetMemoryFallback()
  store = installStorage()
})

afterEach(() => {
  delete globalThis.localStorage
  resetMemoryFallback()
})

describe('parseLegacyKey', () => {
  // The trap PLAN 2.6 names: prefix-match longest-first, because
  // `PRACTICE_PARTS_10` must not parse as mode PRACTICE, target `PARTS_10`.
  it('reads PRACTICE_PARTS_10 as the parts activity, not as PRACTICE', () => {
    const parsed = parseLegacyKey('PRACTICE_PARTS_10')

    expect(parsed.mode).toBe('PRACTICE_PARTS')
    expect(parsed.target).toBe(10)
    expect(parsed.activity.id).toBe('BOND_PARTS')
  })

  it('reads PRACTICE_10 as the whole activity', () => {
    const parsed = parseLegacyKey('PRACTICE_10')

    expect(parsed.mode).toBe('PRACTICE')
    expect(parsed.target).toBe(10)
    expect(parsed.activity.id).toBe('BOND_WHOLE')
  })

  it('rejects anything it cannot read', () => {
    expect(parseLegacyKey('PRACTICE_PARTS_ten')).toBe(null)
    expect(parseLegacyKey('PRACTICE_')).toBe(null)
    expect(parseLegacyKey('SOMETHING_10')).toBe(null)
    expect(parseLegacyKey('')).toBe(null)
    expect(parseLegacyKey(undefined)).toBe(null)
  })

  it('rejects a target whose deck would be empty', () => {
    // generateMixedDeck(2) covers wholes 3..2 — no cards at all.
    expect(parseLegacyKey('PRACTICE_PARTS_2')).toBe(null)
  })
})

describe('legacyDeckTotal', () => {
  // generateDeck(n) yields n+1 cards; generateMixedDeck(n) yields n-2.
  // PLAN 4.1 pins the two the tests care about: 11 for whole=10, 18 for mixed(20).
  it('reconstructs the deck size the old records never stored', () => {
    expect(legacyDeckTotal('PRACTICE', 10)).toBe(11)
    expect(legacyDeckTotal('PRACTICE', 20)).toBe(21)
    expect(legacyDeckTotal('PRACTICE_PARTS', 20)).toBe(18)
    expect(legacyDeckTotal('PRACTICE_PARTS', 10)).toBe(8)
    expect(legacyDeckTotal('PRACTICE_PARTS', 3)).toBe(1)
  })

  it('returns nothing usable for a mode it does not know', () => {
    expect(legacyDeckTotal('SUMMARY', 10)).toBe(0)
  })
})

describe('migrateLegacyScores', () => {
  it('rescues the real high scores under the new key scheme', () => {
    seedLegacy(store, {
      PRACTICE_10: { score: 10, time: 61_000, date: 1_700_000_000_000 },
      PRACTICE_PARTS_10: { score: 7, time: 45_000, date: 1_700_000_001_000 },
      PRACTICE_20: { score: 19, time: 120_000, date: 1_700_000_002_000 },
    })

    const out = migrateLegacyScores()
    const bests = readAllBests()

    expect(out).toEqual({ ran: true, migrated: 3, dropped: 0, saved: true })
    expect(bests['BOND_WHOLE::t10::v1']).toEqual({
      score: 10,
      total: 11,
      wallMs: 61_000,
      recipeVersion: 1,
      playedAt: 1_700_000_000_000,
      plays: 1,
    })
    expect(bests['BOND_PARTS::t10::v1']).toEqual({
      score: 7,
      total: 8,
      wallMs: 45_000,
      recipeVersion: 1,
      playedAt: 1_700_000_001_000,
      plays: 1,
    })
    expect(bests['BOND_WHOLE::t20::v1'].total).toBe(21)
  })

  // The trap again, end to end: both of a target's scores must survive, and
  // neither may land on the other's key.
  it('keeps the two activities for one target apart', () => {
    seedLegacy(store, {
      PRACTICE_10: { score: 10, time: 61_000, date: 1 },
      PRACTICE_PARTS_10: { score: 7, time: 45_000, date: 2 },
    })

    migrateLegacyScores()
    const bests = readAllBests()

    expect(Object.keys(bests).sort()).toEqual(['BOND_PARTS::t10::v1', 'BOND_WHOLE::t10::v1'])
    expect(bests['BOND_WHOLE::t10::v1'].score).toBe(10)
    expect(bests['BOND_PARTS::t10::v1'].score).toBe(7)
  })

  it('drops the score-0 records the old first-session bug wrote', () => {
    seedLegacy(store, {
      PRACTICE_10: { score: 0, time: 30_000, date: 1 },
      PRACTICE_11: { score: 4, time: 30_000, date: 2 },
    })

    const out = migrateLegacyScores()

    expect(out.migrated).toBe(1)
    expect(out.dropped).toBe(1)
    expect(readAllBests()['BOND_WHOLE::t10::v1']).toBeUndefined()
    expect(readAllBests()['BOND_WHOLE::t11::v1'].score).toBe(4)
  })

  it('drops keys it cannot parse and entries it cannot trust', () => {
    seedLegacy(store, {
      PRACTICE_PARTS_ten: { score: 5, time: 1_000, date: 1 },
      NONSENSE: { score: 5, time: 1_000, date: 1 },
      PRACTICE_12: { score: 'lots', time: 1_000, date: 1 },
      PRACTICE_13: null,
    })

    const out = migrateLegacyScores()

    expect(out.migrated).toBe(0)
    expect(out.dropped).toBe(4)
    expect(readAllBests()).toEqual({})
  })

  it('never clobbers an existing key', () => {
    store.set(
      SCORES_KEY,
      JSON.stringify({
        'BOND_WHOLE::t10::v1': {
          score: 11,
          total: 11,
          wallMs: 50_000,
          recipeVersion: 1,
          playedAt: 9,
          plays: 3,
        },
      })
    )
    seedLegacy(store, { PRACTICE_10: { score: 10, time: 61_000, date: 1 } })

    const out = migrateLegacyScores()

    expect(out.migrated).toBe(0)
    expect(out.dropped).toBe(1)
    expect(readAllBests()['BOND_WHOLE::t10::v1'].score).toBe(11)
  })

  // React StrictMode double-invokes everything in dev.
  it('is idempotent — a second run changes nothing', () => {
    seedLegacy(store, { PRACTICE_10: { score: 10, time: 61_000, date: 1 } })

    const first = migrateLegacyScores()
    const before = store.get(SCORES_KEY)
    const second = migrateLegacyScores()

    expect(first.migrated).toBe(1)
    expect(second).toEqual({ ran: false, migrated: 0, dropped: 0, saved: true })
    expect(store.get(SCORES_KEY)).toBe(before)
  })

  it('is idempotent even if the applied flag is lost', () => {
    seedLegacy(store, { PRACTICE_10: { score: 10, time: 61_000, date: 1 } })
    migrateLegacyScores()

    store.set(MIGRATIONS_KEY, JSON.stringify({ applied: [] }))
    const second = migrateLegacyScores()

    expect(second.migrated).toBe(0)
    expect(readAllBests()['BOND_WHOLE::t10::v1'].score).toBe(10)
    expect(Object.keys(readAllBests())).toHaveLength(1)
  })

  it('records itself as applied', () => {
    migrateLegacyScores()
    expect(JSON.parse(store.get(MIGRATIONS_KEY)).applied).toEqual([BONDS_MIGRATION_ID])
  })

  it('keeps other applied migrations in the list', () => {
    store.set(MIGRATIONS_KEY, JSON.stringify({ applied: ['something-else'] }))
    migrateLegacyScores()

    expect(JSON.parse(store.get(MIGRATIONS_KEY)).applied).toEqual([
      'something-else',
      BONDS_MIGRATION_ID,
    ])
  })

  it('leaves the old key in place as a backup', () => {
    const raw = JSON.stringify({ PRACTICE_10: { score: 10, time: 61_000, date: 1 } })
    store.set(LEGACY_SCORES_KEY, raw)

    migrateLegacyScores()

    expect(store.get(LEGACY_SCORES_KEY)).toBe(raw)
  })

  it('is a quiet no-op on a browser with nothing stored', () => {
    const out = migrateLegacyScores()

    expect(out).toEqual({ ran: true, migrated: 0, dropped: 0, saved: true })
    expect(readAllBests()).toEqual({})
  })

  it('shrugs off a corrupted legacy blob', () => {
    store.set(LEGACY_SCORES_KEY, 'not json at all')

    expect(() => migrateLegacyScores()).not.toThrow()
    expect(readAllBests()).toEqual({})
  })

  it('does not mark itself applied when storage refuses the write', () => {
    const failing = installStorage({ failWrites: true })
    seedLegacy(failing, { PRACTICE_10: { score: 10, time: 61_000, date: 1 } })

    const out = migrateLegacyScores()

    expect(out).toEqual({ ran: true, migrated: 0, dropped: 0, saved: false })
    expect(failing.has(MIGRATIONS_KEY)).toBe(false)
  })
})
