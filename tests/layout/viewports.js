/**
 * The viewport matrix. (layout regression test)
 *
 * ── THESE NUMBERS ARE MEASURED DATA, NOT DEVICE SPECS ───────────────────────
 *
 * Every height below is a SMALL-viewport height: the height a page actually gets
 * while the browser's toolbar is showing. That is the only height a page which
 * cannot scroll ever sees, because a mobile browser retracts its toolbar in
 * response to the DOCUMENT scrolling and this app's document never scrolls.
 *
 * Do NOT replace these with Playwright's device descriptors. `devices['iPhone
 * 15']` carries the 852pt SCREEN height, which this app is never given — the
 * owner measured 712 on that phone in Safari, and 712 is the number in the list.
 *
 * Emulation cannot derive them for you either: in headless and emulated Chrome
 * `100dvh === 100svh === 100lvh === innerHeight` and every
 * `env(safe-area-inset-*)` is 0. There is no collapsing chrome to observe. So
 * the small-viewport heights are hard-coded here as test data and the safe-area
 * insets are simulated by overriding the tokens (see `--simulate-insets`).
 *
 * The list is the audit matrix: fourteen portrait viewports (seven nominal and
 * seven with 110-140px of browser chrome removed) plus three landscape.
 */

/** @typedef {{ name: string, w: number, h: number, note: string }} Viewport */

/** @type {Viewport[]} */
export const VIEWPORTS = [
  // ── portrait, no browser chrome ───────────────────────────────────────────
  { name: '412x915', w: 412, h: 915, note: 'Pixel 7' },
  { name: '414x896', w: 414, h: 896, note: 'iPhone 11 / XR' },
  { name: '390x844', w: 390, h: 844, note: 'iPhone 15' },
  { name: '375x812', w: 375, h: 812, note: 'iPhone X / 12 mini' },
  { name: '375x667', w: 375, h: 667, note: 'iPhone SE2 / 8' },
  { name: '360x640', w: 360, h: 640, note: 'small Android' },
  { name: '320x568', w: 320, h: 568, note: 'iPhone SE 1st gen — the WCAG 1.4.10 floor' },

  // ── portrait, browser chrome showing (the small viewport) ─────────────────
  { name: '412x775', w: 412, h: 775, note: 'Pixel 7 + Chrome' },
  { name: '414x776', w: 414, h: 776, note: 'iPhone 11 + Safari' },
  { name: '390x704', w: 390, h: 704, note: 'iPhone 15 + Safari' },
  { name: '375x682', w: 375, h: 682, note: 'iPhone X + Safari' },
  { name: '375x554', w: 375, h: 554, note: "iPhone SE/8 + Safari — the owner's reported case" },
  { name: '360x500', w: 360, h: 500, note: 'small Android + Chrome' },
  { name: '320x428', w: 320, h: 428, note: 'iPhone SE 1st gen + Safari — the floor of the matrix' },

  // ── landscape ─────────────────────────────────────────────────────────────
  { name: '915x412', w: 915, h: 412, note: 'Pixel 7 landscape' },
  { name: '844x390', w: 844, h: 390, note: 'iPhone 15 landscape' },
  { name: '667x375', w: 667, h: 375, note: 'iPhone SE2 landscape' },
]

/**
 * A notched iPhone in standalone, approximated. `env(safe-area-inset-*)` is 0 in
 * every emulator including Chrome's device toolbar, so the only way to exercise
 * the safe-area padding is to override the tokens directly. This is crude and it
 * is the only option short of the real phone.
 */
export const SIMULATED_INSETS = { top: '59px', bottom: '34px', left: '0px', right: '0px' }

/** The house floor, and WCAG 2.5.8 / Apple's 44pt. Nothing tappable goes below it. */
export const TAP_FLOOR = 44

/**
 * The height at or above which a `growth="fixed"` screen must genuinely fit —
 * home and the five play screens. Assertion E enforces it there and stays quiet
 * below it.
 *
 * 620 IS A MEASURED NUMBER, NOT A ROUND ONE. Number bonds is the tallest play
 * screen in the app: a fixed 186x158 bond diagram (BondPrompt's GEOMETRY
 * constant), a 24px gap, a ~317px keypad and 24px of bottom padding — 523px of
 * content that nothing in the layout layer is allowed to shrink. The content
 * region is `viewport - 8 - gate band - 16`, which first clears 523 at about
 * 615px of viewport height. Measured region heights: 550 at 360x640 (fits), 480
 * at 320x568 (43px short).
 *
 * So below 620 the bond play screen scrolls a little, and that is the honest
 * answer rather than a smaller keypad or a clipped ENTER row. Every device in
 * the target matrix is well above it. Raising this number would be a lie;
 * LOWERING it needs the bond diagram or the keypad to get smaller first, and
 * both are owner decisions.
 */
export const FIXED_FLOOR_HEIGHT = 620
