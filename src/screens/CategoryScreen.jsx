import React from 'react'

import styles from './CategoryScreen.module.css'
import ScreenHeader from '../components/ScreenHeader'
import { activitiesInCategory } from '../activities/registry'

/**
 * One category, one screen. (PLAN 3.7)
 *
 * A full screen rather than an accordion or a bottom sheet: the page cannot
 * scroll, so revealing three activities inside the home grid would shove the
 * other cards off the bottom and slide the card she touched away from her
 * finger.
 *
 * Rendered entirely from the registry. This file cannot tell you that number
 * bonds exists — it asks what is filed under a category and draws whatever comes
 * back, which is why step 10 and step 11 add an activity without touching it.
 *
 * The way out is `ScreenHeader`'s one button, top-left, in the identical
 * position on every non-home screen (PLAN 3.7). It goes Home, not "up": one
 * consistent exit is worth more than navigational elegance to a six-year-old.
 * The hardware Back button is what goes up a level, and it always works.
 */
const CategoryScreen = ({ category, onBack, onOpenActivity }) => {
  const activities = activitiesInCategory(category.id)

  return (
    <div className={styles.screen}>
      <ScreenHeader onBack={onBack} />

      <h1 className={styles.title}>{category.title}</h1>

      <div className={styles.list}>
        {activities.length === 0 ? (
          // Unreachable while `validateRegistry` refuses an activity in a
          // sleeping category and the home screen refuses to open one — but a
          // screen that renders a list should say something when the list is
          // empty, rather than being a blank page with a back button.
          <p className={styles.empty}>Nothing here yet.</p>
        ) : (
          activities.map((activity) => (
            <button
              key={activity.id}
              type="button"
              className={styles.activity}
              onClick={() => onOpenActivity(activity)}
            >
              <span className={styles.activityTitle}>{activity.title}</span>
              <span className={styles.activitySubtitle}>{activity.subtitle}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default CategoryScreen
