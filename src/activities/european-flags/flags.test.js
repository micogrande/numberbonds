import { describe, expect, it } from 'vitest'

import { CODES, COUNTRY_CODES, FLAGS } from './flagData'
import { DISTRACTOR_COUNT, getDistractors } from './flags'
import { TIERS, deckSizeFor, generate, poolFor } from './flagEngine'
import { FLAG_EU } from './manifest'
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

  it('deals a card for every flag in the tier, and no more', () => {
    for (const tier of Object.keys(TIERS)) {
      expect(deck(tier, 1), tier).toHaveLength(deckSizeFor(tier))
    }
  })

  // The owner's words: "do not limit it to 12 questions, the option for 24
  // should have 24 questions and the option for all should have a question for
  // each European country." Every tier now behaves the way `starter` always did.
  it('is exhaustive on EVERY tier — she meets each flag in it exactly once', () => {
    for (const tier of Object.keys(TIERS)) {
      for (const seed of [7, 19, 2024]) {
        const codes = deck(tier, seed).map((card) => card.answer)

        expect([...codes].sort(), `${tier} at seed ${seed}`).toEqual([...poolFor(tier)].sort())
      }
    }
  })

  it('deals the same flags in a different order each session', () => {
    // Exhaustive must not mean identical: the set is fixed, the sequence is not.
    const a = deck('all', 1).map((card) => card.answer)
    const b = deck('all', 2).map((card) => card.answer)

    expect(a).not.toEqual(b)
    expect([...a].sort()).toEqual([...b].sort())
  })

  it('gives the same deck for the same seed', () => {
    expect(deck('all', 42)).toEqual(deck('all', 42))
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

describe('the manifest and the pools agree', () => {
  /**
   * The manifest cannot import the engine — it is loaded eagerly by the registry
   * and importing `flagEngine` would pull all 51 flags into the first chunk she
   * downloads. So `deckSize` is a literal over there and a derived length over
   * here, and these two facts are only true together because this block says so.
   *
   * `registry.test.js` already deals every option through the real engine and
   * checks the length, which catches the same drift — but it reports it as
   * "expected length 51, got 24" against an anonymous option in a shared file.
   * This block names the tier and the two numbers, in the folder that owns them.
   */
  const optionFor = (tier) => FLAG_EU.options.find((option) => option.params.tier === tier)

  it('has exactly one option per tier, and one tier per option', () => {
    expect(FLAG_EU.options.map((option) => option.params.tier)).toEqual(Object.keys(TIERS))
  })

  it('declares the deck size the pool actually deals, tier by tier', () => {
    for (const tier of Object.keys(TIERS)) {
      const option = optionFor(tier)

      expect(
        option.deckSize,
        `manifest says ${tier} deals ${option.deckSize}; the pool holds ${deckSizeFor(tier)}`
      ).toBe(deckSizeFor(tier))
    }
  })

  it('states the sizes the owner asked for: 12, 24, and one per European flag', () => {
    // The mutual pin above is satisfied by ANY pair of numbers that match, so a
    // flag quietly dropped from `more` would move both sides together and sail
    // through it. These are the numbers themselves.
    expect(optionFor('starter').deckSize).toBe(12)
    expect(optionFor('more').deckSize).toBe(24)
    // 51, not 50: England is a flag in this tier (WORLD.md section 1).
    expect(optionFor('all').deckSize).toBe(51)
    expect(deckSizeFor('all')).toBe(COUNTRY_CODES.length + 1)
  })

  it('carries the version the exhaustive decks were scored under', () => {
    // A tripwire, not a fact to maintain. `version` is half a high-score key
    // (PLAN 2.2 rule 1) and bumping it retires every record on this activity, so
    // it must never move as a side effect of an unrelated edit. It went 1 → 2
    // when `more` and `all` stopped dealing twelve cards out of a bigger pool:
    // a stored "10" meant ten out of twelve then and ten out of twenty-four now.
    // If you are changing this line, the recipe must have changed again — say so
    // in the manifest's header before you do.
    expect(FLAG_EU.version).toBe(2)
    expect(FLAG_EU.id).toBe('FLAG_EU')
    expect(FLAG_EU.options.map((option) => option.id)).toEqual(['starter', 'more', 'all'])
  })
})
