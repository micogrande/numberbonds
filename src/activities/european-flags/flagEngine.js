/**
 * European flags — the deck. (WORLD.md)
 *
 * Flag on the card, four country names on the buttons. Reverse (name in the
 * question, four flags on the buttons) is deliberately later: it needs pictures
 * on the answer buttons, and it is the more valuable drill once she already
 * knows the flags — so its natural home is a level she grows into.
 *
 * ── WHY TIERS AND NOT ONE BIG POOL ──────────────────────────────────────────
 *
 * The owner asked for every country in Europe, and that is right as *coverage* —
 * but fifty flags is not one deck for a six-year-old. So coverage is expressed
 * as difficulty tiers, the same shape as Roman numerals' up-to-10/50/100: full
 * coverage is the ceiling she climbs to, not the entry price.
 *
 * The tiers are ordered by how likely she is to have met the flag, not
 * alphabetically and not by country size. A flag she has a reason to recognise —
 * a holiday, a football shirt, a cousin — is learned in a fortnight; an
 * arbitrary one is not learned at all.
 */

import { CODES, FLAGS } from './flagData'
import { DISTRACTOR_COUNT, getDistractors } from './flags'
import { balancedPositions } from '../../lib/choicePositions'
import { sample } from '../../lib/rng'

/** Render family. Shared with any future picture activity. Nothing dispatches on it. */
export const KIND = 'ART'

/** Four buttons: one right, three wrong. */
export const CHOICE_COUNT = DISTRACTOR_COUNT + 1

/** Cards per session, every tier. Twelve choice cards run about as long as 18 keypad ones. */
export const DECK_SIZE = 12

/**
 * The starter twelve: the flags a child in Europe is most likely to have seen.
 *
 * Exactly DECK_SIZE, so this tier is exhaustive — she meets all twelve every
 * session and only the order and the buttons vary. That is right for a closed
 * set she is trying to learn, and it is the same reasoning that makes Roman
 * numerals up-to-10 exhaustive.
 */
const STARTER = Object.freeze(['fr', 'de', 'it', 'es', 'pt', 'gb', 'ie', 'nl', 'gr', 'pl', 'no', 'se'])

/** The next twelve, including England beside the Union Jack. */
const MORE = Object.freeze([...STARTER, 'dk', 'fi', 'is', 'ch', 'at', 'be', 'ua', 'tr', 'ru', 'hu', 'cz', 'gb-eng'])

/** @type {Record<string, readonly string[]>} */
export const TIERS = Object.freeze({
  starter: STARTER,
  more: MORE,
  all: CODES,
})

/**
 * The pool a tier may draw from.
 *
 * @param {string} tier
 * @returns {readonly string[]}
 */
export function poolFor(tier) {
  const pool = TIERS[tier]

  if (!pool) throw new RangeError(`flags: unknown tier ${JSON.stringify(tier)}`)

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

  // Where the correct button sits, card by card: near-equal across the four
  // slots and never twice running, so she cannot score by thumb position.
  const positions = balancedPositions(answers.length, CHOICE_COUNT, rng)

  return answers.map((code, index) => {
    const distractors = getDistractors(code, pool)
    const choices = []

    // The correct answer goes to its assigned slot; the distractors fill the
    // rest in ladder order, so the whole layout is a pure function of the card
    // plus one position — assertable without re-implementing the shuffle.
    let next = 0
    for (let slot = 0; slot < CHOICE_COUNT; slot += 1) {
      const pick = slot === positions[index] ? code : distractors[next++]

      choices.push({ id: pick, label: FLAGS[pick].name })
    }

    return {
      id: `FLAG-${code}`,
      kind: KIND,
      prompt: {
        art: { kind: 'flag', code },
        text: `Which country has this flag?`,
      },
      answer: code,
      choices,
      meta: { tier: params.tier, correctIndex: positions[index] },
    }
  })
}
