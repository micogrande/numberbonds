import React, { useEffect } from 'react'

import {
  HOME_HASH,
  HOME_ROUTE,
  ROUTES,
  activityRoute,
  buildRoute,
  categoryRoute,
  playRoute,
  summaryRoute,
} from './routes'
import ActivityScreen from '../screens/ActivityScreen'
import CategoryScreen from '../screens/CategoryScreen'
import GrownupsScreen from '../screens/GrownupsScreen'
import HomeScreen from '../screens/HomeScreen'
import PlayHost from '../screens/PlayHost'
import SummaryScreen from '../screens/SummaryScreen'
import { defaultOption, findOption, getActivityBySlug, getCategoryBySlug } from '../activities/registry'

/**
 * Route → screen. **The only switch in the app.** (PLAN 2.5)
 *
 * Every other file is either data (a manifest), a pure function (an engine, the
 * route parser, the session reducer) or a component that draws what it is given.
 * This is the one place allowed to know that a hash means a screen, and it is
 * deliberately dull: resolve the slugs, redirect if they do not resolve, hand
 * the result to a screen.
 *
 * It does not know what a number bond is. It asks the registry what is installed
 * and passes manifests around; a manifest is data. That is why steps 10 and 11
 * can add an activity without touching this file — the falsifiable acceptance
 * test for both of them is that no file outside `activities/<id>/` changes.
 *
 * ── THE REDIRECT RULE ───────────────────────────────────────────────────────
 *
 * PLAN 2.5: "An unknown activity or option in the URL redirects to `#/`. She can
 * never land on a broken screen." Every `case` below therefore either renders a
 * screen with everything it needs, or redirects. There is no third path, no
 * "not found" screen, and nothing renders half-resolved.
 *
 * Redirects always REPLACE, so a bad URL leaves no history entry to go back to.
 */

/**
 * Navigate on mount and draw nothing. One frame of empty page, then home.
 *
 * The target is a hash STRING rather than a route object on purpose: an object
 * literal is a new identity on every render, and this effect's dependency array
 * would never settle.
 */
const Redirect = ({ hash, navigate, because }) => {
  useEffect(() => {
    if (because) console.warn(`Amelia: ${because} — redirecting to ${hash}`)
    navigate(hash, { replace: true })
  }, [hash, navigate, because])

  return null
}

/**
 * @param {Object} props
 * @param {import('./routes').Route} props.route
 * @param {(target: Object|string, options?: { replace?: boolean }) => void} props.navigate
 * @param {() => void} props.goHome                The gate. Rewinds rather than pushes.
 * @param {Object|null} props.outcome              The last finished session, from App.
 * @param {(outcome: Object) => void} props.onComplete
 * @param {Record<string, string>} props.lastOption  activityId → option id she last played.
 * @param {{ activitySlug: string, optionId: string }|null} props.started  The game she
 *   pressed start on in this tab, if any. A play route with nothing behind it is a
 *   refresh or a cold deep link, and lands on the option picker.
 * @param {(activity: Object, option: Object) => void} props.onStart
 */
