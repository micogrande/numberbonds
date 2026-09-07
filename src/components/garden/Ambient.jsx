import React, { useEffect, useState } from 'react'

import Butterfly from './Butterfly'
import Hills from './Hills'
import styles from './Ambient.module.css'

/**
 * The layer behind the cards. (PLAN 3.3)
 *
 * > Ambient layer behind the cards: two butterflies on coprime 18s/26s paths so
 * > they never sync into a pattern. They pass *behind* the cards, which is what
 * > makes the page feel like a place rather than a screen. Paused in-game and on
 * > `visibilitychange`.
 *
 * Plus the two hills along the bottom, which live here for the same reason: it
 * is one non-interactive layer, `pointer-events: none` in one place, and the
 * home screen mounts it once and never thinks about it again.
 *
 * ── PAUSED IN-GAME ──────────────────────────────────────────────────────────
 *
 * That one is free: this mounts inside the home screen, and the shell renders
 * the play host *instead of* the home screen, so a running session has already
 * unmounted the butterflies. There is nothing to pause and no cross-screen
 * message to get wrong.
 *
 * ── PAUSED ON visibilitychange ──────────────────────────────────────────────
 *
 * That one is not free, and it is the only JavaScript in this file. A phone
 * with the screen off still runs CSS animations in a backgrounded tab on some
 * browsers, and this is a device with a small battery that a six-year-old
 * leaves on the home screen. `document.hidden` is read once at mount as well as
 * on the event, because the tab can be restored from bfcache already hidden.
 *
 * Reduced motion is handled entirely in CSS, through `--ambient-play`, which is
 * `paused` under the media query in `styles/variables.css`. The butterflies do
 * not disappear — they settle. Nothing is removed from her page because she
 * has a vestibular preference; it just stops moving.
 */
const Ambient = () => {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const sync = () => setPaused(document.hidden)

    sync()
    document.addEventListener('visibilitychange', sync)

    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  return (
    <div className={styles.layer} data-paused={paused} aria-hidden="true">
      {/*
        18s and 26s are PLAN's numbers. They are not strictly coprime — gcd 2,
        so the pair does repeat, every 234 seconds — but nobody watches a home
        screen for four minutes, and the point of the odd pairing is that the
        two are never briefly in step, which holds.
      */}
      <div className={`${styles.flight} ${styles.flightA}`}>
        <div className={styles.flutter}>
          <Butterfly className={styles.butterfly} />
        </div>
      </div>

      <div className={`${styles.flight} ${styles.flightB}`}>
        <div className={styles.flutter}>
          <Butterfly
            className={styles.butterfly}
            upper="var(--butter-400)"
            lower="var(--sage-400)"
          />
        </div>
      </div>

      <Hills className={styles.hills} />
    </div>
  )
}

export default Ambient
