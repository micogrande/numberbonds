/**
 * Where the correct answer sits among the buttons. (PLAN 4.4)
 *
 * Promoted out of `activities/roman-numerals/romanEngine.js` unchanged, because
 * every multiple-choice activity needs it and importing it across activity
 * folders would couple two activities — the one thing the registry shape exists
 * to prevent. It knows nothing about numerals, flags or clocks: it is a pure
 * combinatorial helper, and it belongs beside `rng.js`.
 *
 * The move was made as its own commit with no behaviour change, verified by
 * generating Roman decks across many seeds before and after and asserting they
 * are deep-equal. A refactor that changed a deck would silently invalidate the
 * high scores she already has.
 */

import { sample } from './rng'

/**
 * Loud, not silent — the same guard `bondEngine.js` uses, for the same reason:
 * a forgotten generator otherwise surfaces as "rng is not a function" from
 * inside a shuffle three frames later.
 *
 * @param {unknown} rng
 * @param {string} caller
 */
export function assertRng(rng, caller) {
  if (typeof rng !== 'function') {
    throw new TypeError(`${caller}(): needs an rng function — see lib/rng.js (PLAN 2.2 rule 3)`)
  }
}

/**
 * Where the correct answer sits on each card of a deck.
 *
 * > Correct-answer position is balanced across the deck (each of the four slots
 * > used 3×/3×/3×/3× at n=12) with **no position used twice in a row**, so she
 * > can never score by pattern or by thumb position.
 *
 * The counts are as equal as the count allows (10 cards over 4 slots is 3/3/2/2,
 * and which two slots get the extra is drawn, so a short deck does not always
 * favour the top-left button). The arrangement is then greedy: at each step take
 * the slot with the most cards still owed that is not the slot just used, ties
 * broken by the rng.
 *
 * Greedy-most-owed is not an optimisation, it is the *correctness* argument. A
 * plain shuffle-then-repair can paint itself into a corner (three of a kind left
 * and two cards to place); taking the most-owed slot first provably never can,
 * as long as no slot is owed more than half the remaining cards — which the
 * near-equal split guarantees. When it genuinely is impossible (one slot, two
 * cards) it throws rather than quietly repeating a position.
 *
 * @param {number} count  How many cards.
 * @param {number} slots  How many buttons per card.
 * @param {() => number} rng
 * @returns {number[]} `count` slot indices, no two adjacent alike
 */
export function balancedPositions(count, slots, rng) {
  assertRng(rng, 'balancedPositions')

  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`balancedPositions(): count must be a non-negative integer, got ${JSON.stringify(count)}`)
  }

  if (!Number.isInteger(slots) || slots < 1) {
    throw new RangeError(`balancedPositions(): slots must be a positive integer, got ${JSON.stringify(slots)}`)
  }

  const every = Array.from({ length: slots }, (_, index) => index)
  const owed = every.map(() => Math.floor(count / slots))

  for (const slot of sample(every, count % slots, rng)) owed[slot] += 1

  const out = []
  let previous = -1

  for (let index = 0; index < count; index++) {
    let most = 0
    let candidates = []

    for (const slot of every) {
      if (slot === previous || owed[slot] === 0) continue

      if (owed[slot] > most) {
        most = owed[slot]
        candidates = [slot]
      } else if (owed[slot] === most) {
        candidates.push(slot)
      }
    }

    if (candidates.length === 0) {
      throw new RangeError(
        `balancedPositions(): ${count} cards over ${slots} slot(s) cannot avoid repeating a position. ` +
          `Every card would be answerable by tapping where the last one was.`
      )
    }

    const chosen = candidates[Math.floor(rng() * candidates.length)]

    out.push(chosen)
    owed[chosen] -= 1
    previous = chosen
  }

  return out
}
