/**
 * The session loop, as a pure reducer. (PLAN 2.3)
 *
 * `useGame.js` becomes this: a reducer driving
 *
 *     answering --SUBMIT(correct)--> success              --ADVANCE--> next card
 *     answering --SUBMIT(wrong)----> shake --ADVANCE--> reveal --ADVANCE--> next card
 *
 * and, on the last card, straight to `complete` with the result already
 * computed. "advance" in PLAN's arrow chain is the *action*, not a resting
 * phase — there is nothing to draw while advancing.
 *
 * Two design constraints are the entire reason this file exists. Both are
 * structural: they do not patch the two critical bugs in PLAN 5, they make them
 * unrepresentable.
 *
 * 1. **The score and the completion are computed in here, from this state.**
 *    `useGame.js:74` closed over `score` in a `setTimeout`, so the last correct
 *    answer of a session never reached storage and a perfect run could never be
 *    recorded. A reducer has no closures to go stale: the SUBMIT that scores the
 *    final card and the ADVANCE that finishes the session read the same state
 *    object, one after the other.
 *
 * 2. **`epoch` increments on every phase transition.** A timeout is scheduled
 *    with the epoch that was current when its phase began and hands that epoch
 *    back in its action; anything that has happened since — the next card, a new
 *    session, a navigation — has already moved the epoch on, so the late action
 *    lands as a no-op. `useGame.js:98` never stored its timer handles, so an
 *    orphan from a previous session fired into the next one, showing a card from
 *    the old deck and silently skipping one.
 *
 * WHAT THIS FILE IS ALLOWED TO KNOW (PLAN 2.1): a question's `id`, its `answer`,
 * and `choices.length`. Nothing else. It must not import React, must not import
 * an engine, and must never learn what a number bond is. This is not tidiness —
 * it is what makes the same loop run a bond deck, a subtraction deck and a
 * multiple-choice roman numeral deck without a single conditional.
 *
 * Timings are NOT in here. The reducer is a machine of phases; how long a phase
 * lasts is the calling effect's problem, and `pendingTimeout()` at the bottom is
 * the one place that answers it.
 */

import { DEFAULT_TIMINGS } from '../feedback/motion'

/**
 * @typedef {Object} SessionQuestion
 * @property {string} [id]              Opaque here. Surfaced so the play screen can
 *                                      key the card on it (PLAN 2.1) and never read
 *                                      by this file for behaviour.
 * @property {string|number} answer     Graded with `===` after a light coercion.
 * @property {{id: string|number}[]} [choices]  Only its length is ever read.
 */

/**
 * The phases. `answering` is the only one that accepts input; the other three
 * are feedback, and `complete`/`abandoned` are terminal.
 */
export const PHASES = {
  ANSWERING: 'answering',
  SUCCESS: 'success',
  SHAKE: 'shake',
  REVEAL: 'reveal',
  COMPLETE: 'complete',
  ABANDONED: 'abandoned',
}

export const ACTIONS = {
  /** Begin a session on a freshly generated deck. Bumps the epoch past the old one. */
  START: 'START',
  /** A graded answer arrives from whichever input adapter is mounted (PLAN 2.4). */
  SUBMIT: 'SUBMIT',
  /** The current phase's timer elapsed. Carries the epoch it was scheduled with. */
  ADVANCE: 'ADVANCE',
  /** Left mid-game. Never scored (PLAN 2.5). */
  ABANDON: 'ABANDON',
}

/**
 * @typedef {Object} SessionResult
 * @property {number} score        Cards answered correctly, straight off the reducer.
 * @property {number} total        Deck size.
 * @property {number} wallMs       Wall-clock ms. Ranking stays on wall clock (PLAN 2.6).
 * @property {number} completedAt  Clock reading of the action that finished it.
 */

/**
 * @typedef {Object} SessionState
 * @property {SessionQuestion[]} deck
 * @property {number} index        Index of the card on screen. Stays on the last card
 *                                 when the session completes, exactly as the old hook
 *                                 left it, so a header rendered in the same frame does
 *                                 not flash "19 / 18".
 * @property {number} score
 * @property {string} phase        One of PHASES.
 * @property {number} epoch        Increments on every phase transition. Never resets
 *                                 within a mounted session — see START.
 * @property {number} startedAt    Clock reading when the session began.
 * @property {number} now          Latest clock reading seen. Monotonic.
 * @property {string|number|null} submitted  The value graded on this card, for display
 *                                 during feedback. Cleared when the next card arrives.
 * @property {string|number|null} revealed   The correct answer, non-null ONLY in the
 *                                 reveal phase. This is the "soft reveal of the right
 *                                 answer" from the house rules.
 * @property {number} nudge        Increments when a submission was empty. A counter,
 *                                 not a flag, so a consumer can re-run an animation on
 *                                 a second empty ENTER by keying on the number.
 * @property {SessionResult|null} result  Non-null only in the complete phase.
 */

/**
 * @param {SessionQuestion[]} deck
 * @param {{ startedAt?: number, epoch?: number }} [options]
 * @returns {SessionState}
 */
