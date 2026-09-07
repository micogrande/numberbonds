import React, { useState } from 'react'

import styles from './SleepingSlot.module.css'
import Bunny from './garden/Bunny'
import Pot from './garden/Pot'
import { CATEGORY_TINTS } from './garden/motifs'

/**
 * A category that has not been built yet. (PLAN 3.6)
 *
 * > Not locked, not greyed out — **asleep**. A padlock reads as a punishment or
 * > a paywall, and greyscale-at-40% makes five of the six things on her screen
 * > look broken. Asleep is warmer and it is honest: sleeping things wake up on
 * > their own schedule.
 *
 * No white face, no slab, no border: a pot and a curled bunny sitting directly
 * on the page. The position is held for spatial memory while the affordance is
 * unmistakably absent. Since she reads, the word says the state too — the slot
 * is labelled `oceans · asleep`.
 *
 * ── THE TAP IS NOT DEAD, AND THAT IS THE POINT ──────────────────────────────
 *
 * > Tapping one is **not a dead tap** — children read an unresponsive tap as
 * > "the device is broken", not "this isn't available". It wiggles ±2.5° for
 * > 400ms and a small "z z z" floats up and fades.
 *
 * Before this, tapping a sleeping slot did nothing whatsoever: it was a `<div>`
 * with a label in it. That is the house rule "no dead taps" broken on five of
 * the six things on her home screen.
 *
 * It does not escalate on repeat taps. The counter below exists ONLY to replay
 * the animation — a new `key` remounts the still life, which restarts the CSS
 * animation from zero, which is the whole mechanism. Tap number nine looks
 * exactly like tap number one, because sleeping things wake up on their own
 * schedule and there is nothing she can do about it. (PLAN 3.6 rejects the
 * alternative for the same reason: a seedling that grows a leaf per tap
 * "implies she can make the category arrive by tapping enough, which is a
 * promise the app cannot keep.")
 *
 * ── WHY A BUTTON WITH aria-disabled RATHER THAN A DIV ───────────────────────
 *
 * A `<div onClick>` needs `role` and `tabIndex` bolted on to be reachable at
 * all, and gets keyboard activation wrong. `disabled` is worse: it would eat
 * the click and re-create the dead tap this component exists to fix. A button
 * that is `aria-disabled` is announced as unavailable, is still focusable, and
 * still answers a tap — which is exactly the state being described.
 *
 * @param {Object} props
 * @param {{ id: string, title: string }} props.category
 */
const SleepingSlot = ({ category }) => {
  const [nudge, setNudge] = useState(0)

  return (
    <button
      type="button"
      className={styles.slot}
      aria-disabled="true"
      aria-label={`${category.title}, asleep`}
      onClick={() => setNudge((count) => count + 1)}
    >
      {/* Keyed on the tap count: a remount is what restarts the animation, and
          it costs three small inline SVGs. An `onAnimationEnd` flag would have
          been the same thing with a race in it. */}
      <span key={nudge} className={styles.still} data-nudged={nudge > 0}>
        <Bunny className={styles.bunny} pose="asleep" />
        <Pot className={styles.pot} tint={CATEGORY_TINTS[category.id]} />

        {nudge > 0 && (
          <span className={styles.zzz} aria-hidden="true">
            <span>z</span>
            <span>z</span>
            <span>z</span>
          </span>
        )}
      </span>

      {/* Full moss ink, 8.82:1 on the page — measured. PLAN 3.6: "'Asleep' is
          said by the picture and the missing slab, never by making the word
          harder to read." The rule this replaces faded it to 75%, which
          measures 3.12:1 and fails AA outright. */}
      <span className={styles.label}>{category.title} · asleep</span>
    </button>
  )
}

export default SleepingSlot
