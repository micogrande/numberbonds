/**
 * The router, minus the routing. (PLAN 2.5)
 *
 *     #/                                Home
 *     #/c/:categorySlug                 Category
 *     #/a/:activitySlug                 Activity option picker
 *     #/play/:activitySlug/:optionId    Session
 *     #/summary/:activitySlug/:optionId Result
 *
 * Two pure functions and a frozen table of names. No React, no `window`, no
 * registry: this file cannot tell you whether `number-bonds` exists, only that
 * the hash was shaped like an activity URL. Resolving a slug against what is
 * actually installed is `Shell.jsx`'s job, because that is the layer that can
 * redirect her somewhere safe when it does not resolve.
 *
 * Being pure is what makes it the one piece of routing worth testing, and
 * `routes.test.js` leans on it hard — every malformed hash a browser can hand us
 * has to come back as `unknown` rather than as a half-parsed route that renders
 * a broken screen.
 *
 * WHY HASH ROUTING AT ALL (PLAN 2.5, and it is load-bearing): path routing on
 * Vercel needs a `vercel.json` rewrite and buys two production failure modes we
 * otherwise do not have — a deep-link 404 if the rewrite is wrong, and a
 * stale-chunk 404 for any tab left open across a deploy. The fragment never
 * reaches the server, so a refresh on any screen below is served by the same
 * `index.html` that is already cached. This is why no `vercel.json` exists.
 * Do not "tidy" these into paths.
 */

/** Every route name there is. `unknown` is a real one — see `parseRoute`. */
export const ROUTES = Object.freeze({
  HOME: 'home',
  CATEGORY: 'category',
  ACTIVITY: 'activity',
  PLAY: 'play',
  SUMMARY: 'summary',
  UNKNOWN: 'unknown',
})

/** The hash every redirect lands on. She can never be left on a broken screen. */
export const HOME_HASH = '#/'

/** @typedef {{ name: string, categorySlug?: string, activitySlug?: string, optionId?: string, hash?: string }} Route */

/** The one home route object, so `route === HOME_ROUTE` is meaningful. */
export const HOME_ROUTE = Object.freeze({ name: ROUTES.HOME })

/**
 * The path part of a hash, split into segments.
 *
 * Returns `null` for anything that is not one of our paths, which the caller
 * turns into `unknown`. The cases that matter, in the order they bite:
 *
 *   ''  '#'  '#/'      the app opened normally               → []
 *   '#foo'              someone's in-page anchor, not a route → null
 *   '#/c//numbers'      an empty segment                      → null
 *   '#/c/numbers/'      a trailing slash                      → ['c','numbers']
 *   '#/c/%E9'           malformed percent-encoding, throws    → null
 *
 * @param {unknown} hash
 * @returns {string[]|null}
 */
function pathSegments(hash) {
  if (typeof hash !== 'string') return null

  // Only a real fragment is a route here. `window.location.hash` is always ''
  // or '#…', so anything else arrived from a caller who has confused a path for
  // a hash — and '/play/bonds-to/t10' must NOT quietly work, or the day someone
  // "tidies" the routes into paths it will look like it does (PLAN 2.5).
  if (hash !== '' && !hash.startsWith('#')) return null

  let path = hash.slice(1)

  // A query string inside the fragment is not something this app produces, but
  // a share sheet or a scanner can bolt one on. Drop it rather than letting it
  // become part of a slug.
  const query = path.indexOf('?')
  if (query !== -1) path = path.slice(0, query)

  if (path === '' || path === '/') return []
  if (!path.startsWith('/')) return null

  const raw = path.slice(1).split('/')

  // Tolerate exactly one trailing slash: `#/c/numbers/` is the same room as
  // `#/c/numbers`, and a stray slash is not a reason to throw her out to Home.
  if (raw.length > 1 && raw[raw.length - 1] === '') raw.pop()

  if (raw.some((segment) => segment === '')) return null

  try {
    return raw.map(decodeURIComponent)
  } catch {
    // decodeURIComponent throws URIError on a lone '%'. A hash she could only
    // have got by editing the URL bar; it must not reach the switch.
    return null
  }
}

/**
 * Hash → route. Total: every input produces a route object, and anything this
 * file does not recognise comes back as `unknown` carrying the hash it could not
 * read, so the shell can redirect and a log can say what happened.
 *
 * @param {unknown} hash  Typically `window.location.hash`.
 * @returns {Route}
 */
export function parseRoute(hash) {
  const segments = pathSegments(hash)

  if (segments === null) {
    return { name: ROUTES.UNKNOWN, hash: typeof hash === 'string' ? hash : '' }
  }

  if (segments.length === 0) return HOME_ROUTE

  const [head, ...rest] = segments

  if (head === 'c' && rest.length === 1) {
    return { name: ROUTES.CATEGORY, categorySlug: rest[0] }
  }

  if (head === 'a' && rest.length === 1) {
    return { name: ROUTES.ACTIVITY, activitySlug: rest[0] }
  }

  if (head === 'play' && rest.length === 2) {
    return { name: ROUTES.PLAY, activitySlug: rest[0], optionId: rest[1] }
  }

  if (head === 'summary' && rest.length === 2) {
    return { name: ROUTES.SUMMARY, activitySlug: rest[0], optionId: rest[1] }
  }

  return { name: ROUTES.UNKNOWN, hash: typeof hash === 'string' ? hash : '' }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} name
 * @returns {string}
 */
function segment(value, field, name) {
  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`buildRoute(): a ${name} route needs a non-empty ${field}, got ${String(value)}`)
  }

  return encodeURIComponent(value)
}

/**
 * Route → hash. The inverse of `parseRoute` for every route a screen can ask
 * for, and the only place a URL is spelled out — a link built by hand is how a
 * route ends up one rename away from a dead screen.
 *
 * Throws on a route it cannot build. That is a wiring mistake in a caller, not
 * something a child can do, and every call site passes ids that came out of the
 * registry moments earlier. `unknown` throws for the same reason: it is a route
 * you *arrive* at, never one you navigate to.
 *
 * @param {Route} route
 * @returns {string}
 */
export function buildRoute(route) {
  const name = route?.name

  switch (name) {
    case ROUTES.HOME:
      return HOME_HASH

    case ROUTES.CATEGORY:
      return `#/c/${segment(route.categorySlug, 'categorySlug', 'category')}`

    case ROUTES.ACTIVITY:
      return `#/a/${segment(route.activitySlug, 'activitySlug', 'activity')}`

    case ROUTES.PLAY:
      return `#/play/${segment(route.activitySlug, 'activitySlug', 'play')}/${segment(route.optionId, 'optionId', 'play')}`

    case ROUTES.SUMMARY:
      return `#/summary/${segment(route.activitySlug, 'activitySlug', 'summary')}/${segment(route.optionId, 'optionId', 'summary')}`

    default:
      throw new TypeError(`buildRoute(): cannot build a URL for route ${JSON.stringify(name)}`)
  }
}

/** The routes screens navigate to, spelled once. (Home is `HOME_HASH` above.) */
export const categoryRoute = (categorySlug) => ({ name: ROUTES.CATEGORY, categorySlug })
export const activityRoute = (activitySlug) => ({ name: ROUTES.ACTIVITY, activitySlug })
export const playRoute = (activitySlug, optionId) => ({ name: ROUTES.PLAY, activitySlug, optionId })
export const summaryRoute = (activitySlug, optionId) => ({ name: ROUTES.SUMMARY, activitySlug, optionId })
