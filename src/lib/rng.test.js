import { afterEach, describe, expect, it, vi } from 'vitest'
import { mulberry32, sample, shuffle } from './rng'

const draw = (rng, n) => Array.from({ length: n }, () => rng())

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mulberry32', () => {
  it('gives a deep-equal sequence for the same seed', () => {
    expect(draw(mulberry32(12345), 20)).toEqual(draw(mulberry32(12345), 20))
  })

  it('gives a different sequence for a different seed', () => {
    expect(draw(mulberry32(1), 20)).not.toEqual(draw(mulberry32(2), 20))
  })

  it('stays inside [0, 1)', () => {
    for (const value of draw(mulberry32(99), 500)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('does not touch Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must never be called — pass an rng instead')
    })

    expect(() => draw(mulberry32(3), 50)).not.toThrow()
  })
})

describe('shuffle', () => {
  const deck = Array.from({ length: 18 }, (_, i) => i + 3)

  it('is a permutation — same items, nothing added or lost', () => {
    const shuffled = shuffle(deck, mulberry32(7))

    expect(shuffled).toHaveLength(deck.length)
    expect([...shuffled].sort((a, b) => a - b)).toEqual(deck)
  })

  it('does not mutate its input', () => {
    const source = [...deck]
    shuffle(source, mulberry32(7))
    expect(source).toEqual(deck)
  })

  it('is deterministic for a given seed', () => {
    expect(shuffle(deck, mulberry32(7))).toEqual(shuffle(deck, mulberry32(7)))
  })

  it('actually reorders', () => {
    expect(shuffle(deck, mulberry32(7))).not.toEqual(deck)
  })

  it('handles empty and single-item arrays', () => {
    expect(shuffle([], mulberry32(1))).toEqual([])
    expect(shuffle(['only'], mulberry32(1))).toEqual(['only'])
  })

  it('does not touch Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must never be called — pass an rng instead')
    })

    expect(() => shuffle(deck, mulberry32(7))).not.toThrow()
  })
})

describe('sample', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

  it('never repeats an item', () => {
    for (let seed = 0; seed < 200; seed++) {
      const drawn = sample(pool, 5, mulberry32(seed))

      expect(drawn).toHaveLength(5)
      expect(new Set(drawn).size).toBe(5)
    }
  })

  it('only draws items that were in the pool', () => {
    for (const item of sample(pool, 8, mulberry32(11))) {
      expect(pool).toContain(item)
    }
  })

  it('is deterministic for a given seed', () => {
    expect(sample(pool, 4, mulberry32(23))).toEqual(sample(pool, 4, mulberry32(23)))
  })

  it('does not mutate its input', () => {
    const source = [...pool]
    sample(source, 6, mulberry32(5))
    expect(source).toEqual(pool)
  })

  it('draws nothing when asked for nothing', () => {
    expect(sample(pool, 0, mulberry32(5))).toEqual([])
  })

  it('throws rather than quietly returning a short array', () => {
    expect(() => sample(pool, pool.length + 1, mulberry32(1))).toThrow(RangeError)
    expect(() => sample(pool, -1, mulberry32(1))).toThrow(RangeError)
    expect(() => sample(pool, 2.5, mulberry32(1))).toThrow(RangeError)
  })

  it('does not touch Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must never be called — pass an rng instead')
    })

    expect(() => sample(pool, 4, mulberry32(7))).not.toThrow()
  })
})
