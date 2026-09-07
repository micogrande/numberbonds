import { lazy } from 'react'
import { describe, expect, it } from 'vitest'

import Bunting from './Bunting'
import Globe from './Globe'
import Hedgehog from './Hedgehog'
import Pond from './Pond'
import Sunflower from './Sunflower'
import { CATEGORY_MOTIFS, CATEGORY_TINTS } from './motifs'
import { CATEGORIES } from '../../activities/categories'

/**
 * The six category slots have six drawings, and only the awake one is in the
 * boot chunk. (PLAN 3.5, PLAN 3.6)
 *
 * A motif is drawn by `CategoryCard`, and a card is only rendered for an AWAKE
 * category — a sleeping slot draws a pot and a bunny instead. Five of the six
 * drawings therefore render nowhere today, and until they were put behind a
 * dynamic import all five were still parsed on every cold load of her phone.
 *
 * There is no bundler in a node test, so "is it in the boot chunk" is asserted
 * as the thing that decides it: a statically imported component is a function,
 * and a `React.lazy` one is a lazy element type whose module is only fetched
 * when something renders it. Which of the two each slot gets is derived from
 * `categories.js`'s own `asleep` flag rather than listed here, so waking a
 * category and forgetting its drawing fails HERE, with a sentence about it,
 * instead of showing her an empty pebble on the home screen.
 */

/** What `React.lazy` produces, asked of React rather than hardcoded. */
const LAZY_TYPE = lazy(() => Promise.resolve({ default: () => null })).$$typeof

const isLazy = (motif) => motif !== null && typeof motif === 'object' && motif.$$typeof === LAZY_TYPE
const isEager = (motif) => typeof motif === 'function'

describe('every category slot has a drawing and a tint', () => {
  it('covers all six, and invents none', () => {
    const slots = CATEGORIES.map((category) => category.id).sort()

    expect(Object.keys(CATEGORY_MOTIFS).sort()).toEqual(slots)
    expect(Object.keys(CATEGORY_TINTS).sort()).toEqual(slots)
  })
})

describe('only what the home screen actually draws is in the boot chunk', () => {
  it.each(CATEGORIES.map((category) => [category.id, category.asleep]))(
    '%s: asleep=%s',
    (id, asleep) => {
      const motif = CATEGORY_MOTIFS[id]

      if (asleep) {
        // Nothing renders this one: a sleeping slot draws a pot and a bunny and
        // never looks in this table. Shipping it in the first chunk is bytes
        // parsed on a phone for a picture that cannot appear.
        expect(isLazy(motif), `"${id}" is asleep, so its motif must be behind a dynamic import`).toBe(true)
        expect(isEager(motif)).toBe(false)
      } else {
        // The home screen paints this one immediately. A lazy motif here would
        // be an empty pebble for a frame on the first screen she ever sees.
        expect(isEager(motif), `"${id}" is awake, so its motif must be imported statically`).toBe(true)
        expect(isLazy(motif)).toBe(false)
      }
    }
  )

  it('keeps at least one of each, so neither branch above is vacuous', () => {
    const motifs = CATEGORIES.map((category) => CATEGORY_MOTIFS[category.id])

    expect(motifs.filter(isEager).length).toBeGreaterThan(0)
    expect(motifs.filter(isLazy).length).toBeGreaterThan(0)
  })
})

describe('the sleeping drawings are still there, not deleted', () => {
  // PLAN 3.5 names all six by hand and all six are drawn. "Out of the boot
  // chunk" must not decay into "gone": the day a category wakes, its picture has
  // to exist. Imported here by name — a test file is not in the bundle, so this
  // costs her nothing — and the build is what proves `motifs.js`'s dynamic
  // import specifiers point at these same files, since Rollup resolves a
  // literal `import()` at build time and fails on one that does not exist.
  it.each([
    ['flags', Bunting],
    ['geography', Hedgehog],
    ['continents', Globe],
    ['oceans', Pond],
    ['clock', Sunflower],
  ])('%s still has a drawing', (id, Drawing) => {
    expect(CATEGORIES.find((category) => category.id === id).asleep, `${id} woke up`).toBe(true)
    expect(typeof Drawing).toBe('function')
  })
})
