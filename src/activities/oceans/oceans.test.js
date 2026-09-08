import { describe, expect, it } from 'vitest'

import {
  DISTRACTOR_COUNT,
  LEVELS,
  OCEAN_CLUES,
  OCEAN_IDS,
  SEA_CLUES,
  WATERS,
  generate,
  getDistractors,
  levelFor,
} from './oceansEngine'
import { mulberry32 } from '../../lib/rng'

/**
 * Oceans and seas. (WORLD.md)
 *
 * The owner chose five oceans plus a second level of major seas. The headline
 * rule is that the oceans level answers ONLY with oceans — offering a sea there
 * would be a free point, because she could rule it out by the word "Sea" without
 * knowing any geography.
 */

const deck = (level, seed) => generate({ level }, mulberry32(seed))

describe('the waters', () => {
  it('has five oceans, including the Southern', () => {
    expect(OCEAN_IDS).toHaveLength(5)
    expect(OCEAN_IDS).toContain('southern')
    for (const id of OCEAN_IDS) expect(WATERS[id]).toMatch(/Ocean$/)
  })

  it('adds the seas the owner asked for', () => {
    const seas = Object.keys(WATERS).filter((id) => !OCEAN_IDS.includes(id))

    expect(seas).toEqual(['mediterranean', 'north', 'baltic', 'caribbean', 'red'])
    for (const id of seas) expect(WATERS[id]).toMatch(/Sea$/)
  })

  it('answers every clue with a water that exists', () => {
    for (const [clue, id] of [...OCEAN_CLUES, ...SEA_CLUES]) {
      expect(WATERS[id], `"${clue}" answers to "${id}", which is not a water`).toBeTruthy()
    }
  })

  it('gives every ocean two clues, so a deck is not the same five cards', () => {
    const counts = {}
    for (const [, id] of OCEAN_CLUES) counts[id] = (counts[id] ?? 0) + 1

    for (const id of OCEAN_IDS) expect(counts[id], `${id} needs two clues`).toBe(2)
  })

  it('never writes the answer into its own clue', () => {
    for (const [clue, id] of [...OCEAN_CLUES, ...SEA_CLUES]) {
      const word = WATERS[id].split(' ')[0].toLowerCase()

      expect(clue.toLowerCase(), `"${clue}" gives away ${WATERS[id]}`).not.toContain(word)
    }
  })
})

describe('the levels', () => {
  it('deals every ocean clue on the oceans level — it is exhaustive', () => {
    expect(LEVELS.oceans.deckSize).toBe(OCEAN_CLUES.length)
    expect(deck('oceans', 3)).toHaveLength(OCEAN_CLUES.length)
  })

  it('answers the oceans level with oceans only', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      for (const card of deck('oceans', seed)) {
        for (const choice of card.choices) {
          expect(OCEAN_IDS, `"${choice.label}" is not an ocean`).toContain(choice.id)
        }
      }
    }
  })

  it('refuses an unknown level', () => {
    expect(() => levelFor('puddles')).toThrow(RangeError)
    expect(() => generate({ level: 'puddles' }, mulberry32(1))).toThrow(RangeError)
  })
})

describe('getDistractors', () => {
  it('always returns three distinct wrong waters from the pool', () => {
    for (const [id, level] of Object.entries(LEVELS)) {
      for (const answer of level.answers) {
        const out = getDistractors(answer, level.answers)

        expect(out, `${answer} on ${id}`).toHaveLength(DISTRACTOR_COUNT)
        expect(new Set(out).size).toBe(DISTRACTOR_COUNT)
        expect(out).not.toContain(answer)
        for (const wrong of out) expect(level.answers).toContain(wrong)
      }
    }
  })

  it('refuses an unknown water', () => {
    expect(() => getDistractors('lake', OCEAN_IDS)).toThrow(RangeError)
  })
})

describe('generate', () => {
  it('deals the advertised size for both levels', () => {
    for (const [id, level] of Object.entries(LEVELS)) {
      expect(deck(id, 1)).toHaveLength(level.deckSize)
    }
  })

  it('is deterministic under a seed, and varies across seeds', () => {
    expect(deck('seas', 8)).toEqual(deck('seas', 8))
    expect(deck('seas', 8).map((c) => c.id)).not.toEqual(deck('seas', 9).map((c) => c.id))
  })

  it('never reaches for Math.random', () => {
    const real = Math.random
    Math.random = () => {
      throw new Error('engine used Math.random')
    }
    try {
      expect(() => deck('seas', 2)).not.toThrow()
    } finally {
      Math.random = real
    }
  })

  it('puts the answer on exactly one of four buttons, never twice running', () => {
    for (const level of Object.keys(LEVELS)) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const cards = deck(level, seed)

        for (const card of cards) {
          expect(card.choices).toHaveLength(4)
          expect(card.choices.filter((c) => c.id === card.answer)).toHaveLength(1)
          expect(new Set(card.choices.map((c) => c.label)).size).toBe(4)
        }

        const slots = cards.map((card) => card.choices.findIndex((c) => c.id === card.answer))
        for (let i = 1; i < slots.length; i += 1) expect(slots[i]).not.toBe(slots[i - 1])
      }
    }
  })

  it('never asks the same clue twice in one deck', () => {
    for (const level of Object.keys(LEVELS)) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const clues = deck(level, seed).map((card) => card.prompt.art.value)

        expect(new Set(clues).size).toBe(clues.length)
      }
    }
  })
})
