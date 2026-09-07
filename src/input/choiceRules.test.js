import { describe, expect, it } from 'vitest'

import { CHOICE_STATES, choiceKey, choiceState } from './choiceRules'
import { PHASES, feedbackVariant } from '../session/sessionMachine'

/**
 * PLAN 4.4, as assertions. The phases are taken from the session machine rather
 * than typed as literals, so if the vocabulary the session speaks ever changes,
 * these fail here instead of failing silently on her phone by leaving every
 * button looking untouched.
 */

const ANSWERING = feedbackVariant(PHASES.ANSWERING)
const SUCCESS = feedbackVariant(PHASES.SUCCESS)
const SHAKE = feedbackVariant(PHASES.SHAKE)
const REVEAL = feedbackVariant(PHASES.REVEAL)

/** Four buttons, as a roman-numeral card would deal them: 40 is the answer. */
const BUTTONS = ['41', '60', '40', '39']

/** The four states, in button order, for one moment in the sequence. */
const row = (feedback, tapped, answer) =>
  BUTTONS.map((id) => choiceState(id, feedback, choiceKey(tapped), choiceKey(answer)))

describe('choiceKey', () => {
  it('makes a number id and a string draft comparable', () => {
    // The engine may deal `{ id: 40 }`; the host's draft is always a string.
    expect(choiceKey(40)).toBe('40')
    expect(choiceKey('40')).toBe('40')
    expect(choiceKey('ES')).toBe('ES')
  })

  it('says null for nothing, so "not tapped" is not an id', () => {
    expect(choiceKey('')).toBeNull()
    expect(choiceKey(null)).toBeNull()
    expect(choiceKey(undefined)).toBeNull()
  })

  it('keeps a legitimate zero', () => {
    // `0` is a real answer in this app — a bonds deck contains `0 + 10`.
    expect(choiceKey(0)).toBe('0')
  })
})

describe('before she taps', () => {
  it('leaves every button alone', () => {
    expect(row(ANSWERING, '', null)).toEqual([
      CHOICE_STATES.IDLE,
      CHOICE_STATES.IDLE,
      CHOICE_STATES.IDLE,
      CHOICE_STATES.IDLE,
    ])
  })
})

describe('a right answer', () => {
  it('lights her button green and quietens the rest', () => {
    // 1500ms of this, then the next card. `revealed` is null throughout: there
    // is nothing to reveal, she found it.
    expect(row(SUCCESS, 40, null)).toEqual([
      CHOICE_STATES.QUIET,
      CHOICE_STATES.QUIET,
      CHOICE_STATES.CORRECT,
      CHOICE_STATES.QUIET,
    ])
  })
})

describe('a wrong answer, in the order PLAN 4.4 puts it', () => {
  it('first shakes the button she tapped and reveals nothing', () => {
    // 500ms. The right answer is NOT lit yet — she is told "not that one"
    // before she is told "this one", and no other button moves or colours.
    expect(row(SHAKE, 41, null)).toEqual([
      CHOICE_STATES.WRONG,
      CHOICE_STATES.QUIET,
      CHOICE_STATES.QUIET,
      CHOICE_STATES.QUIET,
    ])
  })

  it('then dims hers and lights the right one, until the card advances', () => {
    // From 500ms to 2500ms. Dims: never a red X, never a cross (PLAN 4.4 and the
    // house rules both say so, and the stylesheet has no error colour in it).
    expect(row(REVEAL, 41, 40)).toEqual([
      CHOICE_STATES.DIMMED,
      CHOICE_STATES.QUIET,
      CHOICE_STATES.CORRECT,
      CHOICE_STATES.QUIET,
    ])
  })

  it('never marks a button wrong once the answer is up', () => {
    // The 'wrong' state exists for exactly one phase. If it leaked into the
    // reveal, her tap would still be shaking under the green one.
    expect(row(REVEAL, 41, 40)).not.toContain(CHOICE_STATES.WRONG)
  })
})

describe('the awkward cases', () => {
  it('lights nothing green if the reveal never named an answer', () => {
    // Defensive: `questionProblems` refuses a card whose answer is on no button,
    // so this cannot be reached from a validated deck. It must not throw or
    // light every button if it ever is.
    expect(row(REVEAL, 41, null)).toEqual([
      CHOICE_STATES.DIMMED,
      CHOICE_STATES.QUIET,
      CHOICE_STATES.QUIET,
      CHOICE_STATES.QUIET,
    ])
  })

  it('does not need a tap to light the answer', () => {
    expect(row(REVEAL, '', 40)).toEqual([
      CHOICE_STATES.QUIET,
      CHOICE_STATES.QUIET,
      CHOICE_STATES.CORRECT,
      CHOICE_STATES.QUIET,
    ])
  })

  it('matches a numeric id against a string draft', () => {
    // The whole point of `choiceKey`: the engine deals `{ id: 40 }` and the host
    // holds the draft `'40'`.
    expect(choiceState('40', SUCCESS, choiceKey('40'), null)).toBe(CHOICE_STATES.CORRECT)
    expect(choiceState('40', REVEAL, choiceKey('41'), choiceKey(40))).toBe(CHOICE_STATES.CORRECT)
  })

  it('treats an unknown phase as her turn rather than as feedback', () => {
    expect(choiceState('40', undefined, null, null)).toBe(CHOICE_STATES.IDLE)
  })
})
