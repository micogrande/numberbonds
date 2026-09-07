/**
 * The hash router, mounted. (PLAN 2.5)
 *
 * `routes.js` is the pure half; this is the ~50 lines that connect it to the one
 * piece of browser state it needs. There is no routing library here on purpose:
 * "react-router buys deep-linkable URLs, which are worth nothing to a child who
 * cannot type one", and hash routing is what lets a refresh on any screen be
 * served by an `index.html` the browser already has — with no `vercel.json` and
 * therefore no rewrite to get wrong.
 *
 * ── HOW HISTORY IS DRIVEN ───────────────────────────────────────────────────
 *
 * Every navigation goes through `pushState`/`replaceState` rather than through
 * `location.hash = …`. One reason: assigning `location.hash` fires `hashchange`
 * asynchronously, so a push and a replace would land in the history at slightly
 * different times and the difference between them stops being reliable. The
 * `hashchange` listener stays anyway, because the address bar and a stray anchor
 * can still change the fragment behind our back.
 *
 * `popstate` is the hardware Back button, and it is the whole reason this hook
 * exists (PLAN 5, `App.jsx:20`: "No history integration — hardware Back exits
 * the app mid-session"). What Back *means* is decided by what was pushed:
 *
 *   - play → summary is a REPLACE, so Back from a result lands on the option
 *     picker rather than inside a game that is already over
 *   - Back mid-game simply leaves. The session is hosted by the screen, so
 *     leaving unmounts it, and an abandoned session is never scored (PLAN 2.5).
 *     There is no confirm modal, deliberately: "a six-year-old should not be
 *     asked 'are you sure?'"
 *   - Back on Home is not trapped. Leaving the app is correct behaviour.
 *
 * That last line is `goHome` below, and it is not a navigation like the others:
 * the gate REWINDS to the app's root entry rather than pushing Home on top of
 * the screen she is leaving. See `history.js` — pushing is what let Back from
 * Home walk back into a finished summary (trophy and confetti again) or into a
 * play route (a brand-new deck she never asked for).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { anchorHome, commit, rewindHome } from './history'
import { HOME_HASH, ROUTES, buildRoute, parseRoute } from './routes'

/** '' before she has navigated anywhere, which `parseRoute` reads as Home. */
function readHash() {
  return typeof window === 'undefined' ? '' : window.location.hash
}

/**
 * Is this hash a real screen below Home, worth keeping when the session is
 * anchored? Home is where the anchor lands anyway, and an unknown hash is one
 * the shell is about to redirect out of — neither is worth an entry.
 *
 * @param {string} hash
 * @returns {boolean}
 */
function isDeepRoute(hash) {
  const { name } = parseRoute(hash)
  return name !== ROUTES.HOME && name !== ROUTES.UNKNOWN
}

/**
 * @returns {{ route: import('./routes').Route, hash: string,
 *             navigate: (target: import('./routes').Route|string, options?: { replace?: boolean }) => void,
 *             goHome: () => void }}
 */
export function useHashRoute() {
  const [hash, setHash] = useState(readHash)

  useEffect(() => {
    const sync = () => setHash(readHash())

    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)

    // Entry 0 of this app's history is Home, from here on. `anchorHome` is
    // idempotent, which is what makes it safe in an effect StrictMode invokes
    // twice and safe across a reload, where `history.state` survives.
    const arrivedOn = readHash()
    anchorHome(window, HOME_HASH, isDeepRoute(arrivedOn) ? arrivedOn : null)

    // The fragment can change between the first render and this effect —
    // React 19 mounts twice under StrictMode, and a deep link arrives before
    // either. Reading it once here means the first paint is never a stale Home.
    sync()

    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  const navigate = useCallback((target, options = {}) => {
    const next = typeof target === 'string' ? target : buildRoute(target)

    // Navigating to where she already is would otherwise stack duplicate
    // history entries, and Back would appear to do nothing for as many taps as
    // it took to make them.
    if (next === readHash()) return

    commit(window, next, options.replace === true)

    // Neither pushState nor replaceState fires `hashchange`, so the state this
    // hook returns is updated here rather than waiting for an event that is
    // never coming.
    setHash(next)
  }, [])

  /**
   * The gate, top-left on every non-home screen (PLAN 3.7). Deliberately NOT
   * `navigate(HOME_HASH)`: this rewinds to the root entry, so the play or
   * summary screen she is leaving ends up ahead of her rather than one Back
   * press behind. Back on Home then leaves the app (PLAN 2.5).
   *
   * `setHash` here rather than waiting for the rewind's `popstate`, because the
   * rewrite that precedes it has already changed the fragment and a tap must be
   * answered inside ~100ms or it reads as "it didn't work" (PLAN 3.4).
   */
  const goHome = useCallback(() => {
    rewindHome(window, HOME_HASH)
    setHash(HOME_HASH)
  }, [])

  // Memoised so the route object is referentially stable while the hash is
  // unchanged: it is an effect dependency in the shell (redirects) and a fresh
  // object on every render would make those effects fire forever.
  const route = useMemo(() => parseRoute(hash), [hash])

  return { route, hash, navigate, goHome }
}
