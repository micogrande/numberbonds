import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PREFS_KEY, getLastOption, readLastOptions, setLastOption } from './prefs'
import { resetMemoryFallback } from './safeStorage'
import { defaultOption, getActivityBySlug } from '../activities/registry'

/**
 * `amelia.prefs.v1` — what she chose last time. (PLAN 2.6, PLAN 7 step 9)
 *
 * The headline test is `after a reload`. Everything else in this file exists to
 * support it: PLAN 5's last low-severity bug is "target resets to 10 on every
 * return home", step 8 fixed the walk home and back by holding the choice in
 * React state, and the half that was left is the one where the tab reloads and
 * that state goes with it.
 *
 * The reload is simulated the way the app actually experiences it — write, drop
 * every trace of the page, read back — because there is no jsdom here (PLAN 6)
 * and a real `#/play/bonds-to/t7` reload cannot be driven from node. What CAN be
 * driven from node is the exact composition `App.jsx` and `Shell.jsx` perform:
 * `defaultOption(activity, <what prefs remembers>)`. That is the line the bug
 * lived on, and it is a pure function of two things this file can both supply.
 */

/**
 * localStorage that behaves, or refuses to write. Same shim as `scores.test.js`
 * — the two stores share `safeStorage`, so they share its failure modes.
 */
function installStorage({ failWrites = false } = {}) {
  const store = new Map()

  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem(key, value) {
      if (failWrites) throw new Error('QuotaExceededError')
      store.set(key, String(value))
    },
  }

  return store
}

const BONDS_SLUG = 'bonds-to'

let store

beforeEach(() => {
  resetMemoryFallback()
  store = installStorage()
})

afterEach(() => {
  delete globalThis.localStorage
  resetMemoryFallback()
})

describe('the key and the shape', () => {
  it('is PLAN 2.6\'s key and PLAN 2.6\'s shape', () => {
    //   amelia.prefs.v1        { lastOption: { [activityId]: optionId } }
    expect(PREFS_KEY).toBe('amelia.prefs.v1')

    setLastOption('BOND_WHOLE', 't7')

    expect(JSON.parse(store.get(PREFS_KEY))).toEqual({ lastOption: { BOND_WHOLE: 't7' } })
  })

  it('remembers one option per activity, and the newest wins', () => {
    setLastOption('BOND_WHOLE', 't7')
    setLastOption('ROMAN', 'to100')
    setLastOption('BOND_WHOLE', 't14')

    expect(readLastOptions()).toEqual({ BOND_WHOLE: 't14', ROMAN: 'to100' })
    expect(getLastOption('BOND_WHOLE')).toBe('t14')
  })

  it('has nothing to say about an activity she has never started', () => {
    // `undefined`, not null: it goes straight into `defaultOption`'s optional
    // second parameter, which then falls through to the manifest default.
    expect(getLastOption('ROMAN')).toBeUndefined()
    expect(readLastOptions()).toEqual({})
  })

  it('leaves anything else in the store alone', () => {
    // A newer build's field must survive an older tab writing a preference.
    store.set(PREFS_KEY, JSON.stringify({ lastOption: { ROMAN: 'to50' }, somethingElse: 7 }))

    setLastOption('BOND_WHOLE', 't7')

    expect(JSON.parse(store.get(PREFS_KEY))).toEqual({
      lastOption: { ROMAN: 'to50', BOND_WHOLE: 't7' },
      somethingElse: 7,
    })
  })
})

// ─── the bug this file exists for ────────────────────────────────────────────

