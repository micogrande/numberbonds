import React, { Suspense, useCallback, useState } from 'react'

import ErrorBoundary from './ErrorBoundary'
import Shell from './Shell'
import { useHashRoute } from './useHashRoute'
import { readLastOptions, setLastOption as rememberLastOption } from '../storage/prefs'

/**
 * The app. (PLAN 2.5, PLAN 2.7)
 *
 * A boundary, a router and three pieces of memory. The switch is `Shell.jsx`,
 * the URL is `useHashRoute`, and a session is hosted by the play screen — this
 * file holds only the things that have to outlive a route change, because a
 * route change unmounts the screen that produced them.
 *
 * The `useGame` hook that used to be the whole app is gone: its deck-dealing and
 * its score-recording moved into the play host, its `MODES` enum became five
 * routes, and the flat `if` chain that rendered one of three screens became the
 * shell's switch.
 */

/**
 * What she sees while an activity's chunk arrives. Activities are loaded with a
 * dynamic import, so the first game of a session has a moment with nothing in
 * it; every game after that is instant, because the manifest memoises the
 * promise. She reads, so it says what is happening rather than spinning.
 */
const Loading = () => (
  <div
    className="center"
    style={{ height: '100%', color: 'var(--color-text-light)', fontSize: '1.25rem', fontWeight: 700 }}
  >
    Getting ready…
  </div>
)

function App() {
  const { route, navigate, goHome } = useHashRoute()

  /**
   * The session that just finished, waiting to be shown.
   *
   * It lives up here because the summary is a different ROUTE from the game
   * (PLAN 2.5), so the component that produced the result has already unmounted
   * by the time the result is drawn. Exactly one session's worth: there is no
   * history of games, and a summary route that does not match this is redirected
   * to the option picker.
   */
  const [outcome, setOutcome] = useState(null)

  /**
   * activityId → the option she last started. PLAN 5's last low bug: "target
   * resets to 10 on every return home".
   *
   * Seeded from `amelia.prefs.v1` (PLAN 2.6) and written back on every start, so
   * it now survives a reload as well as a walk home — which is what PLAN 2.5
   * already promised for the refresh path: "lands on that activity's option
   * screen **with her last choice pre-selected**". Until step 9 that sentence
   * was only true within one page load, and a reload on `#/play/bonds-to/t7`
   * correctly bounced her to the picker and then silently opened it on t10.
   *
   * The React state is what a render reads and storage is the durable mirror.
   * Both, rather than either: reading storage in render would not re-render on a
   * change, and holding it only in state is the bug above.
   *
   * The initialiser is passed as a FUNCTION so the read happens once on mount
   * rather than on every render (`useState(readLastOptions())` would call it
   * every time and throw the result away).
   */
  const [lastOption, setLastOption] = useState(readLastOptions)

  /**
   * The game she pressed *start* on, if any — and the reason a refresh does not
   * drop her into a fresh deck.
   *
   * PLAN 2.5: "Refresh mid-session drops it and lands on that activity's option
   * screen with her last choice pre-selected. She does not refresh on purpose,
   * so this path is a crash; after a crash, 'here is the button, press it again'
   * beats being dropped into a half-finished game she does not remember."
   *
   * A reload wipes this, so a `#/play/…` URL that nobody in this tab started
   * sends her to the picker instead. It is the exact mirror of the `outcome`
   * check on the summary route: both say "this screen is a view of something
   * that happened in this tab, not a place you can arrive at".
   */
  const [started, setStarted] = useState(null)

  const handleComplete = useCallback((finished) => {
    setOutcome(finished)
  }, [])

  const handleStart = useCallback((activity, option) => {
    setStarted({ activitySlug: activity.slug, optionId: option.id })

    // A new game makes the last result stale. Play Again is the case that
    // matters: it replaces the summary with a fresh session, and leaving the
    // finished one lying about is how a summary route she reaches later shows
    // the wrong game's score.
    setOutcome(null)

    setLastOption((previous) =>
      previous[activity.id] === option.id ? previous : { ...previous, [activity.id]: option.id }
    )

    // OUTSIDE the updater, not inside it. A state updater must be pure —
    // StrictMode invokes it twice in development — and a write to localStorage
    // is not. It is also the reason this is not folded into the line above.
    // Failure is ignored on purpose: `safeStorage` never throws, and a
    // preference that did not persist is a wrong pre-selection, not a lost game.
    rememberLastOption(activity.id, option.id)
  }, [])

  /**
   * The gate, and the only way *out* of a session that is not the session
   * ending. It drops both pieces of memory on the way past.
   *
   * `started` is read only by the play route and `outcome` only by the summary,
   * so once she has left, neither is memory — each is a loaded gun. Nothing used
   * to clear them, and the gate used to *push* Home, so Back from Home walked
   * straight back into what she had just left: a play route with a live
   * `started` deals a brand-new deck nobody asked for, and a summary route with
   * a live `outcome` replays a finished session's trophy and its two hundred
   * particles of confetti.
   *
   * Two independent fixes for that one bug, deliberately. `history.js` means
   * those entries are no longer behind her at all; this means they are inert
   * even if some later routing change puts one back within reach.
   */
  const handleGoHome = useCallback(() => {
    setStarted(null)
    setOutcome(null)
    goHome()
  }, [goHome])

  return (
    <div className="full-screen">
      {/* A render error would otherwise leave a six-year-old looking at a white
          page with no gesture that fixes it. */}
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Shell
            route={route}
            navigate={navigate}
            goHome={handleGoHome}
            outcome={outcome}
            onComplete={handleComplete}
            lastOption={lastOption}
            started={started}
            onStart={handleStart}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

export default App
