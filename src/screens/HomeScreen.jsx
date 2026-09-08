import React from 'react'

import styles from './HomeScreen.module.css'
import Screen, { ScreenChrome, ScreenContent } from '../components/screen/Screen'
import { categoriesInOrder } from '../activities/registry'
import CategoryCard from '../components/CategoryCard'
import SleepingSlot from '../components/SleepingSlot'
import Ambient from '../components/garden/Ambient'
import Vine from '../components/garden/Vine'
import { useDailyGoal } from '../goals/useDailyGoal'

/**
 * Home — "Amelia's Garden". (PLAN 1, PLAN 3.3, PLAN 3.6)
 *
 * Six slots, rendered **entirely from the registry**. There is no list of
 * categories in this file and there must never be one: adding European flags is
 * a folder and an import line in `activities/registry.js`, and if that stops
 * being true the shape has been lost. What the garden pass added is a card
 * component and a sleeping-slot component — both driven by the same `category`
 * object this file already had, neither of which names a category.
 *
 * The four layers of PLAN 3.3, in order:
 *
 *   0. the ambient layer — two butterflies and the hills, BEHIND the cards,
 *      `pointer-events: none`, paused under reduced motion and in a hidden tab
 *   1. the header band, with the bunny peeking over the grass line
 *   2. the grid: two columns always, three rows, filling the viewport. The page
 *      cannot scroll, so the rows compress instead of overflowing
 *   3. nothing interactive at the bottom — children mis-tap bottom-edge
 *      controls, so the bottom of this page is hills and hills only
 *
 * ── WHAT CHANGED AND WHY IT IS HERE ─────────────────────────────────────────
 *
 * A sleeping slot used to be a `<div>` with a label in it, so tapping one did
 * NOTHING — the house rule "no dead taps" broken on five of the six things on
 * her screen, and a child reads an unresponsive tap as a broken device rather
 * than as "not yet". Fixing that needs a component with state, so the two slot
 * shapes are now two components; the branch below is otherwise unchanged.
 */
const HomeScreen = ({ onOpenCategory }) => {
  // Read here rather than in <Vine> so the vine stays a presentational
  // component: it is handed numbers and draws them, which is what makes it
  // testable and what lets the summary screen reuse it later.
  const goals = useDailyGoal()

  return (
  // growth="fixed", and the constant is written down in this source tree:
  // PLAN 1, "Six category slots exist on the home screen from day one and never
  // reorder." `activities/categories.js` throws in dev if that stops being six,
  // and says in the message what to change if it ever does.
  //
  // Home is the one screen in this app that was already correct, and it is
  // migrated with its geometry preserved to the pixel:
  // `grid-auto-rows: minmax(0, 1fr)` comes across character for character, the
  // header band keeps its own clamp, and the 8px bottom margin that every other
  // screen sets to 16 is handed to the shell as --screen-pad-end. The layout
  // regression test holds all of it to +/-1px against numbers captured before
  // any of this moved.
  <Screen growth="fixed" className={styles.home}>
    <Ambient />

    <ScreenChrome className={styles.header}>
      <h1 className={styles.welcome}>
        welcome
        <br />
        <span className={styles.name}>amelia</span>
      </h1>

      {/* The grass line, the day's blooms, and the bunny walking to them.
          (GOALS.md) He is still decoration and still never a target — what
          changed is that his position along the line now MEANS something, and
          a finished day puts him back in the top-right corner this composition
          was drawn around. */}
      <Vine className={styles.vine} {...goals} />
    </ScreenChrome>

    <ScreenContent mode="fill">
      <div className={styles.grid}>
        {categoriesInOrder().map((category, index) =>
          category.asleep ? (
            <SleepingSlot key={category.id} category={category} />
          ) : (
            <CategoryCard
              key={category.id}
              category={category}
              index={index}
              onOpen={() => onOpenCategory(category)}
            />
          )
        )}
      </div>
    </ScreenContent>
  </Screen>
  )
}

export default HomeScreen
