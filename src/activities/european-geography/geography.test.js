import { describe, expect, it } from 'vitest'

import { CODES, COUNTRIES } from './geoData'
import { DECK_SIZE, DISTRACTOR_COUNT, TIERS, generate, getDistractors, poolFor } from './geoEngine'
import { mulberry32 } from '../../lib/rng'

/**
 * European capitals. (WORLD.md)
 *
 * A wrong answer key here teaches a six-year-old something false, so the facts
 * get checked as carefully as the machinery. The capitals people most often get
 * wrong have their own test.
 */

const ALL = TIERS.all

describe('the data', () => {
  it('is the same Europe as the flags app, minus England', () => {
    expect(CODES).toHaveLength(50)
    expect(COUNTRIES['gb-eng']).toBeUndefined()
    for (const code of ['ru', 'tr', 'xk']) expect(COUNTRIES[code]).toBeTruthy()
  })

  it('gives every country a name and a capital', () => {
    for (const code of CODES) {
      expect(COUNTRIES[code].name, code).toBeTruthy()
      expect(COUNTRIES[code].capital, code).toBeTruthy()
    }
  })

  // The ones adults get wrong, so they are the ones worth pinning.
  it('gets the commonly-mistaken capitals right', () => {
    expect(COUNTRIES.ch.capital).toBe('Bern') // not Zurich, not Geneva
    expect(COUNTRIES.tr.capital).toBe('Ankara') // not Istanbul
    expect(COUNTRIES.nl.capital).toBe('Amsterdam') // constitutional capital
    expect(COUNTRIES.ua.capital).toBe('Kyiv')
    expect(COUNTRIES.me.capital).toBe('Podgorica')
    expect(COUNTRIES.li.capital).toBe('Vaduz')
    expect(COUNTRIES.mt.capital).toBe('Valletta')
  })

  it('has no duplicate capital names, which would make two buttons identical', () => {
    const capitals = CODES.map((code) => COUNTRIES[code].capital)

    expect(new Set(capitals).size).toBe(capitals.length)
  })
})

describe('getDistractors', () => {
  it('always returns three distinct wrong countries inside the pool', () => {
    for (const tier of Object.keys(TIERS)) {
      const pool = poolFor(tier)

      for (const code of pool) {
        const out = getDistractors(code, pool)

        expect(out, `${code} in ${tier}`).toHaveLength(DISTRACTOR_COUNT)
        expect(new Set(out).size).toBe(DISTRACTOR_COUNT)
        expect(out).not.toContain(code)
        for (const wrong of out) expect(pool).toContain(wrong)
      }
    }
  })

  it('offers neighbours, so she cannot answer from where the country is', () => {
    // Norway against the other Nordic capitals, not against Rome and Ankara.
    expect(getDistractors('no', ALL)).toEqual(['dk', 'se', 'fi'])
    // Estonia's neighbourhood holds only Latvia and Lithuania, so the third comes
    // from the backstop — Denmark, which is a fair Baltic-Sea confusion anyway.
    expect(getDistractors('ee', ALL)).toEqual(['lv', 'lt', 'dk'])
    expect(getDistractors('pt', ALL)).toEqual(['es', 'ad', 'pl'])
  })

  it('never offers two buttons with the same city name', () => {
    for (const code of ALL) {
      const labels = getDistractors(code, ALL).map((c) => COUNTRIES[c].capital)

      expect(new Set(labels).size).toBe(labels.length)
      expect(labels).not.toContain(COUNTRIES[code].capital)
    }
  })

  it('refuses an unknown country', () => {
    expect(() => getDistractors('zz', ALL)).toThrow(RangeError)
  })
})

describe('generate', () => {
  const deck = (tier, seed) => generate({ tier }, mulberry32(seed))

  it('deals the advertised size for every tier', () => {
    for (const tier of Object.keys(TIERS)) expect(deck(tier, 1)).toHaveLength(DECK_SIZE)
  })

  it('is deterministic under a seed, and varies across seeds', () => {
    expect(deck('all', 9)).toEqual(deck('all', 9))
    expect(deck('all', 9).map((c) => c.answer)).not.toEqual(deck('all', 10).map((c) => c.answer))
  })

  it('never reaches for Math.random', () => {
    const real = Math.random
    Math.random = () => {
      throw new Error('engine used Math.random instead of the injected rng')
    }

    try {
      expect(() => deck('all', 4)).not.toThrow()
    } finally {
      Math.random = real
    }
  })

  it('asks about the country and answers with a city', () => {
    for (const card of deck('all', 3)) {
      expect(card.prompt.text).toBe(`What is the capital of ${COUNTRIES[card.answer].name}?`)
      expect(card.prompt.art).toEqual({ kind: 'text', value: COUNTRIES[card.answer].name })

      const correct = card.choices.find((choice) => choice.id === card.answer)
      expect(correct.label).toBe(COUNTRIES[card.answer].capital)
    }
  })

  it('puts the answer on exactly one of four buttons', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const card of deck('all', seed)) {
        expect(card.choices).toHaveLength(4)
        expect(card.choices.filter((c) => c.id === card.answer)).toHaveLength(1)
        expect(new Set(card.choices.map((c) => c.label)).size, 'two buttons read the same').toBe(4)
      }
    }
  })

  it('never repeats a country in one deck, or a position twice running', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const cards = deck('all', seed)

      expect(new Set(cards.map((c) => c.answer)).size).toBe(cards.length)

      const slots = cards.map((card) => card.choices.findIndex((c) => c.id === card.answer))
      for (let i = 1; i < slots.length; i += 1) expect(slots[i]).not.toBe(slots[i - 1])
    }
  })

  it('refuses an unknown tier', () => {
    expect(() => generate({ tier: 'nope' }, mulberry32(1))).toThrow(RangeError)
  })
})
