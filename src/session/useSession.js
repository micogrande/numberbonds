/**
 * The session, mounted. (PLAN 2.3, PLAN 7 step 5)
 *
 * `sessionMachine.js` is the whole loop and it is pure. This file is the only
 * place that connects it to the two things a pure function cannot do: read a
 * clock, and wait.
 *
 * It is deliberately tiny, and it is deliberately the *only* owner of both.
 *
 *   - **Every action is stamped with `at: Date.now()`, in one place.** The
 *     reducer never reads a clock — that is what makes it replayable in a test —
 *     so an action that arrives without an `at` leaves `now` sitting on
 *     `startedAt` and the session records `wallMs: 0`. Ranking is on wall-clock
 *     time and ties break on it, so a zero would mint a record nothing could
 *     ever beat and freeze that key forever. `send()` below is the only way an
 *     action reaches the reducer, which is what makes forgetting impossible
 *     rather than merely unlikely.
 *
 *   - **There is exactly one `setTimeout` in the app and it is below.** Its
 *     handle is cleared by the effect's own cleanup, which React runs on unmount
 *     and before every re-run. `useGame.js:98` stored no handles at all:
 *     answering a card and tapping Home within 1.5s let the orphaned callback
 *     fire into the *next* session, rendering a card from the old deck and
 *     silently skipping one, and on the error path stamping the previous
 *     session's answer into the new input box. There is no handle to lose here,
 *     because the lifecycle owns it.
 *
 * The epoch is the second, independent guard. Even if a timer did escape, it
 * hands back the epoch it was scheduled with and the reducer's gate drops it.
 * Two mechanisms for one bug is not timidity: the first is structural, and the
 * second survives someone rewriting the first.
 *
 * WHAT THIS FILE MUST NEVER LEARN: what a card is, or how an answer was
 * composed. It takes a deck, grades through the reducer, and hands back state.
 * Nothing in here names an activity (PLAN 2).
 *
 * The half-typed answer used to live here too, with a hardcoded three-digit cap.
 * It moved out at step 7: the cap is per-activity (PLAN 4.2 caps arithmetic at
 * two) and a session that knows answers are *typed* cannot also run a
 * multiple-choice deck. The draft now belongs to the card on the play screen and
 * reaches the session only as the `value` of one `SUBMIT` (PLAN 2.4).
 */

import { useCallback, useEffect, useReducer } from 'react'
import { celebrateCorrect } from '../feedback/celebrate'
import {
  ACTIONS,
  PHASES,
  currentChoiceCount,
  currentQuestion,
  feedbackVariant,
  initSession,
  pendingTimeout,
  sessionReducer,
} from './sessionMachine'

/**
 * @param {() => import('./sessionMachine').SessionQuestion[]} createDeck
 */
function startFirstSession(createDeck) {
  return initSession(createDeck(), { startedAt: Date.now() })
}

/**
 * Run a deck.
 *
 * @param {() => import('./sessionMachine').SessionQuestion[]} createInitialDeck
 *   Called **once**, like `useState`'s lazy initialiser. The deck it returns is
 *   the one this hook starts on; every later deck arrives through `start(deck)`,
 *   which is what keeps the epoch counting forward across sessions instead of
 *   restarting it and letting an old timer match a new card.
 */
export function useSession(createInitialDeck) {
  const [state, dispatch] = useReducer(sessionReducer, createInitialDeck, startFirstSession)

  /**
   * The only route to the reducer, and the only clock reading in the session.
   * See the `at` note at the top of the file — this exists so that no future
   * action can be added without one.
   */
  const send = useCallback((action) => {
    dispatch({ ...action, at: Date.now() })
  }, [])

  const pending = pendingTimeout(state)
  const pendingDelay = pending === null ? null : pending.delay
  const pendingEpoch = pending === null ? null : pending.epoch

  // ── the one timer ────────────────────────────────────────────────────────
  //
  // The dependency array is those two scalars, and it must stay two scalars.
  //
  // A tidier will notice the effect sits beside `state` and "fix" the array to
  // `[state]`. Every keystroke changes `state`, so the effect would tear down
  // and re-create the pending advance on each one: the 1500ms the child is
  // waiting through would restart from zero every time she touched a key, and
  // with a fast enough hand the advance would never fire at all — leaving her
  // stranded on a revealed answer with no way on but the Home button.
  //
  // Depending on `pending` itself is the same bug wearing a hat: `pendingTimeout`
  // builds a fresh object every render, so the array would never compare equal.
  //
  // These two numbers change together, on exactly the transitions that deserve a
  // new timer — the epoch moves on every phase change, see sessionMachine — and
  // on nothing else. That is the entire reason they are read out as scalars
  // before the effect rather than inside it.
  useEffect(() => {
    if (pendingDelay === null) return undefined

    const id = setTimeout(() => {
      // Nothing to clear. The half-typed answer belongs to the card, and the card
      // is a keyed component on the play screen (PLAN 2.4) — the advance replaces
      // it, so the draft goes with it structurally rather than by message.
      send({ type: ACTIONS.ADVANCE, epoch: pendingEpoch })
    }, pendingDelay)

    return () => clearTimeout(id)
  }, [pendingDelay, pendingEpoch, send])

  // Confetti is a side effect and a pure reducer cannot have one, so it fires
  // here — keyed on the EPOCH rather than the phase, because a re-render inside
  // the same 1500ms success hold would otherwise throw a second hundred
  // particles across the screen.
  const celebratedEpoch = state.phase === PHASES.SUCCESS ? state.epoch : null

  useEffect(() => {
    if (celebratedEpoch === null) return
    celebrateCorrect()
  }, [celebratedEpoch])

  const start = useCallback(
    (deck) => {
      send({ type: ACTIONS.START, deck })
    },
    [send]
  )

  const submit = useCallback(
    (value) => {
      // Empty is passed through on purpose. The reducer turns it into a nudge
      // (PLAN 5, low: "silent no-op on empty ENTER"); filtering it out here
      // would quietly throw that fix away.
      send({ type: ACTIONS.SUBMIT, value })
    },
    [send]
  )

  const abandon = useCallback(() => {
    send({ type: ACTIONS.ABANDON })
  }, [send])

  return {
    /** The raw machine state. The escape hatch for whatever is hosting the session. */
    state,
    question: currentQuestion(state),
    choiceCount: currentChoiceCount(state),
    feedback: feedbackVariant(state.phase),
    isComplete: state.phase === PHASES.COMPLETE,
    score: state.score,
    total: state.deck.length,
    index: state.index,
    startedAt: state.startedAt,
    result: state.result,
    /** Counts empty ENTERs, so the answer box can wobble instead of doing nothing. */
    nudge: state.nudge,
    /**
     * The correct answer, non-null ONLY during a reveal. The play screen shows it
     * in the answer box in place of her attempt. It is never written into the
     * draft: writing it there is exactly what let an orphaned timer stamp the
     * previous session's answer into a fresh box.
     */
    revealed: state.revealed,
    submit,
    start,
    abandon,
  }
}
