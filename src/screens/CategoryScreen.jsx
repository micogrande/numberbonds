import React from 'react'

import styles from './CategoryScreen.module.css'
import shell from '../components/screen/Screen.module.css'
import Screen, { ScreenChrome, ScreenContent } from '../components/screen/Screen'
import ScreenHeader from '../components/ScreenHeader'
import { activitiesInCategory } from '../activities/registry'

/**
 * One category, one screen. (PLAN 3.7)
 *
 * A full screen rather than an accordion or a bottom sheet, for the reasons PLAN
 * 3.7 gives — an accordion would shove the other home cards off the bottom and
 * slide the card she touched away from her finger; a bottom sheet leaves two
 * surfaces live at once and puts controls on the bottom edge where children
 * mis-tap. Those conclusions are unchanged.
 *
 * Rendered entirely from the registry. This file cannot tell you that number
 * bonds exists — it asks what is filed under a category and draws whatever comes
 * back, which is why adding European flags stays one folder and one import line.
 *
 * ── growth="flow", AND WHY THIS SCREEN IS THE WHOLE REASON THE SHELL EXISTS ──
 *
 * The child count here is `activitiesInCategory(id).length`. That is registry
 * DATA: it has grown four times already and five more categories are planned.
 * There is no constant to name, so the region scrolls — on every viewport,
 * including the many where five activities now fit and no scrollbar ever
 * appears.
 *
 * Before the shell, this screen wanted 764px of vertical space on a 375px-wide
 * phone and got `body { overflow: hidden }`. At 375x554 that clipped 210px; the
 * list was centred, so half the loss travelled UPWARD and the first card landed
 * on top of the home gate and won its hit test. The one way home started a game.
 * At 320x428 the first card sat at y=-28 and the last was 120px past the fold
 * with nothing able to reach either.
 *
 * The way out is still ScreenHeader's one button, top-left, in the identical
 * position on every non-home screen — and it is now in a grid track of its own,
 * so no amount of list is able to reach it.
 */
const CategoryScreen = ({ category, onBack, onOpenActivity }) => {
  const activities = activitiesInCategory(category.id)

  return (
    <Screen growth="flow">
      <ScreenChrome>
        <ScreenHeader onBack={onBack} />
        <h1 className={shell.title}>{category.title}</h1>
      </ScreenChrome>

      <ScreenContent mode="fill">
        {activities.length === 0 ? (
          // Unreachable while `validateRegistry` refuses an activity in a
          // sleeping category and the home screen refuses to open one — but a
          // screen that renders a list should say something when the list is
          // empty, rather than being a blank page with a back button.
          <p className={styles.empty}>Nothing here yet.</p>
        ) : (
          <div className={shell.list}>
            {activities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                className={styles.activity}
                // Read by the layout regression test: it is how assertion F
                // knows which boxes are list rows, so it can check that an
                // overflowing list leaves the last visible one CUT by the edge
                // rather than absent. That partial card is the whole scroll
                // affordance — no arrow, no chrome, no text.
                data-row
                data-activity={activity.id}
                onClick={() => onOpenActivity(activity)}
              >
                <span className={styles.activityTitle}>{activity.title}</span>
                <span className={styles.activitySubtitle}>{activity.subtitle}</span>
              </button>
            ))}
          </div>
        )}
      </ScreenContent>
    </Screen>
  )
}

export default CategoryScreen
