import React from 'react'

import styles from './PlacePrompt.module.css'

/**
 * The place she is being asked to locate. (WORLD.md)
 *
 * Text, set large, for the same reason the capitals prompt is: the question is
 * "which continent is X in", and the clearest prompt is X. A flag here would let
 * her answer by recognising the flag rather than knowing the continent.
 */
const PlacePrompt = ({ question }) => (
  <div className={styles.frame}>
    <p className={styles.lead}>which continent is</p>
    <p className={styles.place}>{question.prompt.art.value}</p>
    <p className={styles.lead}>in?</p>
  </div>
)

export default PlacePrompt
