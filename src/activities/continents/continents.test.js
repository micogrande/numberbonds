import { describe, expect, it } from 'vitest'

import { CONTINENTS, DECK_SIZE, DISTRACTOR_COUNT, PLACES, generate, getDistractors } from './continentsEngine'
import { mulberry32 } from '../../lib/rng'

/**
 * Continents. (WORLD.md)
 *
 * The owner chose seven, with the seventh called Oceania. That is the one fact
 * here most likely to disagree with her school, so it is asserted by name.
 */

const deck = (seed) => generate({}, mulberry32(seed))

describe('the seven continents', () => {
  it('is seven, and the seventh is Oceania', () => {
    expect(Object.keys(CONTINENTS)).toHaveLength(7)
    expect(CONTINENTS.oceania).toBe('Oceania')
    expect(Object.values(CONTINENTS)).not.toContain('Australia')
  })

  it('places every prompt in a continent that exists', () => {
    for (const [place, continent] of PLACES) {
      expect(CONTINENTS[continent], `${place} is in "${continent}", which is not a continent`).toBeTruthy()
    }
  })

  it('gets the ones that catch people out right', () => {
    const where = Object.fromEntries(PLACES)

    expect(where.Egypt).toBe('africa')
    expect(where.Mexico).toBe('namerica')
    expect(where.Cuba).toBe('namerica')
    expect(where.Jamaica).toBe('namerica')
    expect(where.Brazil).toBe('samerica')
    expect(where['New Zealand']).toBe('oceania')
    expect(where['Papua New Guinea']).toBe('oceania')
    expect(where.Nepal).toBe('asia')
  })

  it('gives every continent enough places that none is answerable by elimination', () => {
    const counts = {}
    for (const [, continent] of PLACES) counts[continent] = (counts[continent] ?? 0) + 1

    for (const id of Object.keys(CONTINENTS)) {
      expect(counts[id] ?? 0, `${id} has no places at all`).toBeGreaterThan(0)
    }
    // Antarctica is the honest exception: it has no countries, so it carries one
    // prompt and otherwise exists as an answer she has to rule out.
    expect(counts.antarctica).toBe(1)
    for (const id of Object.keys(CONTINENTS).filter((c) => c !== 'antarctica')) {
      expect(counts[id], `${id} needs more places`).toBeGreaterThanOrEqual(5)
    }
  })
})

describe('getDistractors', () => {
  it('always returns three distinct wrong continents', () => {
    for (const id of Object.keys(CONTINENTS)) {
      const out = getDistractors(id)

      expect(out).toHaveLength(DISTRACTOR_COUNT)
      expect(new Set(out).size).toBe(DISTRACTOR_COUNT)
      expect(out).not.toContain(id)
      for (const wrong of out) expect(CONTINENTS[wrong]).toBeTruthy()
    }
  })

  it('offers the confusion, not a random continent', () => {
    expect(getDistractors('europe')[0]).toBe('asia')
    expect(getDistractors('namerica')[0]).toBe('samerica')
    expect(getDistractors('samerica')[0]).toBe('namerica')
    expect(getDistractors('africa')[0]).toBe('asia')
  })

  it('refuses an unknown continent', () => {
    expect(() => getDistractors('atlantis')).toThrow(RangeError)
  })
})

describe('generate', () => {
  it('deals the advertised deck', () => {
    expect(deck(1)).toHaveLength(DECK_SIZE)
  })

  it('is deterministic under a seed, and varies across seeds', () => {
    expect(deck(5)).toEqual(deck(5))
    expect(deck(5).map((c) => c.id)).not.toEqual(deck(6).map((c) => c.id))
  })

  it('never reaches for Math.random', () => {
    const real = Math.random
    Math.random = () => {
      throw new Error('engine used Math.random')
    }
    try {
      expect(() => deck(2)).not.toThrow()
    } finally {
      Math.random = real
    }
  })

  it('puts the answer on exactly one of four buttons, never twice running', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const cards = deck(seed)

      for (const card of cards) {
        expect(card.choices).toHaveLength(4)
        expect(card.choices.filter((c) => c.id === card.answer)).toHaveLength(1)
        expect(new Set(card.choices.map((c) => c.label)).size).toBe(4)
      }

      const slots = cards.map((card) => card.choices.findIndex((c) => c.id === card.answer))
      for (let i = 1; i < slots.length; i += 1) expect(slots[i]).not.toBe(slots[i - 1])
    }
  })

  it('never asks about the same place twice in one deck', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const places = deck(seed).map((card) => card.prompt.art.value)

      expect(new Set(places).size).toBe(places.length)
    }
  })

  it('asks a question that matches its answer', () => {
    const where = Object.fromEntries(PLACES)

    for (const card of deck(11)) {
      expect(where[card.prompt.art.value]).toBe(card.answer)
      expect(card.prompt.text).toBe(`Which continent is ${card.prompt.art.value} in?`)
    }
  })
})