export function initSession(deck, options = {}) {
  // Loud, not silent. An empty deck means an engine or a manifest `deckSize` is
  // wrong, and a zero-card session would otherwise present as an instant,
  // unscoreable 0/0 that nobody could explain.
  if (!Array.isArray(deck) || deck.length === 0) {
    throw new TypeError(
      `initSession(): needs a non-empty deck, got ${Array.isArray(deck) ? 'an empty array' : String(deck)}`
    )
  }

  const startedAt = Number.isFinite(options.startedAt) ? options.startedAt : 0
  const epoch = Number.isFinite(options.epoch) ? options.epoch : 0

  return {
    deck,
    index: 0,
    score: 0,
    phase: PHASES.ANSWERING,
    epoch,
    startedAt,
    now: startedAt,
    submitted: null,
    revealed: null,
    nudge: 0,
    result: null,
  }
}

/**
 * Was that a real answer, or ENTER on an empty box?
 *
 * PLAN 5, low: "silent no-op on empty ENTER". Today `parseInt('')` is NaN and
 * the hook simply returns, so a six-year-old pressing the big green button gets
 * nothing at all — no sound, no movement, no reason. She presses it again
 * harder. The session turns it into a nudge instead.
 *
 * @param {unknown} value
 */
function isEmptySubmission(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

/**
 * Grade a submission against a question.
 *
 * The keypad hands over a string of digits and the answer is a number, so the
 * numeric path coerces before comparing — this is the `parseInt` the old hook
 * did, minus the silent NaN return. Everything else compares as text, which is
 * what a choice id ('ES') or a canonical clock string ('07:15') needs.
 *
 * This is the seam PLAN 2.4 reserves for an activity-supplied
 * `grade(question, value)`. It is deliberately NOT injectable yet: every answer
 * in every activity PLAN specifies is a comparable primitive, including the
 * roman numerals and the clock's canonical '07:15'. The case that needs the seam
 * is the composite `{h,m}` of a drag-the-hands clock, which PLAN 2.1 states
 * plainly is not covered and is not built. When it lands it plugs in here, and
 * the phases above do not change.
 *
 * @param {SessionQuestion} question
 * @param {string|number} value
 * @returns {boolean}
 */
export function gradeAnswer(question, value) {
  const answer = question?.answer

  if (typeof answer === 'number') {
    const numeric = typeof value === 'number' ? value : Number(String(value).trim())
    return Number.isFinite(numeric) && numeric === answer
  }

  return String(value) === String(answer)
}

/**
 * A clock reading that never runs backwards.
 *
 * `Date.now()` can jump backwards (a device clock correction, or the phone
 * crossing midnight on a time change). Personal bests rank on wall-clock time,
 * so a backwards jump mid-session would mint an unbeatable record.
 *
 * @param {SessionState} state
 * @param {{ at?: number }} action
 */
function clock(state, action) {
  return Number.isFinite(action.at) ? Math.max(state.now, action.at) : state.now
}

/**
 * The whole session loop. Pure: same state plus same action gives the same
 * result, every time, with no clock read and no randomness inside.
 *
 * @param {SessionState} state
 * @param {{ type: string, epoch?: number, at?: number, value?: string|number, deck?: SessionQuestion[] }} action
 * @returns {SessionState}
 */
export function sessionReducer(state, action) {
  if (!action || typeof action.type !== 'string') return state

  // The epoch gate. Any action may carry an epoch; one that carries a stale
  // epoch is a message from a session or a card that no longer exists, and is
  // dropped without a trace. Timers are the reason this exists, but the gate is
  // generic on purpose — a queued tap from a screen that has already navigated
  // away is the same problem wearing a different hat.
  if (Number.isFinite(action.epoch) && action.epoch !== state.epoch) return state

  const now = clock(state, action)

  switch (action.type) {
    case ACTIONS.START:
      // Epoch continuity across sessions is load-bearing: a timeout still in
      // flight from the session she just abandoned carries an epoch this new
      // session must never issue again. Counting on from the old epoch
      // guarantees that; resetting to 0 would let epoch 0 of the old deck fire
      // into card 1 of the new one — which is precisely the bug in PLAN 5.
      return initSession(action.deck, {
        startedAt: Number.isFinite(action.at) ? action.at : state.now,
        epoch: state.epoch + 1,
      })

    case ACTIONS.SUBMIT: {
      // Input is accepted in exactly one phase. Everything else — a second tap
      // during the shake, an ENTER while the answer is being revealed, a tap on
      // the summary — is ignored rather than queued.
      if (state.phase !== PHASES.ANSWERING) return state

      const question = state.deck[state.index]
      if (!question) return state

      if (isEmptySubmission(action.value)) {
        // Not a phase transition, so the epoch does not move: nothing was
        // scheduled and nothing needs invalidating. She just gets a wobble.
        return { ...state, now, nudge: state.nudge + 1 }
      }

      const correct = gradeAnswer(question, action.value)

      return {
        ...state,
        now,
        submitted: action.value,
        // The score moves HERE, in the reducer, on the same tick as the phase.
        // Nothing downstream ever has to be told what the score is.
        score: correct ? state.score + 1 : state.score,
        phase: correct ? PHASES.SUCCESS : PHASES.SHAKE,
        revealed: null,
        epoch: state.epoch + 1,
      }
    }

    case ACTIONS.ADVANCE: {
      // Halfway through the wrong-answer sequence: stop shaking, show her the
      // answer. Same card, same index, no score change.
      if (state.phase === PHASES.SHAKE) {
        return {
          ...state,
          now,
          phase: PHASES.REVEAL,
          revealed: state.deck[state.index].answer,
          epoch: state.epoch + 1,
        }
      }

      // Only a finished feedback phase may move the deck on. An ADVANCE that
      // arrives while she is still answering is not a timer of ours.
      if (state.phase !== PHASES.SUCCESS && state.phase !== PHASES.REVEAL) return state

      const nextIndex = state.index + 1

      if (nextIndex < state.deck.length) {
        return {
          ...state,
          now,
          index: nextIndex,
          phase: PHASES.ANSWERING,
          submitted: null,
          revealed: null,
          epoch: state.epoch + 1,
        }
      }

      // Session complete. `state.score` is this reducer's own, fully up to date,
      // including the card that was graded one action ago — the single fact the
      // whole file is built around.
      return {
        ...state,
        now,
        phase: PHASES.COMPLETE,
        submitted: null,
        revealed: null,
        epoch: state.epoch + 1,
        result: {
          score: state.score,
          total: state.deck.length,
          wallMs: Math.max(0, now - state.startedAt),
          completedAt: now,
        },
      }
    }

    case ACTIONS.ABANDON:
      // PLAN 2.5: back mid-game abandons the session and it is never scored. No
      // confirm modal, no partial credit, no result. A completed session is left
      // alone — she is on the summary looking at a result that already happened.
      if (state.phase === PHASES.COMPLETE) return state

      return {
        ...state,
        now,
        phase: PHASES.ABANDONED,
        submitted: null,
        revealed: null,
        result: null,
        epoch: state.epoch + 1,
      }

    default:
      return state
  }
}

/**
 * The card on screen, or null when there is not one.
 *
 * @param {SessionState} state
 * @returns {SessionQuestion|null}
 */
export function currentQuestion(state) {
  if (state.phase === PHASES.COMPLETE || state.phase === PHASES.ABANDONED) return null
  return state.deck[state.index] ?? null
}

/**
 * How many choices the current card offers, or null for a typed answer.
 *
 * This is the third and last thing the session is allowed to read off a question
 * (PLAN 2.1), and it is read for the input adapter and the aria announcement
 * only. Nothing in here dispatches on it, and nothing ever should — the moment
 * the loop branches on the shape of a card, it has stopped being a
 * deck-of-graded-cards loop.
 *
 * @param {SessionState} state
 * @returns {number|null}
 */
export function currentChoiceCount(state) {
  const choices = currentQuestion(state)?.choices
  return Array.isArray(choices) ? choices.length : null
}

/**
 * The one timer in the app, described as data. (PLAN 2.3)
 *
 * The caller's single `useEffect` reads this: null means "no timer", otherwise
 * schedule exactly one `setTimeout` for `delay` and dispatch
 * `{ type: 'ADVANCE', epoch }` when it fires. Because the epoch is captured here
 * and handed back in the action, a timer that outlives its phase is discarded by
 * the gate at the top of the reducer instead of corrupting the next card.
 *
 * The delays reproduce today's behaviour exactly, and PLAN 2.3 pins them: a
 * correct card holds for 1500ms; a wrong card shakes for 500ms and then sits on
 * the revealed answer until 2500ms have passed in total, which is why the reveal
 * hold is the difference of the two rather than a fourth number. Her personal
 * bests are wall-clock times measured against this pacing.
 *
 * @param {SessionState} state
 * @param {{shake: number, success: number, reveal: number}} [timings]
 * @returns {{ delay: number, epoch: number }|null}
 */
export function pendingTimeout(state, timings = DEFAULT_TIMINGS) {
  switch (state.phase) {
    case PHASES.SUCCESS:
      return { delay: timings.success, epoch: state.epoch }
    case PHASES.SHAKE:
      return { delay: timings.shake, epoch: state.epoch }
    case PHASES.REVEAL:
      return { delay: Math.max(0, timings.reveal - timings.shake), epoch: state.epoch }
    default:
      return null
  }
}

/**
 * The phase, named the way `shakeVariants` in feedback/motion.js names it.
 *
 * The variants were written against the old hook's `feedback` string, and the
 * screens still read that vocabulary. Keeping the translation here — one place,
 * covered by tests — is what lets the hook's return shape stay identical while
 * its insides are replaced (PLAN 7 step 5). Nothing dispatches on it.
 *
 * @param {string} phase
 * @returns {'idle'|'success'|'error'|'correction'}
 */
export function feedbackVariant(phase) {
  switch (phase) {
    case PHASES.SUCCESS:
      return 'success'
    case PHASES.SHAKE:
      return 'error'
    case PHASES.REVEAL:
      return 'correction'
    default:
      return 'idle'
  }
}
