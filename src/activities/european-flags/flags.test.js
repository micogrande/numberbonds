import { describe, expect, it } from 'vitest'

import { CODES, COUNTRY_CODES, FLAGS } from './flagData'
import { DISTRACTOR_COUNT, getDistractors } from './flags'
import { DECK_SIZE, TIERS, generate, poolFor } from './flagEngine'
import { mulberry32 } from '../../lib/rng'

/**
 * European flags. (WORLD.md)
 *
 * The standard Roman numerals set: distractors are a PURE function of the answer
 * and the pool, so every set is assertable against an exact array, and the
 * quality bar is that each wrong button names a real confusion rather than a
 * random country.
 */

const ALL = TIERS.all

describe('the data', () => {
  it('covers Europe on the widest common definition, plus England', () => {
    expect(CODES.length).toBe(51)
    // The owner's call: Russia, Turkey and Kosovo all in.
    for (const code of ['ru', 'tr', 'xk']) expect(FLAGS[code]).toBeTruthy()
    // Kazakhstan is excluded as overwhelmingly Asian.
    expect(FLAGS.kz).toBeUndefined()
  })

  it('gives every sovereign state a capital, and England none', () => {
    expect(COUNTRY_CODES).toHaveLength(50)
    expect(FLAGS['gb-eng'].capital).toBeNull()
    expect(COUNTRY_CODES).not.toContain('gb-eng')

    for (const code of COUNTRY_CODES) {
      expect(FLAGS[code].capital, `${code} has no capital`).toBeTruthy()
    }
  })

  it('spells the names the owner asked for', () => {
    expect(FLAGS.gb.name).toBe('United Kingdom')
    expect(FLAGS['gb-eng'].name).toBe('England')
    expect(FLAGS.cz.name).toBe('Czechia')
    expect(FLAGS.nl.name).toBe('Netherlands')
  })

  it('shares one viewBox, which is what lets four sit in a grid', () => {
    for (const code of CODES) expect(FLAGS[code].viewBox).toBe('0 0 640 480')
  })

  it('carries markup for every flag', () => {
    for (const code of CODES) expect(FLAGS[code].svg.length).toBeGreaterThan(20)
  })
})

describe('getDistractors', () => {
  it('always returns three distinct wrong answers inside the pool', () => {
    for (const tier of Object.keys(TIERS)) {
      const pool = poolFor(tier)

      for (const code of pool) {
        const out = getDistractors(code, pool)

        expect(out, `${code} in ${tier}`).toHaveLength(DISTRACTOR_COUNT)
        expect(new Set(out).size, `${code} in ${tier} repeated a distractor`).toBe(DISTRACTOR_COUNT)
        expect(out, `${code} in ${tier} offered itself`).not.toContain(code)

        for (const wrong of out) {
          expect(pool, `${code} in ${tier} reached outside the pool for ${wrong}`).toContain(wrong)
        }
      }
    }
  })

  // The whole reason this file exists rather than picking three at random.
  describe('targets real confusions', () => {
    it('puts other Nordic crosses beside a Nordic cross', () => {
      expect(getDistractors('dk', ALL)).toEqual(['no', 'is', 'se'])
      expect(getDistractors('se', ALL)).toEqual(['fi', 'no', 'dk'])
    })

    it('puts Luxembourg beside the Netherlands', () => {
      expect(getDistractors('nl', ALL)).toEqual(['lu', 'fr', 'ru'])
    })

    it('puts Monaco and Poland beside each other — the same two bands, reversed', () => {
      expect(getDistractors('pl', ALL)[0]).toBe('mc')
      expect(getDistractors('mc', ALL)[0]).toBe('pl')
    })

    it('puts the pan-Slavic tricolours together', () => {
      expect(getDistractors('si', ALL)).toEqual(['sk', 'ru', 'hr'])
    })

    it('teaches the England / United Kingdom distinction by pairing them', () => {
      expect(getDistractors('gb-eng', ALL)).toContain('gb')
      expect(getDistractors('gb', ALL)).toContain('gb-eng')
    })

    it('pairs Ireland with Italy', () => {
      expect(getDistractors('ie', ALL)[0]).toBe('it')
    })

    it('keeps the Baltics together', () => {
      expect(getDistractors('ee', ALL)).toEqual(['lv', 'lt', 'xk'])
    })
  })

  it('still finds three in the twelve-flag starter tier', () => {
    for (const code of TIERS.starter) {
      expect(getDistractors(code, TIERS.starter)).toHaveLength(DISTRACTOR_COUNT)
    }
  })

  it('refuses an unknown flag rather than inventing one', () => {
    expect(() => getDistractors('zz', ALL)).toThrow(RangeError)
  })

  it('refuses a pool too small to answer honestly', () => {
    expect(() => getDistractors('fr', ['fr', 'de'])).toThrow(RangeError)
  })
})

describe('generate', () => {
  const deck = (tier, seed) => generate({ tier }, mulberry32(seed))

  it('deals the advertised deck size for every tier', () => {
    for (const tier of Object.keys(TIERS)) expect(deck(tier, 1)).toHaveLength(DECK_SIZE)
  })

  it('is exhaustive on the starter tier — she meets all twelve every time', () => {
    const codes = deck('starter', 7).map((card) => card.answer).sort()

    expect(codes).toEqual([...TIERS.starter].sort())
  })

  it('gives the same deck for the same seed', () => {
    expect(deck('all', 42)).toEqual(deck('all', 42))
  })

  it('gives different decks for different seeds', () => {
    expect(deck('all', 1).map((c) => c.answer)).not.toEqual(deck('all', 2).map((c) => c.answer))
  })

  it('never reaches for Math.random', () => {
    const real = Math.random
    Math.random = () => {
      throw new Error('engine used Math.random instead of the injected rng')
    }

    try {
      expect(() => deck('all', 3)).not.toThrow()
    } finally {
      Math.random = real
    }
  })

  it('never repeats a country inside one deck', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const codes = deck('all', seed).map((card) => card.answer)

      expect(new Set(codes).size, `seed ${seed} dealt a country twice`).toBe(codes.length)
    }
  })

  it('puts the answer on exactly one button, and four buttons on every card', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const card of deck('all', seed)) {
        expect(card.choices).toHaveLength(4)
        expect(card.choices.filter((choice) => choice.id === card.answer)).toHaveLength(1)
        expect(new Set(card.choices.map((c) => c.id)).size).toBe(4)
      }
    }
  })

  it('never puts the answer under the same thumb twice running', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const slots = deck('all', seed).map((card) => card.choices.findIndex((c) => c.id === card.answer))

      for (let i = 1; i < slots.length; i += 1) {
        expect(slots[i], `seed ${seed} repeated position at card ${i}`).not.toBe(slots[i - 1])
      }
    }
  })

  it('labels every button with a country name', () => {
    for (const card of deck('all', 11)) {
      for (const choice of card.choices) expect(choice.label).toBe(FLAGS[choice.id].name)
    }
  })

  it('carries the art reference the renderer needs', () => {
    for (const card of deck('more', 5)) {
      expect(card.prompt.art).toEqual({ kind: 'flag', code: card.answer })
      expect(FLAGS[card.prompt.art.code]).toBeTruthy()
    }
  })

  it('refuses an unknown tier', () => {
    expect(() => generate({ tier: 'everything' }, mulberry32(1))).toThrow(RangeError)
  })
})
