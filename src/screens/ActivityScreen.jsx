import React, { useEffect, useState } from 'react'

import styles from './ActivityScreen.module.css'
import ScreenHeader from '../components/ScreenHeader'

/**
 * The option picker for one activity. (PLAN 2.2, PLAN 3.7)
 *
 * Pick a thing, press the big button, play. Two taps from here, and the button
 * says exactly what it will start — "Bonds to 10" — because she reads.
 *
 * Everything on this screen comes off the manifest: the title, the subtitle, the
 * options, their labels, and which of the two shapes to draw them in. No
 * activity is named in this file. `optionPicker: 'grid'` draws the 3–20 target
 * grid; `'list'` draws a column of full-width buttons for an activity with three
 * or four named levels.
 *
 * ── TWO LINES ON A LIST ROW ─────────────────────────────────────────────────
 *
 * A list row draws its `label` — one line, the whole sentence — unless the
 * option supplies a `caption`, and then it draws `short` big with the caption
 * beneath it. That is PLAN 3.7's roman chips exactly: "three chips reading X, L,
 * C with 'up to 10 / 50 / 100' beneath". Before it existed, the second line was
 * not expressible from a manifest at all, so shipping those chips meant editing
 * this file — which is precisely what the acceptance test for a new activity
 * forbids.
 *
 * The grid never draws a caption. Those are 50px buttons whose size and layout
 * are an owner decision confirmed on her actual phone (PLAN 9.2), and a second
 * line does not fit in one without resizing it. `defineActivity` refuses a grid
 * manifest that sets a caption rather than letting it vanish here.
 *
 * >>> THE GRID KEEPS ITS EXACT SIZE AND LAYOUT (PLAN 9.2, owner decision,
 * >>> confirmed on her actual phone). It is 18 buttons of 50px in six columns,
 * >>> and the rules that draw it were moved here character for character from
 * >>> the home screen this replaced.
 *
 * The selection starts on the option the shell remembers — her last choice, or
 * the manifest's default. PLAN 5's last low-severity bug is "target resets to 10
 * on every return home"; walking home and back no longer forgets. Surviving a
 * *reload* is `prefs.js`, step 9.
 */
const ActivityScreen = ({ activity, initialOptionId, onBack, onStart }) => {
  const [selectedId, setSelectedId] = useState(initialOptionId)

  /**
   * Start fetching the activity's chunk while she is choosing a number.
   *
   * `load()` is memoised, so this is the same promise the play host will unwrap
   * — the download simply happens during the seconds she spends looking at the
   * grid instead of after she presses the button. Without it, the first game
   * after a deploy sits on "Getting ready…" for as long as the chunk takes.
   *
   * The rejection is swallowed HERE only: the promise itself stays rejected, so
   * a failed load is still reported the moment the play screen asks for it, by
   * the error boundary, with a button she can press. Catching it stops an
   * unhandled-rejection warning for a fetch nobody is waiting on yet.
   */
  useEffect(() => {
    activity.load().catch(() => {})
  }, [activity])

  // The manifest guarantees at least one option, and the shell only ever passes
  // an id that came out of this activity — but a fallback here is one line and
  // the alternative is a start button with no label on it.
  const selected = activity.options.find((option) => option.id === selectedId) ?? activity.options[0]

  const isGrid = activity.optionPicker === 'grid'

  // A list whose options carry captions is a row of chips rather than a column
  // of sentences — PLAN 3.7 draws roman numerals as three chips side by side,
  // not as three full-width rows. One `some()` on the manifest decides it, so
  // there is still exactly one list shape and no activity is named.
  const isChips = !isGrid && activity.options.some((option) => typeof option.caption === 'string')

  return (
    <div className={styles.screen}>
      <ScreenHeader onBack={onBack} />

      <div className={styles.body}>
        <h1 className={styles.title}>{activity.title}</h1>
        <p className={styles.subtitle}>{activity.subtitle}</p>

        <div className={styles.picker}>
          <button type="button" className={styles.startButton} onClick={() => onStart(activity, selected)}>
            {selected.label}
          </button>

          <div
            className={`${isGrid ? styles.numberGrid : styles.optionList} ${isChips ? styles.chipRow : ''}`}
          >
            {activity.options.map((option) => {
              // A caption is a list-only feature and the manifest is validated
              // for it, so this reads as "did the manifest ask for two lines?"
              // rather than as a per-activity condition.
              const stacked = !isGrid && typeof option.caption === 'string'

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${isGrid ? styles.numberButton : styles.optionRow} ${
                    stacked ? styles.chip : ''
                  } ${option.id === selected.id ? styles.active : ''}`}
                  // The short form is what fits on a 50px button; the label is
                  // what a screen reader should say, and what the start button
                  // above is about to read. A two-line chip says "X" and "up to
                  // 10" on screen and the whole label out loud.
                  aria-label={option.label}
                  aria-pressed={option.id === selected.id}
                  onClick={() => setSelectedId(option.id)}
                >
                  {stacked ? (
                    <>
                      <span className={styles.chipShort}>{option.short}</span>
                      <span className={styles.chipCaption}>{option.caption}</span>
                    </>
                  ) : (
                    isGrid ? option.short : option.label
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActivityScreen
