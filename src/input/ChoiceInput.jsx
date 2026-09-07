import React, { useEffect } from 'react'

import styles from './ChoiceInput.module.css'
import { choiceKey, choiceState } from './choiceRules'

/**
 * The choice adapter. (PLAN 2.4, PLAN 4.4)
 *
 * Four big buttons in a 2×2 grid. The second of the two input modes, and the one
 * that proves the abstraction: a multiple-choice roman numeral and a keypad
 * equation are the *same* session with a different adapter mounted under the
 * prompt, and the session never learns which one it is — both hand it one
 * `SUBMIT {value}`.
 *
 * It renders `question.choices` and nothing else. It does not know what a roman
 * numeral is, it never sees the deck, the score or the timer, and no activity is
 * named anywhere in this file. That is what makes it the last piece a
 * multiple-choice activity needs from outside its own folder.
 *
 * ── WHAT A TAP LOOKS LIKE (PLAN 4.4) ────────────────────────────────────────
 *
 *     right    the button she tapped lights green and stays lit for 1500ms
 *     wrong    the button she tapped shakes for 500ms and then DIMS, and the
 *              correct button lights green and stays lit until the card advances
 *              at 2500ms
 *
 * **Never a red X and never a cross.** The error colour is not used here at all:
 * a wrong answer is said by movement and then by absence, and the only colour on
 * the screen afterwards is the green of the right answer. That is the house rule
 * ("never a harsh X, never alarm red") and PLAN 4.4 states it twice.
 *
 * Three facts drive all of that, and all three arrive as props:
 *
 *     feedback   which phase the session is in — the same string the prompt gets
 *     revealed   the correct answer, non-null ONLY during the reveal
 *     value      the draft, which for this adapter is the id she tapped
 *
 * The third is why a tap writes to the draft before it submits. The host owns
 * the draft (`PlayScreen.jsx`) and clears it structurally by keying the card on
 * `question.id`, so "which button did she press" needs no state of its own here
 * and cannot survive into the next card. `feedback` and `revealed` reach an
 * adapter at all because of this file: until it existed, `PlayScreen` passed
 * neither, so no choice adapter could have shown which button was wrong.
 *
 * ── WHY THERE IS NO framer-motion IN HERE ───────────────────────────────────
 *
 * **Not for the reason that used to be written here.** The old note said that
 * importing framer-motion in this file would put 115kB of it into the first
 * chunk she downloads. That was true when it was written and is not true now:
 * PLAN 3.4 gives the home screen's category cards a release spring, so
 * `components/CategoryCard.jsx` imports framer-motion, and `HomeScreen` →
 * `Shell` → `App` → `main.jsx` is a chain of static imports. The library is in
 * the boot chunk before this file has an opinion. Measured on the current build:
 * the entry chunk is 362.43 kB with it and 246.30 kB without — 116 kB, 38 kB
 * gzipped, and the first screen she ever sees already pays all of it.
 * `bootChunk.test.js` now asserts that, so the claim cannot rot again unnoticed.
 *
 * The other half of the old note still holds and is worth keeping: this adapter
 * IS eagerly reachable. `manifestSchema.js` imports the input registry to
 * validate `inputMode`, and every manifest is loaded at boot, so `ChoiceInput`
 * is in the first chunk whether or not she ever plays a multiple-choice game.
 * It just no longer follows that its imports are free to be expensive — they
 * are, and being careful here is now a matter of not making the entry chunk
 * *worse*, not of keeping a boundary that exists.
 *
 * So the decision was re-taken on what is left, and it is unchanged:
 *
 *   - **Latency.** This is the inner loop of the play screen, where the house
 *     rule is an answer to every tap within ~100ms. Four `motion.button`s stay
 *     mounted for the whole session, each subscribing to the motion runtime, to
 *     run animations that are already a pure function of two props.
 *   - **There is nothing framer-motion would express better.** Shake, dim and
 *     light-green are declarative state, not gesture: `data-state` on the button
 *     plus keyframes in `ChoiceInput.module.css` say the same thing, start on
 *     the frame the attribute changes, and cannot arrive a tick late. Compare
 *     `CategoryCard`, which genuinely needs both — CSS `:active` for the depress
 *     and framer-motion for the release spring, on different elements and
 *     different properties, because a spring is not expressible in a keyframe.
 *   - **Reduced motion is already right.** The stylesheet swaps the shake for a
 *     colour pulse under `prefers-reduced-motion` (PLAN 3.4: feedback never
 *     disappears, only motion does). That is four lines of CSS, not a prop
 *     threaded through four buttons.
 *
 * Confetti on a correct answer is unchanged; it belongs to the session, not to
 * this file.
 *
 * ── ART ─────────────────────────────────────────────────────────────────────
 *
 * A choice may carry opaque `art` data (`{ kind:'flag', code:'ES' }`). The
 * component that draws it comes from this activity's own `inputConfig.Art`, so a
 * flag deck can supply its flags without a single shared file learning what a
 * flag is. **There is no dispatch table here and none is coming until flags
 * actually land** — PLAN 8 defers `Art.jsx` on purpose, and two activities
 * sharing a renderer need no machinery at all.
 *
 * The label is drawn *with* the art rather than replaced by it. PLAN 2.1 calls
 * art "a picture instead of the label text", but Amelia reads, an icon-only
 * interface is explicitly rejected in PLAN's own "Who this is for", and a button
 * whose picture fails to draw must still say what it is. The picture makes the
 * grid scannable; the word says which one it is.
 */

