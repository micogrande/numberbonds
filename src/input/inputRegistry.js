/**
 * The input registry. (PLAN 2.4)
 *
 * Two entries — `keypad` and `choice` — behind **one** event: `SUBMIT {value}`.
 * That single sentence is the whole abstraction. A multiple-choice Roman numeral
 * and a keypad equation are the *same* session with a different adapter mounted
 * under the prompt; the session machine never learns which one it is, because
 * both of them hand it the same action.
 *
 * WHAT AN ADAPTER IS. A React component that takes the props below and calls
 * `onSubmit(value)`. It owns everything about *how* an answer is composed —
 * whether there is a draft at all, what a keypress does to it, how many digits
 * fit — and nothing about what happens next.
 *
 * @typedef {Object} InputAdapterProps
 * @property {string} value      The draft the host is holding for this card. Empty
 *                               string when nothing has been entered. An adapter
 *                               with no draft (choice) simply ignores it.
 * @property {(next: string | ((previous: string) => string)) => void} onChange
 *                               Report a new draft. The host owns the state so the
 *                               prompt's answer box can render it; the *rules* for
 *                               producing it stay in the adapter. It is a React
 *                               state setter, so an adapter whose next draft depends
 *                               on the current one should pass an updater and read
 *                               the previous value from React rather than from its
 *                               own props, which can be a batch behind.
 * @property {(value: string|number) => void} onSubmit  The one event. Empty is
 *                               passed through on purpose — the session turns it
 *                               into a nudge rather than silently doing nothing.
 * @property {Object} config     This activity's `inputConfig`, merged over the
 *                               mode's defaults. Shape is the adapter's business.
 * @property {boolean} disabled  True during every feedback phase. The session
 *                               refuses input then anyway; this is so the child can
 *                               SEE that it is not her turn instead of tapping a
 *                               live-looking key that does nothing.
 * @property {import('../activities/manifestSchema').Question} question
 *                               The card. Only an adapter that renders answers off
 *                               it (choice) reads this; the keypad never does.
 * @property {'idle'|'error'|'success'|'correction'} feedback
 *                               Which phase the session is in, in the same
 *                               vocabulary the prompt renderer is given. An adapter
 *                               whose buttons ARE the answers has to draw the
 *                               grading — the tapped button shaking, then the right
 *                               one lighting up (PLAN 4.4) — and until this prop
 *                               existed the play screen kept it to itself, which
 *                               made a choice adapter impossible to write from
 *                               inside an activity folder.
 * @property {string|number|null} revealed  The correct answer, non-null ONLY during
 *                               the reveal. Straight off the session, never written
 *                               into the draft. The keypad ignores it (the prompt's
 *                               answer box shows it instead); a choice adapter needs
 *                               it to know which button to light green.
 *
 * WHAT THIS FILE MUST NEVER LEARN: what activity is playing. It maps a mode name
 * to a component and a default config, and that is all (PLAN 2).
 */

import ChoiceInput from './ChoiceInput'
import KeypadInput from './KeypadInput'
import { DEFAULT_MAX_DIGITS } from './keypadRules'

/** The only two input modes there are. A manifest's `inputMode` is one of these. */
export const INPUT_MODES = {
  KEYPAD: 'keypad',
  CHOICE: 'choice',
}

/**
 * Both modes, both built.
 *
 * `choice` was deliberately present-and-unbuilt for three steps and resolving it
 * threw a sentence saying which step would fill it in. It is filled in now, which
 * is what makes a multiple-choice activity a folder and an import line rather
 * than a change to the input layer.
 */
const ENTRIES = {
  [INPUT_MODES.KEYPAD]: {
    mode: INPUT_MODES.KEYPAD,
    Component: KeypadInput,
    /**
     * What the app shipped with, kept as the default so a manifest that says
     * nothing behaves exactly as today. See `keypadRules.js` for why the default
     * is the permissive one.
     */
    defaults: { maxDigits: DEFAULT_MAX_DIGITS },
  },
  [INPUT_MODES.CHOICE]: {
    mode: INPUT_MODES.CHOICE,
    Component: ChoiceInput,
    /**
     * `columns: 2` is PLAN 4.4's 2×2 grid of four. `Art: null` is the seam for a
     * picture on a button — the activity supplies the component, because this
     * file may never learn what a flag is. PLAN 8 defers the shared dispatch
     * table until flags land; declaring the default here is what keeps the seam
     * visible without building it.
     */
    defaults: { columns: 2, Art: null },
  },
}

/**
 * Is this a mode the app knows about?
 *
 * @param {unknown} mode
 * @returns {boolean}
 */
export function isInputMode(mode) {
  return typeof mode === 'string' && Object.hasOwn(ENTRIES, mode)
}

/** Every declared mode, for whatever validates manifests. @returns {string[]} */
export function inputModes() {
  return Object.keys(ENTRIES)
}

/**
 * The component to mount for a mode, plus the config it should be handed.
 *
 * Throws rather than falling back. An unknown or unbuilt mode is a wiring
 * mistake in a manifest, and the cheapest possible moment to find out is the
 * first render of the play screen with the offending name in the message.
 *
 * @param {string} mode
 * @param {Object} [config]  The activity's `inputConfig`. Merged OVER the
 *   defaults, and `undefined` values are ignored so a half-filled manifest
 *   cannot blank out a default.
 * @returns {{ mode: string, Component: Function, config: Object }}
 */
export function resolveInput(mode, config) {
  if (!isInputMode(mode)) {
    throw new TypeError(
      `resolveInput(): unknown input mode ${JSON.stringify(mode)}. ` +
        `A manifest's inputMode must be one of: ${inputModes().join(', ')}.`
    )
  }

  const entry = ENTRIES[mode]

  // Both declared modes are built, so this is unreachable today. It stays
  // because the next mode to be declared will be declared before it is built —
  // that is how `choice` arrived — and the alternative is React reporting
  // "Element type is invalid" from inside the play screen with no mode name in
  // the message.
  if (!entry.Component) {
    throw new TypeError(
      `resolveInput(): the "${mode}" input mode is declared but has no adapter yet. ` +
        `Until one exists, no manifest may use it.`
    )
  }

  const merged = { ...entry.defaults }
  for (const [key, value] of Object.entries(config ?? {})) {
    if (value !== undefined) merged[key] = value
  }

  return { mode, Component: entry.Component, config: merged }
}
