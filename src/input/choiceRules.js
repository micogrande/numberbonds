/**
 * What a button looks like after a tap. (PLAN 4.4)
 *
 * Pure, no React, deliberately its own module — the same split, for the same two
 * reasons, as `keypadRules.js`:
 *
 *   - it is testable in the node environment (PLAN 6), so the sequence PLAN 4.4
 *     specifies is pinned by assertions rather than by whoever last read the
 *     component. This mapping *is* the behaviour: "the tapped wrong button
 *     shakes and then dims, and the correct button lights green and stays lit";
 *   - `react-refresh/only-export-components` is an error here, so a component
 *     file may not also export a helper.
 *
 * Nothing in here knows what an activity is, and nothing may ever dispatch on
 * one. It takes the phase, the id she tapped and the id that was right, and
 * answers with one of five words.
 */

/**
 * The five things a button can be. `wrong` lasts exactly one phase — the 500ms
 * shake — and then becomes `dimmed`, which is what PLAN 4.4 means by "dims
 * rather than crossing out".
 */
export const CHOICE_STATES = {
  /** Her turn. Nothing has been graded. */
  IDLE: 'idle',
  /** Not her button, while the app is busy answering. Present, not shouting. */
  QUIET: 'quiet',
  /** The button she tapped, being told "not that one". Movement only, no colour. */
  WRONG: 'wrong',
  /** The button she tapped, once the right one has been revealed. */
  DIMMED: 'dimmed',
  /** The right answer, lit green, and lit until the card advances. */
  CORRECT: 'correct',
}

/**
 * A choice id, a draft or a revealed answer, as one comparable string.
 *
 * A choice id may be a number (40) or a string ('ES'), and the draft the host
 * holds is always a string. Normalising both ends is how a button recognises
 * itself without this file caring which kind of id an activity uses. Empty is
 * `null` rather than `''` so "she has not tapped anything" is a different value
 * from "she tapped the button whose id is the empty string".
 *
 * @param {string|number|null|undefined} value
 * @returns {string|null}
 */
export function choiceKey(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

/**
 * How one button should look right now.
 *
 * The whole of PLAN 4.4's feedback, as a function:
 *
 *     phase        tapped button      correct button     the other two
 *     ─────────────────────────────────────────────────────────────────
 *     idle         idle               idle               idle
 *     success      correct            (it is the same)   quiet
 *     error        wrong  (shakes)    quiet              quiet
 *     correction   dimmed             correct  (green)   quiet
 *
 * The middle row is the one worth reading twice: during the 500ms shake nothing
 * is revealed, so the right answer is not lit yet. She is told "not that one"
 * first and "this one" second, which is the order PLAN 4.4 describes and the
 * order the session's phases already run in.
 *
 * @param {string} id            This choice's id, normalised by `choiceKey`.
 * @param {'idle'|'error'|'success'|'correction'} feedback  The session's phase.
 * @param {string|null} tapped   The id she pressed on this card, or null.
 * @param {string|null} answer   The correct id, or null outside the reveal.
 * @returns {string} one of CHOICE_STATES
 */
export function choiceState(id, feedback, tapped, answer) {
  if (feedback === 'idle' || feedback === undefined) return CHOICE_STATES.IDLE

  const isTapped = tapped !== null && id === tapped

  // The session only reaches `success` when the tapped answer graded correct, so
  // her button is the right one and there is nothing to reveal.
  if (feedback === 'success') return isTapped ? CHOICE_STATES.CORRECT : CHOICE_STATES.QUIET

  if (feedback === 'error') return isTapped ? CHOICE_STATES.WRONG : CHOICE_STATES.QUIET

  // The reveal. The right answer lights up; the one she chose steps back.
  if (answer !== null && id === answer) return CHOICE_STATES.CORRECT

  return isTapped ? CHOICE_STATES.DIMMED : CHOICE_STATES.QUIET
}
