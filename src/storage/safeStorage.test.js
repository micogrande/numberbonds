import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readObject, resetMemoryFallback, writeObject } from './safeStorage'

/**
 * A localStorage good enough to test against, with a switch for the two failure
 * modes that actually happen: Safari private browsing (setItem throws) and a
 * browser with site data blocked (every access throws).
 */
function installStorage({ failWrites = false, failEverything = false } = {}) {
  const store = new Map()

  globalThis.localStorage = {
    getItem(key) {
      if (failEverything) throw new Error('SecurityError: storage is blocked')
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      if (failEverything || failWrites) throw new Error('QuotaExceededError')
      store.set(key, String(value))
    },
  }

  return store
}

beforeEach(() => {
  resetMemoryFallback()
  installStorage()
})

afterEach(() => {
  delete globalThis.localStorage
  resetMemoryFallback()
})

describe('readObject', () => {
  it('round-trips an object', () => {
    writeObject('k', { a: 1 })
    expect(readObject('k')).toEqual({ a: 1 })
  })

  it('returns the fallback for a missing key', () => {
    expect(readObject('nope', { empty: true })).toEqual({ empty: true })
    expect(readObject('nope')).toBe(null)
  })

  it('returns the fallback for unparseable JSON instead of throwing', () => {
    installStorage().set('k', '{ not json')
    expect(readObject('k', {})).toEqual({})
  })

  it('rejects a successfully-parsed null — JSON.parse("null") does not throw', () => {
    installStorage().set('k', 'null')
    expect(readObject('k', { fallback: true })).toEqual({ fallback: true })
  })

  it('rejects parsed primitives and arrays, because every store here is a record', () => {
    const store = installStorage()

    store.set('num', '7')
    expect(readObject('num', {})).toEqual({})

    store.set('str', '"hello"')
    expect(readObject('str', {})).toEqual({})

    store.set('arr', '[1,2]')
    expect(readObject('arr', {})).toEqual({})
  })

  it('returns the fallback when storage itself throws', () => {
    installStorage({ failEverything: true })
    expect(readObject('k', {})).toEqual({})
  })
})

describe('writeObject', () => {
  it('returns true when the value reaches localStorage', () => {
    expect(writeObject('k', { a: 1 })).toBe(true)
  })

  // The high-severity bug in PLAN 5: an unguarded setItem throws out of
  // nextProblem before setMode(SUMMARY), hanging the app on the last card.
  it('returns false instead of throwing when the write fails', () => {
    installStorage({ failWrites: true })

    let result
    expect(() => {
      result = writeObject('k', { a: 1 })
    }).not.toThrow()
    expect(result).toBe(false)
  })

  it('keeps the tab working after a failed write, via the in-memory fallback', () => {
    installStorage({ failWrites: true })

    expect(writeObject('k', { a: 1 })).toBe(false)
    expect(readObject('k', {})).toEqual({ a: 1 })
  })

  it('lets localStorage win again once a write succeeds', () => {
    installStorage({ failWrites: true })
    writeObject('k', { from: 'memory' })

    const store = installStorage()
    expect(writeObject('k', { from: 'storage' })).toBe(true)

    store.set('k', JSON.stringify({ from: 'someone else' }))
    expect(readObject('k', {})).toEqual({ from: 'someone else' })
  })

  it('stops shadowing localStorage the moment localStorage moves on', () => {
    // The bug: a fallback copy made during a failing minute used to shadow that
    // key for the rest of the tab's life, so a value written afterwards was
    // invisible — and the next successful write, built on the stale copy, would
    // silently delete it.
    installStorage({ failWrites: true })
    expect(writeObject('k', { scores: 1 })).toBe(false)
    expect(readObject('k', {})).toEqual({ scores: 1 })

    // Writes work again, and something else has stored a newer value.
    const store = installStorage()
    store.set('k', JSON.stringify({ scores: 2 }))

    expect(readObject('k', {})).toEqual({ scores: 2 })

    // ...and the read-modify-write every store here does is built on the newer
    // value, so the stale copy cannot come back and eat it.
    writeObject('k', { ...readObject('k', {}), scores: 3 })
    expect(JSON.parse(store.get('k'))).toEqual({ scores: 3 })
  })

  it('keeps shadowing while nothing else has written the key', () => {
    // The other half of the same rule: a failed write must not make the tab
    // forget what she just did, or the session it happened in stops adding up.
    const store = installStorage({ failWrites: true })
    store.set('k', JSON.stringify({ scores: 1 }))

    expect(writeObject('k', { scores: 2 })).toBe(false)
    expect(readObject('k', {})).toEqual({ scores: 2 })
    expect(readObject('k', {})).toEqual({ scores: 2 })
  })

  it('refuses a non-object rather than storing one', () => {
    expect(writeObject('k', null)).toBe(false)
    expect(writeObject('k', [1, 2])).toBe(false)
    expect(readObject('k')).toBe(null)
  })

  it('does not throw on a value that cannot be stringified', () => {
    const cyclic = {}
    cyclic.self = cyclic
    expect(writeObject('k', cyclic)).toBe(false)
  })
})

describe('without any localStorage at all', () => {
  it('reads and writes without throwing', () => {
    delete globalThis.localStorage

    expect(writeObject('k', { a: 1 })).toBe(false)
    expect(readObject('k', {})).toEqual({ a: 1 })
  })
})
