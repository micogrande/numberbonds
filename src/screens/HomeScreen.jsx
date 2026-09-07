import React from 'react'

import styles from './HomeScreen.module.css'
import { categoriesInOrder } from '../activities/registry'
import CategoryCard from '../components/CategoryCard'
import SleepingSlot from '../components/SleepingSlot'
import Ambient from '../components/garden/Ambient'
import Bunny from '../components/garden/Bunny'
import GrassLine from '../components/garden/GrassLine'

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
const HomeScreen = ({ onOpenCategory }) => (
  <div className={styles.screen}>
    <Ambient />

    <div className={styles.header}>
      <h1 className={styles.welcome}>
        welcome
        <br />
        <span className={styles.name}>amelia</span>
      </h1>

      {/* Peeking over the grass line at the top right, ears breaking through
          it. He is decoration and is never a target (PLAN 3.3). */}
      <Bunny className={styles.bunny} pose="peek" />

      {/* Plants the header on the ground without a rule or a card. */}
      <GrassLine className={styles.grass} />
    </div>

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
  </div>
)

export default HomeScreen
