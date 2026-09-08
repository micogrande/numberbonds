/**
 * Continents. (WORLD.md)
 *
 * "Which continent is Brazil in?", four continents on the buttons.
 *
 * ── SEVEN, AND THE SEVENTH IS OCEANIA ───────────────────────────────────────
 *
 * The owner's decision. There is no worldwide right answer — English-speaking
 * schools generally teach seven, others teach six or five, and the seventh is
 * called Australia in some curricula and Oceania in others. This app grades her,
 * so if it disagrees with her teacher it marks her school's answer wrong. If a
 * book at home says Australia, change the one string in CONTINENTS and nothing
 * else moves.
 *
 * ── WHY COUNTRIES AND NOT A MAP ─────────────────────────────────────────────
 *
 * A map needs geometry, and geometry is the piece that is not built yet. A
 * country she has heard of is a prompt she can already reason about, and the
 * knowledge transfers the moment a map does arrive.
 *
 * Antarctica has no countries, so it appears as an answer she must rule out and
 * once as its own card, through the only prompt that honestly names it.
 */

import { balancedPositions } from '../../lib/choicePositions'
import { sample } from '../../lib/rng'

export const KIND = 'ART'
export const DISTRACTOR_COUNT = 3
export const CHOICE_COUNT = DISTRACTOR_COUNT + 1
export const DECK_SIZE = 12

/** The seven, in the order a child meets them on a classroom map. */
export const CONTINENTS = Object.freeze({
  africa: 'Africa',
  asia: 'Asia',
  europe: 'Europe',
  namerica: 'North America',
  samerica: 'South America',
  oceania: 'Oceania',
  antarctica: 'Antarctica',
})

/**
 * What she is asked about, and where it is.
 *
 * Chosen for recognisability rather than size: a six-year-old has heard of Egypt
 * and Kenya, and has not heard of the Democratic Republic of the Congo. Every
 * continent carries at least five so no continent is answerable by elimination.
 */
export const PLACES = Object.freeze([
  ['Egypt', 'africa'], ['Kenya', 'africa'], ['Nigeria', 'africa'], ['Morocco', 'africa'],
  ['South Africa', 'africa'], ['Ghana', 'africa'],
  ['China', 'asia'], ['India', 'asia'], ['Japan', 'asia'], ['Thailand', 'asia'],
  ['Vietnam', 'asia'], ['Nepal', 'asia'],
  ['France', 'europe'], ['Italy', 'europe'], ['Norway', 'europe'], ['Poland', 'europe'],
  ['Greece', 'europe'], ['Portugal', 'europe'],
  ['Canada', 'namerica'], ['Mexico', 'namerica'], ['Jamaica', 'namerica'], ['Cuba', 'namerica'],
  ['the United States', 'namerica'], ['Costa Rica', 'namerica'],
  ['Brazil', 'samerica'], ['Argentina', 'samerica'], ['Peru', 'samerica'], ['Chile', 'samerica'],
  ['Colombia', 'samerica'], ['Bolivia', 'samerica'],
  ['Australia', 'oceania'], ['New Zealand', 'oceania'], ['Fiji', 'oceania'],
  ['Papua New Guinea', 'oceania'], ['Samoa', 'oceania'], ['Tonga', 'oceania'],
  ['the South Pole', 'antarctica'],
])

/**
 * The confusions worth putting on a button, best first.
 *
 * Europe and Asia meet on one landmass; the two Americas share a name; Africa
 * and Asia meet at Egypt; Oceania and Asia blur at the edges. Everything else is
 * filled from the remaining continents in a fixed order, so a set is always the
 * same for the same answer.
 */
const NEAR = Object.freeze({
  africa: ['asia', 'samerica', 'europe'],
  asia: ['europe', 'africa', 'oceania'],
  europe: ['asia', 'africa', 'namerica'],
  namerica: ['samerica', 'europe', 'asia'],
  samerica: ['namerica', 'africa', 'oceania'],
  oceania: ['asia', 'antarctica', 'africa'],
  antarctica: ['oceania', 'samerica', 'asia'],
})

const ORDER = Object.freeze(Object.keys(CONTINENTS))

/**
 * Three wrong continents. Pure, deterministic, no rng.
 *
 * @param {string} id
 * @returns {string[]}
 */
export function getDistractors(id) {
  if (!CONTINENTS[id]) throw new RangeError(`getDistractors(): unknown continent ${JSON.stringify(id)}`)

  const out = []
  const take = (candidate) => {
    if (out.length >= DISTRACTOR_COUNT) return
    if (candidate === id || out.includes(candidate)) return

    out.push(candidate)
  }

  for (const near of NEAR[id]) take(near)
  for (const any of ORDER) take(any)

  return out
}

/**
 * One deck.
 *
 * @param {{}} _params
 * @param {() => number} rng
 * @returns {import('../manifestSchema').Question[]}
 */
export function generate(_params, rng) {
  const places = sample(PLACES, DECK_SIZE, rng)
  const positions = balancedPositions(places.length, CHOICE_COUNT, rng)

  return places.map(([place, continent], index) => {
    const distractors = getDistractors(continent)
    const choices = []

    let next = 0
    for (let slot = 0; slot < CHOICE_COUNT; slot += 1) {
      const pick = slot === positions[index] ? continent : distractors[next++]

      choices.push({ id: pick, label: CONTINENTS[pick] })
    }

    return {
      id: `CONT-${continent}-${place.replace(/\s+/g, '-')}`,
      kind: KIND,
      prompt: { art: { kind: 'text', value: place }, text: `Which continent is ${place} in?` },
      answer: continent,
      choices,
      meta: { correctIndex: positions[index] },
    }
  })
}
