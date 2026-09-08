/**
 * Oceans and seas. (WORLD.md)
 *
 * A clue on the card, four bodies of water on the buttons.
 *
 * ── WHY THE SEAS ARE HERE AT ALL ────────────────────────────────────────────
 *
 * Five oceans is five facts, and the oceans slot on the home screen is permanent
 * — six slots, fixed forever, never reordered. A card she opens twice and then
 * never again is a dead patch in her garden. The owner's decision was therefore
 * five oceans plus a second level of major seas, which roughly doubles the
 * content and puts the Mediterranean in it, which is genuinely useful knowledge
 * for a child in Europe.
 *
 * ── THE CLUES ARE THE CONTENT ───────────────────────────────────────────────
 *
 * There is no map, so the prompt has to carry the geography in words. Each clue
 * is a place relation a six-year-old can picture — "around the North Pole",
 * "between Europe and Africa" — rather than a superlative she can only memorise.
 * Two clues per ocean, so a deck is not the same five cards every time.
 */

import { balancedPositions } from '../../lib/choicePositions'
import { sample } from '../../lib/rng'

export const KIND = 'ART'
export const DISTRACTOR_COUNT = 3
export const CHOICE_COUNT = DISTRACTOR_COUNT + 1

/** Everything that can be an answer. */
export const WATERS = Object.freeze({
  pacific: 'Pacific Ocean',
  atlantic: 'Atlantic Ocean',
  indian: 'Indian Ocean',
  southern: 'Southern Ocean',
  arctic: 'Arctic Ocean',
  mediterranean: 'Mediterranean Sea',
  north: 'North Sea',
  baltic: 'Baltic Sea',
  caribbean: 'Caribbean Sea',
  red: 'Red Sea',
})

/** The five oceans, which is the whole of the first level. */
export const OCEAN_IDS = Object.freeze(['pacific', 'atlantic', 'indian', 'southern', 'arctic'])

/** @type {readonly [string, string][]} clue, answer */
export const OCEAN_CLUES = Object.freeze([
  ['the biggest ocean of all', 'pacific'],
  ['between Asia and America', 'pacific'],
  ['between Europe and America', 'atlantic'],
  ['the ocean west of Africa', 'atlantic'],
  ['south of India', 'indian'],
  ['between Africa and Australia', 'indian'],
  ['all the way around Antarctica', 'southern'],
  ['the coldest ocean, at the bottom of the world', 'southern'],
  ['around the North Pole', 'arctic'],
  ['the smallest ocean, and the iciest', 'arctic'],
])

/** @type {readonly [string, string][]} */
export const SEA_CLUES = Object.freeze([
  ['between Europe and Africa', 'mediterranean'],
  ['the sea Italy and Greece sit in', 'mediterranean'],
  ['between Britain and Norway', 'north'],
  ['between Sweden and Poland', 'baltic'],
  ['the sea between Finland and Sweden', 'baltic'],
  ['between Egypt and Saudi Arabia', 'red'],
  ['east of Central America, full of islands', 'caribbean'],
  ['the sea around Jamaica and Cuba', 'caribbean'],
])

/**
 * What each level asks about, and what its buttons may say.
 *
 * The oceans level answers only with oceans: offering the Mediterranean against
 * "around the North Pole" would be a free point, because she can rule out
 * anything called a sea without knowing where it is.
 */
export const LEVELS = Object.freeze({
  oceans: { clues: OCEAN_CLUES, answers: OCEAN_IDS, deckSize: 10 },
  seas: { clues: [...OCEAN_CLUES, ...SEA_CLUES], answers: Object.keys(WATERS), deckSize: 12 },
})

export function levelFor(id) {
  const level = LEVELS[id]

  if (!level) throw new RangeError(`oceans: unknown level ${JSON.stringify(id)}`)

  return level
}

/**
 * Three wrong answers, from the level's own pool. Pure and deterministic.
 *
 * Nearest in the canonical order, walking outward, which keeps oceans beside
 * oceans and seas beside seas — the two halves of the list are written in that
 * order for exactly this reason.
 *
 * @param {string} id
 * @param {readonly string[]} pool
 * @returns {string[]}
 */
export function getDistractors(id, pool) {
  if (!WATERS[id]) throw new RangeError(`getDistractors(): unknown water ${JSON.stringify(id)}`)

  const ordered = Object.keys(WATERS).filter((key) => pool.includes(key))
  const home = ordered.indexOf(id)
  const out = []

  const take = (candidate) => {
    if (out.length >= DISTRACTOR_COUNT) return
    if (!candidate || candidate === id || out.includes(candidate)) return

    out.push(candidate)
  }

  for (let step = 1; out.length < DISTRACTOR_COUNT && step <= ordered.length; step += 1) {
    take(ordered[home - step])
    take(ordered[home + step])
  }

  if (out.length < DISTRACTOR_COUNT) {
    throw new RangeError(`getDistractors(): pool of ${pool.length} is too small for ${id}`)
  }

  return out
}

/**
 * One deck.
 *
 * @param {{ level: string }} params
 * @param {() => number} rng
 * @returns {import('../manifestSchema').Question[]}
 */
export function generate(params, rng) {
  const level = levelFor(params?.level)
  const clues = sample(level.clues, Math.min(level.deckSize, level.clues.length), rng)
  const positions = balancedPositions(clues.length, CHOICE_COUNT, rng)

  return clues.map(([clue, answer], index) => {
    const distractors = getDistractors(answer, level.answers)
    const choices = []

    let next = 0
    for (let slot = 0; slot < CHOICE_COUNT; slot += 1) {
      const pick = slot === positions[index] ? answer : distractors[next++]

      choices.push({ id: pick, label: WATERS[pick] })
    }

    return {
      id: `OCEAN-${answer}-${index}`,
      kind: KIND,
      prompt: { art: { kind: 'text', value: clue }, text: `Which water is ${clue}?` },
      answer,
      choices,
      meta: { level: params.level, correctIndex: positions[index] },
    }
  })
}
