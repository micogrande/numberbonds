import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetMemoryFallback } from './safeStorage'
import { SCORES_KEY, beatsBest, getBest, readAllBests, recordResult, scoreKey } from './scores'

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

const BONDS = { id: 'BOND_WHOLE', version: 1 }
const T10 = { id: 't10' }

let store

beforeEach(() => {
  resetMemoryFallback()
  store = installStorage()
})

afterEach(() => {
  delete globalThis.localStorage
  resetMemoryFallback()
  vi.restoreAllMocks()
})

describe('scoreKey', () => {
  it('builds PLAN 2.6 keys', () => {
    expect(scoreKey({ id: 'BOND_WHOLE', version: 1 }, { id: 't10' })).toBe('BOND_WHOLE::t10::v1')
    expect(scoreKey({ id: 'ADD', version: 1 }, { id: 'to20' })).toBe('ADD::to20::v1')
    expect(scoreKey({ id: 'ROMAN', version: 1 }, { id: 'to100' })).toBe('ROMAN::to100::v1')
  })

  it('is versioned, so a recipe bump does not compare against old runs', () => {
    expect(scoreKey({ id: 'ADD', version: 2 }, { id: 'to20' })).toBe('ADD::to20::v2')
  })

  // Parseable by construction is the entire reason for `::`.
  it('refuses an id containing the separator', () => {
    expect(() => scoreKey({ id: 'A::B', version: 1 }, { id: 't10' })).toThrow(/"::"/)
    expect(() => scoreKey({ id: 'ADD', version: 1 }, { id: 'a::b' })).toThrow(/"::"/)
  })

  it('refuses a missing id or version', () => {
    expect(() => scoreKey({ version: 1 }, { id: 't10' })).toThrow(TypeError)
    expect(() => scoreKey({ id: 'ADD' }, { id: 't10' })).toThrow(TypeError)
    expect(() => scoreKey({ id: 'ADD', version: 1 }, {})).toThrow(TypeError)
  })
})