describe('after a reload', () => {
  /**
   * What the shell does with a play route it has no live session for.
   *
   * PLAN 2.5: "Refresh mid-session drops it and lands on that activity's option
   * screen with her last choice pre-selected." `Shell.jsx` redirects to the
   * picker and hands it `defaultOption(activity, lastOption[activity.id]).id`;
   * `App.jsx` seeds `lastOption` from this store. This is that line, and the
   * argument is what a freshly-mounted App would have had.
   */
  const pickerOpensOn = (slug) => {
    const activity = getActivityBySlug(slug)
    return defaultOption(activity, readLastOptions()[activity.id]).id
  }

  it('opens the picker on the target she chose, not on the manifest default', () => {
    const bonds = getActivityBySlug(BONDS_SLUG)

    // The manifest default is what the picker used to fall back to every time.
    expect(bonds.defaultOptionId).toBe('t10')
    expect(pickerOpensOn(BONDS_SLUG)).toBe('t10')

    // She starts #/play/bonds-to/t7 — `App.jsx`'s `handleStart` records it.
    setLastOption(bonds.id, 't7')

    // …and the tab reloads. Every scrap of page state is gone: React's, the
    // in-memory fallback's, the module's. Only localStorage survives, which is
    // exactly the point of this file.
    resetMemoryFallback()

    expect(pickerOpensOn(BONDS_SLUG)).toBe('t7')
  })

  it('falls back to the manifest default when the stored option no longer exists', () => {
    // An id in here is a hint, never a source of truth. A recipe change that
    // retires an option must cost her one pre-selection, not a broken screen —
    // which is why nothing in `prefs.js` validates against the registry.
    setLastOption(getActivityBySlug(BONDS_SLUG).id, 't999')
    resetMemoryFallback()

    expect(pickerOpensOn(BONDS_SLUG)).toBe('t10')
  })

  it('keeps each activity separate, so bonds and roman do not share a choice', () => {
    setLastOption(getActivityBySlug(BONDS_SLUG).id, 't7')
    setLastOption(getActivityBySlug('roman-numerals').id, 'to100')
    resetMemoryFallback()

    expect(pickerOpensOn(BONDS_SLUG)).toBe('t7')
    expect(pickerOpensOn('roman-numerals')).toBe('to100')
    expect(pickerOpensOn('parts-up-to')).toBe('t10') // untouched, so the default
  })
})

// ─── it can never be the thing that breaks a session ─────────────────────────

describe('a preference is never worth a crash', () => {
  it('survives a store that refuses to write', () => {
    delete globalThis.localStorage
    resetMemoryFallback()
    installStorage({ failWrites: true })

    expect(() => setLastOption('BOND_WHOLE', 't7')).not.toThrow()

    // safeStorage's in-memory fallback keeps the tab self-consistent, so the
    // walk home and back still works even in a private window. It does not
    // survive the reload, and cannot: there is nowhere to put it.
    expect(getLastOption('BOND_WHOLE')).toBe('t7')
  })

  it('survives a store with no localStorage at all', () => {
    delete globalThis.localStorage
    resetMemoryFallback()

    expect(() => setLastOption('BOND_WHOLE', 't7')).not.toThrow()
    expect(readLastOptions()).toEqual({ BOND_WHOLE: 't7' })
  })

  it('survives hand-edited rubbish in the key', () => {
    for (const raw of ['null', '7', '"t7"', '[]', 'not json at all', '{"lastOption":null}', '{"lastOption":[]}']) {
      store.set(PREFS_KEY, raw)
      resetMemoryFallback()

      expect(readLastOptions(), raw).toEqual({})
      expect(pickerDefaultFor(BONDS_SLUG), raw).toBe('t10')
    }
  })

  it('drops entries that are not id → id, and keeps the ones that are', () => {
    store.set(
      PREFS_KEY,
      JSON.stringify({ lastOption: { BOND_WHOLE: 't7', ROMAN: 42, BOND_PARTS: '', '': 't3', ADD: null } })
    )
    resetMemoryFallback()

    expect(readLastOptions()).toEqual({ BOND_WHOLE: 't7' })
  })

  it('refuses to store a malformed id rather than poisoning the picker', () => {
    expect(setLastOption('', 't7')).toBe(false)
    expect(setLastOption('BOND_WHOLE', '')).toBe(false)
    expect(setLastOption(undefined, undefined)).toBe(false)
    expect(setLastOption('BOND_WHOLE', 7)).toBe(false)

    expect(readLastOptions()).toEqual({})
  })
})

/** The manifest's own default, for the rubbish cases above. */
function pickerDefaultFor(slug) {
  const activity = getActivityBySlug(slug)
  return defaultOption(activity, readLastOptions()[activity.id]).id
}
