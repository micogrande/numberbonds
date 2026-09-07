import React from 'react'
import { motion } from 'framer-motion'

import styles from './EquationPrompt.module.css'
import { circleVariants } from '../../feedback/motion'
import AnswerBox from '../../input/AnswerBox'

/**
 * Arithmetic — the prompt renderer. (PLAN 2.2, PLAN 4.2, PLAN 4.3, PLAN 8)
 *
 * **One renderer, two activities.** `ADD` and `SUB` both deal `kind: 'EQUATION'`
 * cards and both mount this file. PLAN 8 is explicit that this needs no
 * machinery at all — "Two activities sharing `EquationPrompt` needs no
 * machinery" — so there is no dispatch table here, no `Art.jsx`, and nothing
 * that asks which activity is playing. The operator arrives inside
 * `question.prompt.terms` like every other part of the line, because the engine
 * has already decided what the card says.
 *
 * It reads `question.prompt` and nothing else — no session state, no score, no
 * idea what a block is — which is the whole renderer contract
 * (`screens/PlayScreen.jsx`).
 *
 * ── ONE LINE, AND THE BLANK IS ALWAYS LAST ──────────────────────────────────
 *
 * PLAN 4.2: "Rendered `17 + 4 = ␣` on one line", and "The missing value is
 * **always the result**, 100% of cards... keeping the unknown always immediately
 * right of `=` gives one stable visual grammar while she is still learning what
 * `=` means."
 *
 * So the terms stop at the equals sign and the answer box is what comes after
 * them. That is not this file taking a liberty — it is PLAN 2.1's worked card,
 * whose `terms` array ends with `{t:'op',v:'='}` and says nothing about what
 * follows. Missing-*addend* is precisely what Number Bonds already is.
 *
 * ── WHY THE ANSWER BOX IS THE SAME COMPONENT AS A BOND CIRCLE ───────────────
 *
 * `input/AnswerBox.jsx` brings the `?`, her draft, the reveal, the reaction to a
 * graded answer and the wobble on an empty ENTER; this file brings a slot after
 * the `=` instead of a circle in a diagram (PLAN 2.4). Same three states, same
 * reactions, same timings, two skins — which is what "all four activities feel
 * identical" means in practice.
 *
 * `userInput` is a **string** all the way from the play screen. It is never
 * `0`-as-a-number, because a bare `0` would render as an empty box.
 */
const EquationPrompt = ({ question, userInput = '', feedback = 'idle', nudge = 0 }) => {
  if (!question) return null

  const { terms, text } = question.prompt

  return (
    // `role="group"` + the engine's own reading of the card, so the line
    // announces as "17 minus 4 equals ?" rather than as four loose glyphs. The
    // live announcement of a graded answer belongs to step 13.
    <div className={styles.container} role="group" aria-label={text}>
      <div className={styles.equation}>
        {terms.map((term, index) => (
          <motion.span
            // Keyed on the card, so every card is a genuine remount and replays
            // its entrance — not just the first of the session (PLAN 2.1).
            key={`${question.id}-t${index}`}
            className={term.t === 'op' ? styles.operator : styles.number}
            variants={circleVariants}
            initial="hidden"
            animate="visible"
          >
            {term.v}
          </motion.span>
        ))}

        <AnswerBox className={styles.answer} value={userInput} feedback={feedback} nudge={nudge} />
      </div>
    </div>
  )
}

export default EquationPrompt
