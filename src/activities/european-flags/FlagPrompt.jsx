import React from 'react'

import styles from './FlagPrompt.module.css'
import { FLAGS } from './flagData'

/**
 * One flag, shown large. (WORLD.md)
 *
 * ── ON dangerouslySetInnerHTML ──────────────────────────────────────────────
 *
 * The markup comes from `flagData.js`, which is a generated, committed, static
 * file — build-time content, never user input, never fetched at runtime. There
 * is no injection surface here: nothing a child or a stored value can reach ever
 * becomes part of this string. The alternative, parsing ~50 flags into React
 * elements at author time, would triple the file for no safety gain.
 *
 * Ids inside the set are already prefixed per country (`pt-a`, `hr-a`, and the
 * root `flag-icons-<code>`), which is what makes it safe to have four of these
 * on screen at once — see the note in `flagData.js`.
 *
 * The 4:3 box is fixed for every flag, including the square ones (Switzerland,
 * Vatican City), because four choice buttons need identical boxes. Official
 * ratios vary; a grid that reflowed per flag would tell her something about the
 * answer before she had read it.
 */
const FlagPrompt = ({ question }) => {
  const { code } = question.prompt.art
  const flag = FLAGS[code]

  if (!flag) return null

  return (
    <div className={styles.frame}>
      <svg
        className={styles.flag}
        viewBox={flag.viewBox}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="A flag. Which country is it?"
        dangerouslySetInnerHTML={{ __html: flag.svg }}
      />
    </div>
  )
}

export default FlagPrompt