const Shell = ({ route, navigate, goHome, outcome, onComplete, lastOption, started, onStart }) => {
  // The gate: one way home, the same pixel on every non-home screen (PLAN 3.7).
  //
  // It REWINDS to the app's root entry rather than pushing Home on top of the
  // screen she is leaving (see `history.js`), so Back on Home leaves the app
  // exactly as PLAN 2.5 says it should. Pushing is what used to put a finished
  // summary or a live play route one Back press behind her.
  const home = (because) => <Redirect hash={HOME_HASH} navigate={navigate} because={because} />

  switch (route.name) {
    case ROUTES.HOME:
      return <HomeScreen onOpenCategory={(category) => navigate(categoryRoute(category.slug))} />

    // Typed by her dad, linked from nowhere. It goes home the same way every
    // other screen does, so there is exactly one way out of it and it is the
    // one he already knows. (GOALS.md section 3)
    case ROUTES.GROWNUPS:
      return <GrownupsScreen onDone={() => navigate(HOME_ROUTE)} />

    case ROUTES.CATEGORY: {
      const category = getCategoryBySlug(route.categorySlug)

      // A sleeping category is redirected as firmly as an unknown one: it has
      // no way in from the home screen, so a URL is the only way to reach it
      // and there is nothing on the other side.
      if (category === null || category.asleep) {
        return home(`no awake category "${route.categorySlug}"`)
      }

      return (
        <CategoryScreen
          category={category}
          onBack={goHome}
          onOpenActivity={(activity) => navigate(activityRoute(activity.slug))}
        />
      )
    }

    case ROUTES.ACTIVITY: {
      const activity = getActivityBySlug(route.activitySlug)
      if (activity === null) return home(`no activity "${route.activitySlug}"`)

      return (
        <ActivityScreen
          activity={activity}
          // Her last choice — this visit or any previous one, since step 9 it
          // is mirrored to `amelia.prefs.v1` — else what the manifest opens on.
          // PLAN 5: the target used to reset to 10 every time she came home,
          // and until prefs existed it still did on every reload.
          initialOptionId={defaultOption(activity, lastOption[activity.id]).id}
          onBack={goHome}
          onStart={(chosen, option) => {
            onStart(chosen, option)
            navigate(playRoute(chosen.slug, option.id))
          }}
        />
      )
    }

    case ROUTES.PLAY: {
      const activity = getActivityBySlug(route.activitySlug)
      const option = findOption(activity, route.optionId)

      if (activity === null || option === null) {
        return home(`no activity/option for "${route.activitySlug}/${route.optionId}"`)
      }

      // A play route is a view of a game she started, not a place to arrive at.
      // Nothing started in this tab means a refresh (PLAN 2.5) or a cold deep
      // link: land on the option picker with her last choice pre-selected, so
      // the next thing she sees is a button that says what it does.
      if (started === null || started.activitySlug !== activity.slug || started.optionId !== option.id) {
        return (
          <Redirect
            hash={buildRoute(activityRoute(activity.slug))}
            navigate={navigate}
            because="no game was started in this tab"
          />
        )
      }

      return (
        <PlayHost
          // A new session is a new mount: new deck, new session, new card with
          // an empty draft. See the note in PlayHost.
          key={`${activity.slug}/${option.id}`}
          activity={activity}
          option={option}
          onExit={goHome}
          onComplete={(finished) => {
            onComplete(finished)
            // REPLACE, not push (PLAN 2.5): back from the summary lands on the
            // option picker, never back inside a game that is already over.
            navigate(summaryRoute(activity.slug, option.id), { replace: true })
          }}
        />
      )
    }

    case ROUTES.SUMMARY: {
      const activity = getActivityBySlug(route.activitySlug)
      const option = findOption(activity, route.optionId)

      if (activity === null || option === null) {
        return home(`no activity/option for "${route.activitySlug}/${route.optionId}"`)
      }

      // A summary is a view of a session that just happened, and this app keeps
      // no mid-session snapshot (PLAN 8, deferred on purpose). So a refresh on
      // the summary, or a deep link into one, has no result to show and lands on
      // the option picker instead: "here is the button, press it again" beats a
      // screen full of zeroes she does not recognise.
      if (outcome === null || outcome.activitySlug !== activity.slug || outcome.optionId !== option.id) {
        return (
          <Redirect
            hash={buildRoute(activityRoute(activity.slug))}
            navigate={navigate}
            because="no finished session to summarise"
          />
        )
      }

      return (
        <SummaryScreen
          // The whole result, as one object, because its IDENTITY is what the
          // summary guards its confetti on — the same discipline as the play
          // host's `reported` ref and the session's epoch. Spread into props it
          // would be five values that can repeat between sessions, and nothing
          // to tell one finished game from the next.
          result={outcome}
          onHome={goHome}
          // Play again REPLACES the summary, for the same reason the summary
          // replaced the game: the history behind her stays [category, picker],
          // so Back from the new game is the picker rather than the ghost of the
          // last one.
          onRestart={() => {
            onStart(activity, option)
            navigate(playRoute(activity.slug, option.id), { replace: true })
          }}
        />
      )
    }

    default:
      return home(`unrecognised route "${route.hash}"`)
  }
}

export default Shell
