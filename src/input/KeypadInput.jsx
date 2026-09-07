import React from 'react'
import Keypad from '../components/Keypad'
import { DEFAULT_MAX_DIGITS, KEYPAD_KEYS, applyKey } from './keypadRules'

/**
 * The keypad adapter. (PLAN 2.4)
 *
 * `components/Keypad.jsx` is the look and feel — twelve buttons that report which
 * one was pressed, and nothing else. `keypadRules.js` is what a press does to the
 * draft. This file is the join: it is the thing the registry mounts, and the only
 * thing here that is neither look nor rule is *when a draft becomes a submission*.
 *
 * The split matters because the rules are per-activity and the buttons are not.
 * Arithmetic caps the answer at two digits (PLAN 4.2 — the largest answer
 * anywhere in the app is 20); the old hook hardcoded three for everybody, in
 * `useSession.js`, where the session could see it. A session that knows answers
 * are *typed* cannot also run a multiple-choice deck, so the number moved here,
 * where it arrives from the manifest's `inputConfig`.
 *
 * This component holds no state. The draft lives on the play screen because two
 * things in two different corners of the layout render it — the answer box
 * inside the prompt, and these keys underneath — and one owner beats two copies
 * that can drift.
 */

/**
 * @param {import('./inputRegistry').InputAdapterProps} props
 */
const KeypadInput = ({ value = '', onChange, onSubmit, config, disabled = false }) => {
  const maxDigits = config?.maxDigits ?? DEFAULT_MAX_DIGITS

  const press = (key) => {
    // Belt and braces. The buttons are `disabled` in the DOM, so this can only
    // fire from a synthetic press; refusing it here too states the rule where
    // the rule lives.
    if (disabled) return

    if (key === KEYPAD_KEYS.SUBMIT) {
      // An empty draft is submitted, not swallowed. The session turns it into a
      // nudge and the answer box wobbles (PLAN 5, low: "silent no-op on empty
      // ENTER"). Filtering it out here is exactly how that fix gets lost.
      onSubmit(value)
      return
    }

    // An updater, not a value. Two presses that land in the same React batch —
    // a synthetic double-click, a test driving the buttons in one task — would
    // both read the same stale `value` prop and the second digit would be lost.
    // Reading the previous draft from React itself makes that unrepresentable,
    // and a press the rules refuse returns the identical string, which React
    // bails out of without a re-render.
    onChange((previous) => applyKey(previous, key, maxDigits))
  }

  return <Keypad onKeyPress={press} disabled={disabled} />
}

export default KeypadInput
