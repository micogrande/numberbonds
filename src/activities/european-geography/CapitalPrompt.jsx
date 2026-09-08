import React from 'react'

import styles from './CapitalPrompt.module.css'

/**
 * The country whose capital she is being asked for. (WORLD.md)
 *
 * Text, set large — there is no artwork in this option, and that is not a gap
 * waiting to be filled. The question is "what is the capital of X", and the
 * clearest possible prompt is X, big. A flag here would let her answer by
 * recognising the flag instead of knowing the capital, which is a different
 * activity that already exists next door.
 */
const CapitalPrompt = ({ question }) => (
  <div className={styles.frame}>
    <p className={styles.lead}>capital of</p>
    <p className={styles.country}>{question.prompt.art.value}</p>
  </div>
)

export default CapitalPrompt
