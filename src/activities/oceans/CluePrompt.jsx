import React from 'react'

import styles from './CluePrompt.module.css'

/**
 * The clue. (WORLD.md)
 *
 * There is no map, so the words carry the geography. The clue is a sentence
 * rather than a single name, which is why this prompt is set smaller than the
 * capitals one and allowed to wrap onto three lines.
 */
const CluePrompt = ({ question }) => (
  <div className={styles.frame}>
    <p className={styles.lead}>which water is</p>
    <p className={styles.clue}>{question.prompt.art.value}?</p>
  </div>
)

export default CluePrompt
