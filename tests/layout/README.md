# The layout regression test

```
npm run test:layout            # the whole matrix, ~10 minutes
npm run test:layout -- --only "^category"      # one screen
npm run test:layout -- --insets                # + simulated notch insets
npm run test:layout -- --baseline              # re-record baseline.json
```

It starts `vite dev` on port 5599, drives the Chrome already installed on this
machine through `playwright-core` (no browser download), walks every screen the
registry produces, and measures `getBoundingClientRect` against
`documentElement.clientWidth/clientHeight` at seventeen viewports.

**Why it exists.** The defect it guards is invisible to every other tool here.
`npm test` runs in the node environment with no jsdom, and jsdom would not help:
it has no layout engine and reports every element at 0×0. There is no way to
assert "the home gate wins its own hit test" without a rendering engine.

**Why it is not a screenshot test.** Golden images need re-approving per viewport
per route, which for one maintainer becomes a chore that gets
`--update-snapshots`-ed into meaninglessness. These six geometry assertions catch
this bug class exactly and never need updating.

**`baseline.json` is the non-regression contract.** It was recorded on the code as
it stood *before* the two-track shell landed, and it pins home and the five play
screens — the screens the owner says already fit well — to ±1px at every viewport
at or above 620px tall. Do not re-record it to make a failure go away; a failure
means those screens moved.

**Things that will bite if you change this file:**

- Await `document.fonts.ready`. Baloo 2 and Nunito load with `display=swap` and
  row heights are wrong before they land.
- The context forces `prefers-reduced-motion: reduce`. framer-motion's entrance
  springs keep geometry in flight for a few hundred milliseconds otherwise.
- `Math.random` is pinned to a constant. `page.goto` to a different hash does not
  reload the document, so a generator's position depends on how many screens were
  visited first — a run of six deals different cards from a run of thirteen, and
  a taller Roman numerals prompt then reports a layout regression that is really
  a different card.
- Never `window.innerWidth`. Chrome widens the initial containing block when
  content overflows: at a 320px emulation on the bonds picker it reports 356,
  which hides horizontal clipping completely.
- Play routes cannot be deep-linked — `app/Shell.jsx` redirects `#/play/…` to the
  option picker unless a game was started in this tab. The suite clicks through.
  A suite that navigated straight to a play hash would measure the option picker
  five times and report green on the five screens that must not regress.
- Emulation reports `100dvh === 100svh === 100lvh === innerHeight` and every
  `env(safe-area-inset-*)` as 0. The small-viewport heights in `viewports.js` are
  measured device data, and `--insets` overrides the tokens directly. Neither is
  the real thing; an installed PWA needs one manual check per release.
