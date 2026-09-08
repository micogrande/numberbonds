import React from 'react'

import styles from './Vine.module.css'
import Bloom from './Bloom'
import Bunny from './Bunny'
import GrassLine from './GrassLine'

/**
 * The day's to-do list, drawn as the bunny's journey along the vine.
 * (GOALS.md sections 1 and 3)
 *
 * > **The bunny travels the full width** of the header, left to right, and his
 * > journey ends at the top-right corner he already occupies. Finishing the day
 * > reassembles the home screen composition rather than changing it.
 *
 * That last clause is the design. He has always peeked over the top right; now
 * that is where he *arrives*, so a finished day is not a filled bar — it is the
 * picture she already knows, put back together. The owner chose full travel over
 * an inset version precisely because position along a line is the one progress
 * cue a six-year-old reads without counting.
 *
 * ── WHAT IT SAYS AND WHAT IT REFUSES TO SAY ─────────────────────────────────
 *
 * It says: here are the things to do today, here is how many are done, here is
 * how far along you are. In the past tense, always.
 *
 * It refuses to say: how many days in a row, when you last played, what you
 * missed. Those quantities are not styled away — they do not exist. `storage/
 * day.js` has nowhere to keep them, so no amount of editing this file could
 * surface one. GOALS.md section 4 has the reasoning; the short version is that a
 * six-year-old cannot make her family less busy on a Tuesday.
 *
 * ── GEOMETRY ────────────────────────────────────────────────────────────────
 *
 * One number, `--journey`, from 0 to 1. Blooms sit at 1/n, 2/n ... n/n of the
 * way along the rail; the bunny sits at completed/n. So the last bloom and a
 * finished journey are the same point, and he arrives *at* the final flower
 * rather than next to it.
 *
 * Positions are percentages of the rail, not pixels, so this needs no media
 * query and no measurement — it is correct at 320px and at 430px for the same
 * reason a flexbox is.
 *
 * @param {Object} props
 * @param {{ key: string, done: boolean, activity: Object, option: Object }[]} props.tasks
 * @param {number} props.completed
 * @param {number} props.total
 * @param {boolean} props.allDone
 * @param {string} [props.className]
 */
const Vine = ({ tasks, completed, total, allDone, className }) => {
  const journey = total > 0 ? completed / total : 0

  return (
    <div className={[styles.vine, className].filter(Boolean).join(' ')}>
      <GrassLine className={styles.grass} />

      {/* The rail is the travelled part of the header: blooms and bunny share
          one coordinate space so they cannot drift apart as it resizes. */}
      <div className={styles.rail} aria-hidden="true">
        {tasks.map((task, index) => (
          <Bloom
            key={`${task.key}-${index}`}
            open={task.done}
            className={styles.bloom}
            style={{ '--at': (index + 1) / total }}
          />
        ))}

        <Bunny
          className={styles.bunny}
          pose="peek"
          style={{ '--journey': journey }}
          data-arrived={allDone ? 'true' : undefined}
        />
      </div>

      {/* The same information without the picture. GOALS.md requires a text
          equivalent, and this is also what a parent gets if the SVG fails. */}
      <p className={styles.readout}>
        {allDone
          ? `You did all ${total} today.`
          : `You did ${completed} of ${total} today.`}
        <span className={styles.tasks}>
          {tasks.map((task) => `${task.option.label}${task.done ? ' — done' : ''}`).join('. ')}
        </span>
      </p>
    </div>
  )
}

export default Vine