describe('recordResult', () => {
  it('stores a first winning result as both a first result and a record', () => {
    const out = recordResult(BONDS, T10, { score: 8, total: 11, wallMs: 42_000, playedAt: 5 })

    expect(out.isFirstResult).toBe(true)
    expect(out.isNewRecord).toBe(true)
    expect(out.previousBest).toBe(null)
    expect(out.saved).toBe(true)
    expect(out.record).toEqual({
      score: 8,
      total: 11,
      wallMs: 42_000,
      recipeVersion: 1,
      playedAt: 5,
      plays: 1,
    })
    expect(readAllBests()['BOND_WHOLE::t10::v1'].score).toBe(8)
  })

  // PLAN 5, high: "First session is unconditionally a personal best — 0/11 fires
  // the trophy and 200 particles of confetti."
  it('never calls a zero a personal best, even on a fresh browser', () => {
    const out = recordResult(BONDS, T10, { score: 0, total: 11, wallMs: 30_000 })

    expect(out.isFirstResult).toBe(true)
    expect(out.isNewRecord).toBe(false)
    expect(out.record).toBe(null)
    expect(readAllBests()).toEqual({})
  })

  it('reports isFirstResult and isNewRecord separately', () => {
    recordResult(BONDS, T10, { score: 5, total: 11, wallMs: 60_000 })
    const second = recordResult(BONDS, T10, { score: 3, total: 11, wallMs: 10_000 })

    expect(second.isFirstResult).toBe(false)
    expect(second.isNewRecord).toBe(false)
    expect(second.previousBest.score).toBe(5)
  })

  it('beats a record on score, and on time at an equal score', () => {
    recordResult(BONDS, T10, { score: 8, total: 11, wallMs: 40_000 })

    expect(recordResult(BONDS, T10, { score: 9, total: 11, wallMs: 90_000 }).isNewRecord).toBe(true)
    expect(recordResult(BONDS, T10, { score: 9, total: 11, wallMs: 89_999 }).isNewRecord).toBe(true)
    expect(recordResult(BONDS, T10, { score: 9, total: 11, wallMs: 89_999 }).isNewRecord).toBe(false)
    expect(getBest(BONDS, T10).wallMs).toBe(89_999)
  })

  it('keeps the best untouched on a worse run but counts the play', () => {
    recordResult(BONDS, T10, { score: 9, total: 11, wallMs: 40_000, playedAt: 1 })
    recordResult(BONDS, T10, { score: 2, total: 11, wallMs: 20_000, playedAt: 2 })

    expect(getBest(BONDS, T10)).toEqual({
      score: 9,
      total: 11,
      wallMs: 40_000,
      recipeVersion: 1,
      playedAt: 1,
      plays: 2,
    })
  })

  it('stores the total, so the summary has a denominator', () => {
    recordResult(BONDS, { id: 't20' }, { score: 15, total: 18, wallMs: 70_000 })
    expect(getBest(BONDS, { id: 't20' }).total).toBe(18)
  })

  it('keeps the two bond activities apart', () => {
    recordResult({ id: 'BOND_WHOLE', version: 1 }, T10, { score: 11, total: 11, wallMs: 50_000 })
    recordResult({ id: 'BOND_PARTS', version: 1 }, T10, { score: 4, total: 8, wallMs: 50_000 })

    expect(getBest({ id: 'BOND_WHOLE', version: 1 }, T10).score).toBe(11)
    expect(getBest({ id: 'BOND_PARTS', version: 1 }, T10).score).toBe(4)
  })

  // The bug this whole step exists to kill: a storage failure must not throw out
  // of the session-complete path.
  it('returns saved:false instead of throwing when the write fails', () => {
    installStorage({ failWrites: true })

    let out
    expect(() => {
      out = recordResult(BONDS, T10, { score: 8, total: 11, wallMs: 42_000 })
    }).not.toThrow()

    expect(out.saved).toBe(false)
    expect(out.isNewRecord).toBe(true)
  })

  it('survives a corrupted store rather than throwing', () => {
    store.set(SCORES_KEY, 'null')
    expect(recordResult(BONDS, T10, { score: 3, total: 11, wallMs: 1_000 }).isFirstResult).toBe(true)

    store.set(SCORES_KEY, JSON.stringify({ 'BOND_WHOLE::t10::v1': 'not a record' }))
    const out = recordResult(BONDS, T10, { score: 3, total: 11, wallMs: 1_000 })
    expect(out.isFirstResult).toBe(true)
    expect(out.isNewRecord).toBe(true)
  })

  it('refuses a malformed result without throwing or poisoning the store', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    recordResult(BONDS, T10, { score: 9, total: 11, wallMs: 40_000 })

    const out = recordResult(BONDS, T10, { score: Number.NaN, total: 11, wallMs: 40_000 })

    expect(out.isNewRecord).toBe(false)
    expect(out.saved).toBe(false)
    expect(getBest(BONDS, T10).score).toBe(9)
  })
})

// The ranking rule, checked directly, because a second caller now depends on it:
// the summary asks it whether to draw a trophy, using the best that was standing
// when the session began. If the two ever disagreed, a run could be congratulated
// and not saved — or saved and not congratulated.
describe('beatsBest', () => {
  const best = { score: 10, total: 11, wallMs: 30_000 }

  it('agrees with what recordResult decides to write', () => {
    recordResult(BONDS, T10, { score: 10, total: 11, wallMs: 30_000 })
    const stored = getBest(BONDS, T10)

    for (const result of [
      { score: 11, wallMs: 45_000 },
      { score: 10, wallMs: 29_999 },
      { score: 10, wallMs: 30_001 },
      { score: 9, wallMs: 1_000 },
      { score: 0, wallMs: 1_000 },
    ]) {
      const decided = recordResult(BONDS, T10, { ...result, total: 11 }).isNewRecord
      expect(beatsBest(stored, result)).toBe(decided)
      if (decided) store.set(SCORES_KEY, JSON.stringify({ 'BOND_WHOLE::t10::v1': stored }))
    }
  })

  it('treats nothing stored as beatable, but never by a zero', () => {
    expect(beatsBest(null, { score: 1, wallMs: 9_000 })).toBe(true)
    expect(beatsBest(null, { score: 0, wallMs: 9_000 })).toBe(false)
  })

  it('breaks a tie on wall-clock time, which is the ranking PLAN 2.6 keeps', () => {
    expect(beatsBest(best, { score: 10, wallMs: 29_999 })).toBe(true)
    expect(beatsBest(best, { score: 10, wallMs: 30_000 })).toBe(false)
  })

  it('says no to a result it cannot read', () => {
    expect(beatsBest(best, { score: Number.NaN, wallMs: 1 })).toBe(false)
    expect(beatsBest(best, undefined)).toBe(false)
  })
})
