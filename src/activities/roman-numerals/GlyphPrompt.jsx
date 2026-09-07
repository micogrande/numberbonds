import React from 'react'
import { motion } from 'framer-motion'

import styles from './GlyphPrompt.module.css'
import { circleVariants } from '../../feedback/motion'

/**
 * Roman numerals — the prompt renderer. (PLAN 2.2, PLAN 4.4)
 *
 * The whole card is one word in serif capitals. It reads `question.prompt` and
 * nothing else — no session state, no score, no idea what a distractor is —
 * which is the entire renderer contract (`screens/PlayScreen.jsx`).
 *
 * ── WHY IT IGNORES `userInput`, `feedback` AND `nudge` ──────────────────────
 *
 * The play screen hands every renderer four props. A renderer with no answer box
 * ignores the last three, and this one has no answer box: the answer is on a
 * button, so the grading is drawn *there* — the tapped wrong button shakes and
 * dims, the right one lights green (PLAN 4.4, `input/ChoiceInput.jsx`). Drawing
 * it twice would say the same thing in two places and take her eyes off the four
 * buttons she is choosing between.
 *
 * The numeral therefore does not move, flash or recolour when she answers. It
 * stays exactly where it was so she can check it against the button that lit up,
 * which is the moment the card actually teaches her something.
 *
 * ── HOW IT IS DRAWN ─────────────────────────────────────────────────────────
 *
 * PLAN 4.4: "Numeral rendered uppercase in a serif face with `letter-spacing ≥
 * 0.08em` so `III` is countable."
 *
 * All three parts of that are load-bearing and all three live in the stylesheet:
 * a serif, because the serifs put a visible fence between the strokes of `III`
 * where a sans-serif runs them into a picket fence; capitals, because a Roman
 * numeral is not a word and a lowercase `l` is a `1`; and the tracking, because
 * she is going to *count* those strokes and they have to come apart.
 *
 * The one thing this file does rather than the stylesheet is hand over how many
 * letters there are. `LXXXVIII` is eight characters and `X` is one, and a single
 * font size cannot serve both — at a size that makes `X` look like the subject of
 * the screen, `LXXXVIII` runs off a 390px phone. So the length goes into a custom
 * property and the size is a `clamp()` divided by it: every numeral ends up about
 * the same width on screen, which is also what stops the *length* of the numeral
 * being a clue she can read without reading it.
 */
const GlyphPrompt = ({ question }) => {
  if (!question) return null

  const { glyph, text } = question.prompt

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.glyph}
        // How many letters, so the size can be divided by it. The same trick
        // BondPrompt uses to keep its geometry in one place: the stylesheet owns
        // the look, the component owns the one number it cannot know.
        style={{ '--glyph-length': glyph.length }}
        variants={circleVariants}
        initial="hidden"
        animate="visible"
        // `role="img"` with the spaced reading from the engine: a screen reader
        // says "X L" rather than guessing at "excel" or reading it as a word.
        // PLAN 2.1's worked ROM-40 card carries `text:'X L'` for exactly this.
        role="img"
        aria-label={text}
      >
        {glyph}
      </motion.div>
    </div>
  )
}

export default GlyphPrompt
