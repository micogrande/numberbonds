import React from 'react'

import styles from './Screen.module.css'

/**
 * The shell every screen in this app is. (PLAN 3.3, PLAN 3.7)
 *
 * Two grid tracks: a CHROME track that owns the one way home and the screen
 * title, and a CONTENT track that is the only box in the app allowed to scroll
 * and the only box in the app allowed to clip. Content cannot enter the chrome
 * track — not "should not", *cannot*, because a grid track is not a place
 * another track's contents can be laid out.
 *
 * That single fact is the fix for the reported bug, and it is worth being
 * precise about what the bug was. On the shipped code at 375x554 the category
 * list was a centred flex column that overflowed by 210px; centring split that
 * overflow across BOTH edges, so the first activity card landed at y=35 while
 * the gate occupied y=12..68. The card is `position: relative` and the header is
 * not, so the card painted over the gate AND won its hit test:
 * `document.elementFromPoint` at the dead centre of the gate returned
 * "Bonds to…". The one way home started a game.
 *
 * ── THE `growth` PROP ───────────────────────────────────────────────────────
 *
 * Required, two values, and the decision rule is mechanical rather than a
 * judgement call:
 *
 *   'fixed'  the number of children is a CONSTANT WRITTEN IN THIS SOURCE TREE.
 *            Home is always six slots (PLAN 1: "Six category slots exist on the
 *            home screen from day one and never reorder"); a play screen is
 *            always one prompt and one input. `tests/layout/run.mjs` assertion E
 *            HOLDS THAT CLAIM: a fixed region whose content overflows fails the
 *            build, so the day a play screen grows a third block you hear about
 *            it rather than losing the keypad's ENTER row.
 *
 *   'flow'   the number of children comes from DATA — the registry, a manifest's
 *            options, a finished session. No claim is made and none is checked.
 *
 * Both scroll. `growth` is a CLAIM, not a clipping mode — see the long note in
 * Screen.module.css for why the clip came out again. Every region in this app is
 * `overflow: auto`, on every viewport, including the many where everything fits
 * and no scrollbar ever appears. A safety net installed only when the fall is
 * predicted is not a safety net.
 *
 * If you cannot name the constant in a comment, it is 'flow'. There is no third
 * value. `overflow: hidden` on a box whose child count comes from data is the
 * whole of what went wrong here: PLAN 3.3 proved it safe for the home grid,
 * where `grid-auto-rows: minmax(0, 1fr)` genuinely guarantees compression, and
 * the rule was then applied globally to four screens with no such guarantee.
 */
const Screen = ({ growth, className = '', children }) => {
  if (import.meta.env?.DEV && growth !== 'fixed' && growth !== 'flow') {
    throw new Error(
      `<Screen growth> must be 'fixed' or 'flow', got ${JSON.stringify(growth)}. ` +
        "'fixed' requires a comment naming the constant that bounds the child count."
    )
  }

  return (
    <div className={`${styles.screen} ${className}`} data-screen data-growth={growth}>
      {children}
    </div>
  )
}

/**
 * Track 1. The gate, the screen title, and nothing else.
 *
 * PLAN 3.7: "one 72px round button, top-left, in the identical position on every
 * non-home screen […] One way home, always the same pixel."
 *
 * That is now true BY CONSTRUCTION rather than by five files agreeing. The gate
 * is the first child of a fixed track with no leading padding that varies by
 * screen, so the only thing that can move it is `--safe-top` / `--safe-left` —
 * per-device hardware constants that do not change during scroll and do not
 * change with content.
 *
 * The title lives here, not in the content, for the same reason: it is chrome.
 * Scrolling it away would cost her the answer to "where am I?" at exactly the
 * moment she is furthest from the top.
 */
const ScreenChrome = ({ className = '', children }) => (
  <div className={`${styles.chrome} ${className}`} data-slot="chrome">
    {children}
  </div>
)

/**
 * Track 2. The only scroller in the app, and the only box that clips.
 *
 * `mode` is the two behaviours the app already had, named:
 *
 *   'fill'    one child stretched to the whole track — a list, the home grid
 *   'center'  a centred stack — the play screen, the summary, the option picker
 *
 * `center` is implemented with `align-content: safe center`, never plain
 * `center`. The `safe` keyword falls back to `start` the instant the content
 * would overflow, so what is lost always travels DOWNWARD where the scroller can
 * reach it. Plain centring is measurably how the shipped build put a card on top
 * of the home gate.
 */
const ScreenContent = ({ mode = 'fill', className = '', children }) => (
  <div
    className={`${styles.content} ${mode === 'center' ? styles.center : styles.fill} ${className}`}
    data-slot="content"
    data-mode={mode}
  >
    {children}
  </div>
)

Screen.Chrome = ScreenChrome
Screen.Content = ScreenContent

export { ScreenChrome, ScreenContent }
export default Screen
