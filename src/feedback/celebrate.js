import confetti from 'canvas-confetti'

/**
 * Every confetti burst in the app, in one place.
 *
 * Both call sites used to fire unconditionally — useGame on every correct
 * answer and SummaryScreen again on mount — so "respect prefers-reduced-motion"
 * was true of the CSS and false of the thing that throws two hundred particles
 * across the screen. The gate is on the CALL, not on the colours.
 *
 * ── THE GARDEN PALETTE, AS LITERALS ─────────────────────────────────────────
 *
 * These are the only hexes outside `styles/variables.css` that this pass left
 * standing, and they are hexes because they have to be: confetti draws to a
 * `<canvas>` from JavaScript and cannot read a CSS custom property. They are
 * the ramp, copied — `--blush-500`, `--butter-400`, `--sage-500`, `--blush-400`
 * — so if the ramp is ever retuned, retune this array with it. It is the one
 * place a palette change does not propagate on its own.
 *
 * Five tints, deliberately mixed light and dark: on a cream page, an all-pastel
 * burst disappears and an all-dark one reads as a bug rather than a party.
 *
 * PLAN 3: "Saturation and celebration are deliberately saved for the game
 * screens, where confetti lands against a quiet backdrop and therefore feels
 * bigger." That backdrop is the reason the garden is as quiet as it is.
 */
const GARDEN_COLORS = ['#B8496B', '#F6D98A', '#5B7553', '#E9A6BC', '#A8C0A0']

/**
 * Read at call time, not at import time — the setting can change while the app
 * is open, and the guard also keeps this importable from a node test.
 *
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * One correct answer. Small burst, garden colours.
 */
export function celebrateCorrect() {
  if (prefersReducedMotion()) return

  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: GARDEN_COLORS,
  })
}

/**
 * A finished session worth celebrating. Bigger burst, same garden colours.
 *
 * It used to fall back to canvas-confetti's own defaults, which are a primary
 * red/blue/green — the one place in the app where a colour arrived from a
 * library rather than from the palette, and the most visible one.
 */
export function celebrateSession() {
  if (prefersReducedMotion()) return

  confetti({
    particleCount: 200,
    spread: 100,
    origin: { y: 0.6 },
    colors: GARDEN_COLORS,
  })
}
