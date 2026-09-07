import { describe, expect, it } from 'vitest'

import {
  HOME_HASH,
  ROUTES,
  activityRoute,
  buildRoute,
  categoryRoute,
  parseRoute,
  playRoute,
  summaryRoute,
} from './routes'

// PLAN 2.5: "`parseRoute(hash)` and `buildRoute(route)` are pure and tested".
//
// The reason this file is long is the last bullet of that section: "An unknown
// activity or option in the URL redirects to `#/`. She can never land on a
// broken screen." Half of that promise is kept here — every hash a browser can
// produce has to come back either as a route with every field present, or as
// `unknown`. A half-parsed route (a play route with no option, say) would reach
// the shell looking valid and render a screen with no deck in it.

describe('parseRoute — the five real routes', () => {
  it('reads home', () => {
    expect(parseRoute('#/')).toEqual({ name: ROUTES.HOME })
  })

  it('reads a category', () => {
    expect(parseRoute('#/c/numbers')).toEqual({ name: ROUTES.CATEGORY, categorySlug: 'numbers' })
  })

  it('reads an activity', () => {
    expect(parseRoute('#/a/bonds-to')).toEqual({ name: ROUTES.ACTIVITY, activitySlug: 'bonds-to' })
  })

  it('reads a play route', () => {
    expect(parseRoute('#/play/bonds-to/t10')).toEqual({
      name: ROUTES.PLAY,
      activitySlug: 'bonds-to',
      optionId: 't10',
    })
  })

  it('reads a summary route', () => {
    expect(parseRoute('#/summary/parts-up-to/t20')).toEqual({
      name: ROUTES.SUMMARY,
      activitySlug: 'parts-up-to',
      optionId: 't20',
    })
  })
})

describe('parseRoute — how the app actually opens', () => {
  // Whether the browser hands us '' or '#' or '#/' depends on how she got here:
  // a bookmark, the home-screen icon, or a link with the fragment stripped.
  it.each(['', '#', '#/'])('treats %o as home', (hash) => {
    expect(parseRoute(hash)).toEqual({ name: ROUTES.HOME })
  })

  it('survives a hash that is not a string at all', () => {
    for (const value of [undefined, null, 0, {}, []]) {
      expect(parseRoute(value).name).toBe(ROUTES.UNKNOWN)
    }
  })
})

describe('parseRoute — unknown, not broken', () => {
  const unknown = [
    ['a bare anchor', '#top'],
    ['a path that is not one of ours', '#/settings'],
    ['a category with no slug', '#/c'],
    ['a category with an empty slug', '#/c/'],
    ['an activity with no slug', '#/a'],
    ['a play route with no option', '#/play/bonds-to'],
    ['a play route with nothing at all', '#/play'],
    ['a play route with too many segments', '#/play/bonds-to/t10/extra'],
    ['a summary route with no option', '#/summary/bonds-to'],
    ['a category with an empty middle segment', '#/c//numbers'],
    ['a doubled separator', '#//'],
    ['malformed percent-encoding', '#/a/%E0%A4%A'],
    ['a lone percent', '#/c/%'],
    ['path routing, tidied in by someone', '/play/bonds-to/t10'],
  ]

  it.each(unknown)('reports %s as unknown', (_label, hash) => {
    const route = parseRoute(hash)
    expect(route.name).toBe(ROUTES.UNKNOWN)
    // The shell logs this when it redirects, so it has to survive the parse.
    expect(route.hash).toBe(hash)
  })

  it('never returns a route with a missing field', () => {
    // The failure that matters: a play route that parses but has no option id
    // would reach the shell, resolve an activity, and try to run a session with
    // `undefined` as the option.
    for (const hash of unknown.map(([, value]) => value)) {
      const route = parseRoute(hash)
      expect(route.activitySlug).toBeUndefined()
      expect(route.optionId).toBeUndefined()
      expect(route.categorySlug).toBeUndefined()
    }
  })
})

describe('parseRoute — the forgiving bits', () => {
  it('tolerates one trailing slash', () => {
    expect(parseRoute('#/c/numbers/')).toEqual({ name: ROUTES.CATEGORY, categorySlug: 'numbers' })
    expect(parseRoute('#/play/bonds-to/t10/')).toEqual({
      name: ROUTES.PLAY,
      activitySlug: 'bonds-to',
      optionId: 't10',
    })
  })

  it('drops a query string bolted onto the fragment', () => {
    expect(parseRoute('#/c/numbers?utm_source=whatever')).toEqual({
      name: ROUTES.CATEGORY,
      categorySlug: 'numbers',
    })
  })

  it('decodes an escaped segment', () => {
    expect(parseRoute('#/a/roman%20numerals')).toEqual({
      name: ROUTES.ACTIVITY,
      activitySlug: 'roman numerals',
    })
  })

  it('does not treat an unknown-but-well-formed slug as broken', () => {
    // Unknown *shape* is this file's business; an unknown *activity* is the
    // registry's, and it is the shell that redirects for it (PLAN 2.5).
    expect(parseRoute('#/a/does-not-exist')).toEqual({
      name: ROUTES.ACTIVITY,
      activitySlug: 'does-not-exist',
    })
  })
})

describe('buildRoute', () => {
  it('builds every route a screen can navigate to', () => {
    expect(buildRoute({ name: ROUTES.HOME })).toBe(HOME_HASH)
    expect(buildRoute(categoryRoute('numbers'))).toBe('#/c/numbers')
    expect(buildRoute(activityRoute('bonds-to'))).toBe('#/a/bonds-to')
    expect(buildRoute(playRoute('bonds-to', 't10'))).toBe('#/play/bonds-to/t10')
    expect(buildRoute(summaryRoute('parts-up-to', 't3'))).toBe('#/summary/parts-up-to/t3')
  })

  it('escapes a segment rather than emitting a URL that parses as something else', () => {
    expect(buildRoute(activityRoute('a/b'))).toBe('#/a/a%2Fb')
    expect(parseRoute(buildRoute(activityRoute('a/b')))).toEqual({
      name: ROUTES.ACTIVITY,
      activitySlug: 'a/b',
    })
  })

  it('throws for a route it cannot build', () => {
    // Every one of these is a wiring mistake in a caller — loud is correct, and
    // no child can reach it: `unknown` is a route you arrive at, never one you
    // navigate to.
    expect(() => buildRoute({ name: ROUTES.UNKNOWN, hash: '#/nope' })).toThrow(TypeError)
    expect(() => buildRoute({ name: 'nonsense' })).toThrow(TypeError)
    expect(() => buildRoute(null)).toThrow(TypeError)
    expect(() => buildRoute(categoryRoute(''))).toThrow(TypeError)
    expect(() => buildRoute(activityRoute(undefined))).toThrow(TypeError)
    expect(() => buildRoute(playRoute('bonds-to', ''))).toThrow(TypeError)
    expect(() => buildRoute(summaryRoute(undefined, 't10'))).toThrow(TypeError)
  })
})

describe('round trip', () => {
  const routes = [
    { name: ROUTES.HOME },
    categoryRoute('numbers'),
    activityRoute('bonds-to'),
    activityRoute('parts-up-to'),
    playRoute('bonds-to', 't10'),
    summaryRoute('parts-up-to', 't20'),
  ]

  it.each(routes)('parse(build($route)) is the route again', (route) => {
    expect(parseRoute(buildRoute(route))).toEqual(route)
  })
})
