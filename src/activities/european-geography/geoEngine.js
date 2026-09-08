/**
 * European geography — capitals. (WORLD.md)
 *
 * "What is the capital of France?", four city names. No artwork, which is why
 * this option ships first: it is the whole app minus the map.
 *
 * The find-on-map option is planned and is not here yet. It needs simplified
 * border geometry generated the same way the flag artwork was, and it is a
 * separate option id — so adding it later leaves `GEO_EU::capitals::v1` and every
 * best she has set on it untouched.
 *
 * ── DISTRACTORS ARE REGIONAL, NOT RANDOM ────────────────────────────────────
 *
 * The Roman numerals rule again: a pure function of the answer and the pool,
 * assertable against an exact array. A random wrong capital is worthless — asked
 * for the capital of Norway with Rome, Ankara and Valletta beside it, she can
 * answer by knowing roughly where Norway is. Put Stockholm, Copenhagen and
 * Helsinki there and she has to actually know.
 */

import { CODES, COUNTRIES } from './geoData'
import { balancedPositions } from '../../lib/choicePositions'
import { sample } from '../../lib/rng'

/** Render family. Nothing dispatches on it. */
export const KIND = 'ART'

export const DISTRACTOR_COUNT = 3
export const CHOICE_COUNT = DISTRACTOR_COUNT + 1
export const DECK_SIZE = 12

/**
 * Neighbourhoods, as a child meets them.
 *
 * Not political blocs and not strict geography — groups of countries whose
 * capitals are plausibly confusable because they are learned together, sit near
 * each other on a map, or both. A country appears in exactly one.
 */
const REGIONS = Object.freeze([
  ['dk', 'se', 'no', 'fi', 'is'], // Nordic
  ['ee', 'lv', 'lt'], // Baltic
  ['gb', 'ie'], // British Isles
  ['es', 'pt', 'ad'], // Iberia
  ['fr', 'be', 'nl', 'lu', 'mc'], // Western
  ['de', 'at', 'ch', 'cz', 'sk', 'pl', 'hu', 'li'], // Central
  ['si', 'hr', 'ba', 'rs', 'me', 'mk', 'al', 'xk', 'bg', 'ro', 'gr'], // Balkans
  ['ua', 'by', 'md', 'ru'], // Eastern
  ['it', 'mt', 'cy', 'sm', 'va'], // Italy and the Mediterranean
  ['tr', 'ge', 'am', 'az'], // Anatolia and the Caucasus
])

/** The neighbourhood a country belongs to, or an empty list. */
const regionOf = (code) => REGIONS.find((region) => region.includes(code)) ?? []

/**
 * The three wrong capitals for one card. Pure, deterministic, no rng.
 *
 * Same neighbourhood first, in the order written above; then the backstop walks
 * outward from the answer's place in the canonical order, alternating before and
 * after, exactly as the Roman ladder's R6 does.
 *
 * @param {string} code
 * @param {string[]} pool
 * @returns {string[]} DISTRACTOR_COUNT country codes whose capitals are the wrong buttons
 */
export function getDistractors(code, pool) {
  if (!COUNTRIES[code]) throw new RangeError(`getDistractors(): unknown country ${JSON.stringify(code)}`)

  const allowed = new Set(pool)
  const out = []

  const take = (candidate) => {
    if (out.length >= DISTRACTOR_COUNT) return
    if (candidate === code || out.includes(candidate)) return
    if (!allowed.has(candidate) || !COUNTRIES[candidate]) return
    // Two countries could in principle share a capital name; never offer the
    // same word twice, or one of the wrong buttons is indistinguishable from
    // another and the card has three answers instead of four.
    if (out.some((other) => COUNTRIES[other].capital === COUNTRIES[candidate].capital)) return
    if (COUNTRIES[candidate].capital === COUNTRIES[code].capital) return

    out.push(candidate)
  }

  for (const neighbour of regionOf(code)) take(neighbour)

  const ordered = CODES.filter((c) => allowed.has(c))
  const home = ordered.indexOf(code)

  for (let step = 1; out.length < DISTRACTOR_COUNT && step <= ordered.length; step += 1) {
    take(ordered[home - step])
    take(ordered[home + step])
  }

  if (out.length < DISTRACTOR_COUNT) {
    throw new RangeError(
      `getDistractors(): pool of ${pool.length} is too small to give ${code} ` +
        `${DISTRACTOR_COUNT} distinct wrong capitals.`
    )
  }

  return out
}

/** The twelve she is most likely to have heard of. */
const STARTER = Object.freeze(['fr', 'de', 'it', 'es', 'pt', 'gb', 'ie', 'nl', 'gr', 'pl', 'no', 'se'])

/** @type {Record<string, readonly string[]>} */
export const TIERS = Object.freeze({
  starter: STARTER,
  all: CODES,
})

export function poolFor(tier) {
  const pool = TIERS[tier]

  if (!pool) throw new RangeError(`geography: unknown tier ${JSON.stringify(tier)}`)

  return pool
}

/**
 * One deck.
 *
 * @param {{ tier: string }} params
 * @param {() => number} rng
 * @returns {import('../manifestSchema').Question[]}
 */
export function generate(params, rng) {
  const pool = poolFor(params?.tier)
  const answers = sample(pool, Math.min(DECK_SIZE, pool.length), rng)
  const positions = balancedPositions(answers.length, CHOICE_COUNT, rng)

  return answers.map((code, index) => {
    const distractors = getDistractors(code, pool)
    const choices = []

    let next = 0
    for (let slot = 0; slot < CHOICE_COUNT; slot += 1) {
      const pick = slot === positions[index] ? code : distractors[next++]

      // The button carries the CITY; the id stays the country code, so grading
      // never has to compare two strings a human typed.
      choices.push({ id: pick, label: COUNTRIES[pick].capital })
    }

    return {
      id: `GEO-CAP-${code}`,
      kind: KIND,
      prompt: {
        art: { kind: 'text', value: COUNTRIES[code].name },
        text: `What is the capital of ${COUNTRIES[code].name}?`,
      },
      answer: code,
      choices,
      meta: { tier: params.tier, correctIndex: positions[index] },
    }
  })
}