/**
 * @param {import('./inputRegistry').InputAdapterProps} props
 */
const ChoiceInput = ({
  question,
  value = '',
  onChange,
  onSubmit,
  config,
  disabled = false,
  feedback = 'idle',
  revealed = null,
}) => {
  const choices = Array.isArray(question?.choices) ? question.choices : []
  const columns = Number.isInteger(config?.columns) && config.columns > 0 ? config.columns : 2
  const Art = config?.Art ?? null

  // Strings on both sides, and null for "nothing". The mapping from these two
  // to what a button looks like is `choiceRules.js` — pure, and tested against
  // PLAN 4.4's sequence, because it IS the behaviour this adapter exists for.
  const tapped = choiceKey(value)
  const answer = choiceKey(revealed)

  // Dev only, once per card. Art data with no component to draw it is the exact
  // shape of defect this adapter exists to stop repeating: something declared in
  // the contract, accepted without complaint, and then silently ignored. The
  // button still says its label, so she is never stuck — but the author hears
  // about it on the first card rather than from a screenshot.
  const artWithoutRenderer = Art === null && choices.some((choice) => choice?.art)

  useEffect(() => {
    if (!import.meta.env.DEV || !artWithoutRenderer) return
    console.warn(
      'ChoiceInput: a choice carries `art` but this activity supplied no `inputConfig.Art` to draw it. ' +
        'Rendering the label alone. See input/ChoiceInput.jsx.'
    )
  }, [artWithoutRenderer, question?.id])

  const choose = (choice) => {
    // Belt and braces: the buttons carry `disabled` in the DOM and the session
    // refuses input outside `answering` anyway. Stating the rule here too is what
    // stops a synthetic double-tap grading the next card (matches the keypad).
    if (disabled) return

    // Remember which one she pressed, in the one place that owns the draft. This
    // is the whole of "the tapped wrong button dims" — no state of this
    // component's own, and nothing to clear, because the card it belongs to is
    // replaced wholesale when the session advances.
    onChange(String(choice.id))

    // The id, not the string: PLAN 2.1 grades `choice.id` against
    // `question.answer`, and an activity whose answers are numbers should not
    // have to care that a button was involved.
    onSubmit(choice.id)
  }

  return (
    <div
      className={styles.grid}
      style={{ '--choice-columns': columns }}
      // Whose turn it is, stated in the DOM. Each button already shows it for
      // itself, so nothing styles this — it is here so "was input refused?" is
      // answerable without a screen, the same reason the answer box carries its
      // nudge count.
      data-disabled={disabled ? 'true' : 'false'}
      // Not a radiogroup and not a listbox: these are four buttons, each of which
      // ends the turn. A group with a name is what a screen reader needs to say
      // what the four belong to.
      role="group"
      aria-label="Answers"
    >
      {choices.map((choice) => {
        const id = String(choice.id)

        return (
          <button
            key={id}
            type="button"
            className={styles.choice}
            data-state={choiceState(id, feedback, tapped, answer)}
            disabled={disabled}
            // The label is the accessible name whether or not there is a picture
            // above it (PLAN 2.1: "Always present — doubles as the aria-label").
            aria-label={choice.label}
            onClick={() => choose(choice)}
          >
            {choice.art && Art ? (
              <span className={styles.art} aria-hidden="true">
                <Art art={choice.art} />
              </span>
            ) : null}

            <span className={styles.label}>{choice.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default ChoiceInput
