/**
 * What a keypress means. (PLAN 2.4)
 *
 * Pure string handling, no React, deliberately its own module. Two reasons, and
 * the second is the load-bearing one:
 *
 *   - it is testable in the node environment, like every other rule in this app
 *     (PLAN 6), so the digit cap and the leading zero are pinned by assertions
 *     rather than by whoever last read the component;
 *   - `react-refresh/only-export-components` is an **error** here (PLAN 7 step 1),
 *     so a component file may not also export a helper. `KeypadInput.jsx` is a
 *     component and `Keypad.jsx` is a component; the rules they share have to
 *     live somewhere that is neither.
 *
 * This is one file more than the `input/` listing in PLAN 2.7. It is the lint
 * rule's shape, not a new concept: the alternative is a shared constant spelled
 * twice in two files that must agree.
 */

/** The two keys that are not digits. One spelling, imported by both sides. */
export const KEYPAD_KEYS = {
  SUBMIT: 'ENTER',
  DELETE: 'DEL',
}

/**
 * The cap the app shipped with, and the fallback when a manifest supplies none.
 * Every activity PLAN specifies overrides it with 2 — the largest answer
 * anywhere is 20 (PLAN 4.2, 4.3) — but the default has to be the *safe* one: a
 * cap that is too small silently makes a correct answer untypeable.
 */
export const DEFAULT_MAX_DIGITS = 3

/**
 * A keypress applied to the draft answer.
 *
 *   - **The cap.** `maxDigits` digits and no more. Over the cap the press is
 *     refused rather than wrapping or replacing, so what she typed is still
 *     there to delete.
 *   - **Leading-zero suppression.** `0` then `5` is `5`, not `05`. A lone `0`
 *     survives, because `0` is a real answer in this app: a number bond deck
 *     contains a `0 + 10` card, so the box cannot simply refuse a first zero.
 *
 * Anything that is not a digit or DELETE is ignored, which is what stops a key
 * added later — a decimal point, a minus sign — landing in an answer box
 * silently.
 *
 * @param {string} buffer      The current draft.
 * @param {string} key         A digit '0'-'9', or KEYPAD_KEYS.DELETE.
 * @param {number} [maxDigits]
 * @returns {string} The next draft. Unchanged if the press is refused.
 */
export function applyKey(buffer, key, maxDigits = DEFAULT_MAX_DIGITS) {
  const current = String(buffer ?? '')

  if (key === KEYPAD_KEYS.DELETE) return current.slice(0, -1)
  if (!/^[0-9]$/.test(String(key))) return current

  const cap = Number.isInteger(maxDigits) && maxDigits > 0 ? maxDigits : DEFAULT_MAX_DIGITS
  const base = current === '0' ? '' : current

  if (base.length >= cap) return current

  return base + key
}
