import React, { useState } from 'react'

import styles from './GrownupsScreen.module.css'
import Screen, { ScreenChrome, ScreenContent } from '../components/screen/Screen'
import ScreenHeader from '../components/ScreenHeader'
import { listableActivities, resolveTasks } from '../goals/goals'
import { MAX_TASKS, readTasks, writeTasks } from '../storage/goalConfig'

/**
 * Today's list, for her dad. (GOALS.md section 1)
 *
 * > **Her dad sets it inside the app.** Not a code constant. A grown-ups screen.
 * > **The list is STANDING.** It applies every day until he changes it.
 *
 * ── THIS IS THE ONE SCREEN NOT BUILT FOR A CHILD ────────────────────────────
 *
 * Everything else in this app is 72px targets, one decision per screen and a
 * picture doing the explaining. None of that applies here. This is a settings
 * page for a competent adult who opens it rarely, so it is dense, wordy and
 * plain on purpose — and it should LOOK like a settings page, because the moment
 * it looks like part of the garden is the moment she taps it thinking it is a
 * game.
 *
 * It is reached by typing `#/grownups` and is linked from nowhere. That is the
 * entire access control and it is proportionate: the worst case is that she
 * finds it and rewrites her own to-do list, which is not a breach, it is a
 * Tuesday.
 *
 * ── WHY A FLAT LIST OF EVERY ACTIVITY-AND-OPTION ────────────────────────────
 *
 * A task names an activity AND an option (GOALS.md section 2) — "Bonds to 10"
 * and "Bonds to 20" are different practice — so the thing being picked is the
 * pair, and the simplest honest control is one row per pair. It is a long list,
 * and it is a long list for an adult with a scroll wheel rather than for a child
 * with a thumb.
 *
 * Ordering, count and duplicates all come from tapping: tap to add to the end of
 * the day, tap again to add a second copy (which is a legitimate "do this
 * twice"), and remove from the chosen list. Nothing is dragged, because drag is
 * the one interaction this project has already decided it does not do.
 */
const GrownupsScreen = ({ onDone }) => {
  const [tasks, setTasks] = useState(() => readTasks() ?? [])
  const [saved, setSaved] = useState(false)

  const activities = listableActivities()

  // What she would get if he saves nothing. `resolveTasks(null)` rather than
  // `readGoals(now)` deliberately: the defaults do not depend on the clock, and
  // reading one during render is impure — `react-hooks/purity` is right to stop
  // it, and there is nothing here that needs to know what day it is.
  const fallback = resolveTasks(null)

  const change = (next) => {
    setTasks(next)
    setSaved(false)
  }

  const add = (activity, option) => {
    if (tasks.length >= MAX_TASKS) return
    change([...tasks, { activityId: activity.id, optionId: option.id }])
  }

  const removeAt = (index) => change(tasks.filter((_, i) => i !== index))

  const save = () => {
    writeTasks(tasks)
    setSaved(true)
  }

  const labelFor = ({ activityId, optionId }) => {
    const activity = activities.find((a) => a.id === activityId)
    const option = activity?.options.find((o) => o.id === optionId)

    return option ? `${activity.title} — ${option.label}` : `${activityId} / ${optionId}`
  }

  return (
    <Screen growth="flow" className={styles.grownups}>
      {/* The SAME gate as every other non-home screen, in the same pixel.
          This screen first shipped with a bespoke "Done" button instead, and
          the layout suite refused it: "one way home, always the same pixel" is
          a house rule, and an adults-only screen is not an exemption from it —
          it is where a tired parent is most likely to want the familiar exit. */}
      <ScreenChrome>
        <ScreenHeader onBack={onDone} />
        <h1 className={styles.title}>Amelia&rsquo;s daily list</h1>
      </ScreenChrome>

      <ScreenContent>
        <p className={styles.blurb}>
          Pick up to {MAX_TASKS} things for her to do. They become the flowers on the vine at the top
          of her home screen, and the bunny walks along it as she finishes them. The same list applies
          every day until you change it. Listing something twice means she should do it twice.
        </p>

        <section className={styles.section}>
          <h2 className={styles.heading}>
            Today&rsquo;s list {tasks.length > 0 && <span className={styles.count}>{tasks.length}/{MAX_TASKS}</span>}
          </h2>

          {tasks.length === 0 ? (
            <p className={styles.empty}>
              Nothing chosen, so she gets a sensible default:{' '}
              {fallback.map((task) => task.option.label).join(', ')}.
            </p>
          ) : (
            <ol className={styles.chosen}>
              {tasks.map((task, index) => (
                <li key={`${task.activityId}-${task.optionId}-${index}`} className={styles.chosenRow}>
                  <span>{labelFor(task)}</span>
                  <button type="button" className={styles.remove} onClick={() => removeAt(index)}>
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Add</h2>

          {activities.map((activity) => (
            <div key={activity.id} className={styles.activity}>
              <h3 className={styles.activityName}>{activity.title}</h3>
              <div className={styles.options}>
                {activity.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={styles.option}
                    disabled={tasks.length >= MAX_TASKS}
                    onClick={() => add(activity, option)}
                  >
                    {option.short ?? option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <div className={styles.actions}>
          <button type="button" className={styles.save} onClick={save}>
            Save
          </button>
          {saved && <span className={styles.savedNote}>Saved. It applies from her next session.</span>}
        </div>
      </ScreenContent>
    </Screen>
  )
}

export default GrownupsScreen
