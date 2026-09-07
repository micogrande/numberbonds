/**
 * The height budget of a screen, as arithmetic.  (PLAN 3.3)
 *
 * A pure function of the viewport, with no DOM and no React, so `npm test` can
 * state this app's capacity as a fact instead of a hope: how many activity rows
 * fit in a category, on which phone, before the list starts to scroll.
 *
 * ── WHAT THIS IS AND IS NOT ─────────────────────────────────────────────────
 *
 * It is a MODEL OF THE CSS, and it will happily agree with itself while a
 * browser does something else. It does not replace `npm run test:layout`, which
 * measures the real render in a real engine; it complements it, cheaply, in the
 * node environment the rest of the suite already runs in.
 *
 * Its value is the thing the browser test is bad at: answering "what happens at
 * the sixth activity, and the eighth" without rendering them. The category
 * screen was shipped with a capacity nobody had written down, and it ran out.
 *
 * Every number below was checked against a measured browser value at seven
 * viewports and agrees to within 0.1px — see layoutBudget.test.js. If you change
 * a token in styles/variables.css and this file disagrees with the browser, this
 * file is the one that is wrong.
 */

const clamp = (min, val, max) => Math.min(Math.max(val, min), max)

/** `--gate-size: clamp(56px, 9vh, 72px)` — PLAN 3.7's one way home. */
export const gateSize = (h) => clamp(56, 0.09 * h, 72)

/** `--fs-display: clamp(2.25rem, 5vw + 1rem, 3.25rem)` at a 16px root. */
export const fsDisplay = (w) => clamp(36, 0.05 * w + 16, 52)

/** `--fs-h2: clamp(1.5rem, 3vw + 0.7rem, 2.125rem)` at a 16px root. */
export const fsH2 = (w) => clamp(24, 0.03 * w + 11.2, 34)

/**
 * The stepped block-axis density scale from styles/variables.css. Two steps and
 * only two, floored at a 72px row — WCAG 2.5.8 asks 44, Material asks 48dp, and
 * PLAN 3.3 cites 75 for children. Below the floor the list scrolls; it does not
 * shrink further.
 */
export function density(h) {
  if (h < 620) {
    return { rowH: 72, gap: 12, listPadEnd: 12, titleMt: 4, titleMb: 8, title: fsH2 }
  }
  if (h < 780) {
    return { rowH: 80, gap: 16, listPadEnd: 20, titleMt: 4, titleMb: 12, title: fsH2 }
  }
  // Base is byte-identical to what the category screen has always shipped, so
  // on a tall phone nothing moves at all.
  return { rowH: 96, gap: 24, listPadEnd: 32, titleMt: 8, titleMb: 24, title: fsDisplay }
}

/** Screen padding-block-start (8) + the chrome track + the title block. */
export function chromeHeight(w, h, { withTitle = true } = {}) {
  const d = density(h)
  const band = 8 + 4 + gateSize(h) + 4
  return withTitle ? band + d.titleMt + d.title(w) + d.titleMb : band
}

/** The content region: everything the chrome and the screen's own margins leave. */
export function regionHeight(w, h, opts) {
  return h - chromeHeight(w, h, opts) - 16
}

/** What a list of `n` rows needs, at this viewport's density. */
export function listHeight(n, h) {
  const d = density(h)
  return n <= 0 ? 0 : n * d.rowH + (n - 1) * d.gap
}

/** True when `n` activity rows fit with no scrolling at all. */
export function listFits(n, w, h) {
  return listHeight(n, h) <= regionHeight(w, h) - density(h).listPadEnd
}

/**
 * The largest number of activities a category can hold on this viewport before
 * the list starts to scroll.
 *
 * Scrolling past this point is CORRECT behaviour, not a failure — every row
 * stays at least 72px and every row stays reachable, which is the whole point of
 * the shell. This number is what tells you when to consider splitting a category
 * rather than lengthening it, because roughly 80% of attention lands above the
 * fold and the eighth row in a list is genuinely used less than the first.
 */
export function categoryCapacity(w, h) {
  let n = 0
  while (listFits(n + 1, w, h) && n < 100) n += 1
  return n
}
