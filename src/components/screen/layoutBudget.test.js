import { describe, expect, it } from 'vitest'

import {
  categoryCapacity,
  chromeHeight,
  density,
  gateSize,
  listFits,
  listHeight,
  regionHeight,
} from './layoutBudget'

/**
 * The model is only worth anything if it agrees with a browser, so it is pinned
 * to numbers that came out of one. Every `measured` value below was read off
 * Chrome driving the real app via `npm run test:layout --json`; if a token in
 * styles/variables.css changes, this file goes red first and cheapest.
 */
describe('the height budget agrees with the browser', () => {
  // [ width, height, measured chrome height, measured region height ]
  const MEASURED = [
    [412, 915, 156.59, 742],
    [390, 844, 156.0, 672],
    [375, 812, 156.0, 640],
    [412, 775, 125.75, 633],
    [375, 667, 116.02, 535],
    [360, 640, 113.59, 510],
    [320, 568, 108.0, 444],
    [375, 554, 108.0, 430],
    [320, 428, 108.0, 304],
    [667, 375, 115.2, 244],
  ]

  it.each(MEASURED)('%ix%i — chrome band and content region', (w, h, chrome, region) => {
    expect(chromeHeight(w, h)).toBeCloseTo(chrome, 1)
    // The browser reports clientHeight as an integer.
    expect(Math.round(regionHeight(w, h))).toBe(region)
  })
})

describe('the density floor', () => {
  it('never puts a row under the 44px house minimum, at any height', () => {
    for (let h = 300; h <= 1200; h += 1) {
      expect(density(h).rowH).toBeGreaterThanOrEqual(44)
    }
  })

  it('never puts a row under 72px, which is the floor this design commits to', () => {
    // 72 clears WCAG 2.5.8 (44), Material's 48dp, and sits at PLAN 3.3's own
    // 75px children's figure. If a future step wants to go lower, the answer is
    // the scroller, not a smaller target in a six-year-old's hands.
    for (let h = 300; h <= 1200; h += 1) {
      expect(density(h).rowH).toBeGreaterThanOrEqual(72)
    }
  })

  it('keeps the gate above the 44px minimum and at PLAN 3.7 size when there is room', () => {
    expect(gateSize(375)).toBe(56)
    expect(gateSize(844)).toBe(72)
    for (let h = 300; h <= 1200; h += 1) {
      expect(gateSize(h)).toBeGreaterThanOrEqual(44)
      expect(gateSize(h)).toBeLessThanOrEqual(72)
    }
  })

  it('is monotone — a taller viewport never selects a denser step', () => {
    let previous = density(300)
    for (let h = 301; h <= 1200; h += 1) {
      const current = density(h)
      expect(current.rowH).toBeGreaterThanOrEqual(previous.rowH)
      expect(current.gap).toBeGreaterThanOrEqual(previous.gap)
      previous = current
    }
  })
})

describe('the base step is what the category screen has always shipped', () => {
  it('is a 96px row and a 24px gap, so a tall phone sees no change at all', () => {
    expect(density(844)).toMatchObject({ rowH: 96, gap: 24 })
  })
})

describe('the reported bug, as arithmetic', () => {
  it('fits five activities at 375x554 — the case the owner measured as clipped', () => {
    expect(listFits(5, 375, 554)).toBe(true)
    // 5 x 72 + 4 x 12 = 408, inside 430 - 12.
    expect(listHeight(5, 554)).toBe(408)
  })

  it('fits five activities at 320x568, the WCAG 1.4.10 floor', () => {
    expect(listFits(5, 320, 568)).toBe(true)
  })

  it('does NOT pretend five fit at 320x428 — they scroll, and that is correct', () => {
    expect(listFits(5, 320, 428)).toBe(false)
  })
})

describe('capacity, stated rather than discovered on her phone', () => {
  // This table is the answer to "when does the next activity start to scroll".
  // Scrolling is correct behaviour past this point — every row stays 72px or
  // more and every row stays reachable. The number matters because roughly 80%
  // of attention lands above the fold, so it is the signal to split a category
  // rather than lengthen it.
  const CAPACITY = [
    [412, 915, 6],
    [390, 844, 5],
    [375, 812, 5],
    [412, 775, 6],
    [390, 704, 5],
    [375, 667, 5],
    [360, 640, 5],
    [320, 568, 5],
    [375, 554, 5],
    [360, 500, 4],
    [320, 428, 3],
  ]

  it.each(CAPACITY)('%ix%i holds %i activities before it scrolls', (w, h, n) => {
    expect(categoryCapacity(w, h)).toBe(n)
    expect(listFits(n, w, h)).toBe(true)
    expect(listFits(n + 1, w, h)).toBe(false)
  })

  it('holds today’s five on every portrait viewport at or above 554px', () => {
    const PORTRAIT = [
      [412, 915],
      [414, 896],
      [390, 844],
      [375, 812],
      [412, 775],
      [414, 776],
      [390, 704],
      [375, 682],
      [375, 667],
      [360, 640],
      [320, 568],
      [375, 554],
    ]
    for (const [w, h] of PORTRAIT) {
      expect(listFits(5, w, h), `${w}x${h}`).toBe(true)
    }
  })

  it('degrades to scrolling, never to clipping, below that', () => {
    // The two shortest portrait viewports in the matrix. The list does not fit
    // and that is fine: it scrolls, every row keeps its 72px, and the layout
    // test asserts the last visible row is cut by the edge rather than absent.
    expect(listFits(5, 360, 500)).toBe(false)
    expect(listFits(5, 320, 428)).toBe(false)
    expect(density(500).rowH).toBe(72)
    expect(density(428).rowH).toBe(72)
  })
})
