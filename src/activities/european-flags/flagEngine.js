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
 *
 * ── EVERY TIER IS EXHAUSTIVE ────────────────────────────────────────────────
 *
 * The owner: "do not limit it to 12 questions, the option for 24 should have 24
 * questions and the option for all should have a question for each European
 * country."
 *
 * So a deck IS its tier's pool, shuffled. `starter` already worked that way;
 * `more` and `all` used to deal twelve of twenty-four and twelve of fifty-one,
 * which meant the tier she picked changed *which* flags she might meet but not
 * how many, and half of `more` could sit out a session unseen.
 *
 * The consequence that matters more than the code: there is no `DECK_SIZE`
 * constant any more. A deck size is `poolFor(tier).length` — derived, never
 * written down — because a hand-kept number that has to agree with a list is a
 * number that will eventually disagree with it. The manifest is the one place
 * that still has to state the sizes as literals (it is loaded eagerly and must
 * not import this file, which would drag every flag in Europe into the first
 * chunk she downloads), and `flags.test.js` pins the two against each other.
 */

import { CODES, FLAGS } from './flagData'
import { DISTRACTOR_COUNT, getDistractors } from './flags'
import { balancedPositions } from '../../lib/choicePositions'
import { sample } from '../../lib/rng'

/** Render family. Shared with any future picture activity. Nothing dispatches on it. */
export const KIND = 'ART'

/** Four buttons: one right, three wrong. */
export const CHOICE_COUNT = DISTRACTOR_COUNT + 1

/**
 * The starter twelve: the flags a child in Europe is most likely to have seen.
 *
 * She meets all twelve every session and only the order and the buttons vary.
 * That is right for a closed set she is trying to learn, and it is the same
 * reasoning that makes Roman numerals up-to-10 exhaustive — now applied to the
 * other two tiers as well.
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
 * How many cards a tier deals — its whole pool, because every tier is
 * exhaustive. Derived, so it cannot drift from the list it describes.
 *
 * This is what the manifest's `deckSize` literals are pinned against in
 * `flags.test.js`, and it is the only number the rest of the app may believe.
 *
 * @param {string} tier
 * @returns {number}
 */
export function deckSizeFor(tier) {
  return poolFor(tier).length
}

/**
 * One deck: the tier's whole pool, in a different order every session.
 *
 * `sample(pool, pool.length, rng)` rather than `shuffle(pool, rng)` deliberately.
 * The two draw the same distribution but consume the generator differently, and
 * `sample` is what shipped — so for any given seed `starter` deals the identical
 * twelve cards in the identical order it dealt before this change. That tier's
 * recipe is genuinely untouched, not merely the same size.
 *
 * @param {{ tier: string }} params
 * @param {() => number} rng
 * @returns {import('../manifestSchema').Question[]}
 */
export function generate(params, rng) {
  const pool = poolFor(params?.tier)
  const answers = sample(pool, pool.length, rng)

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
