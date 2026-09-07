# Amelia — agent guide

## What this is

A small hub of learning apps for **one six-year-old**, on a phone or tablet, in
portrait. It started life as a single Number Bonds game; it is now a home screen
with six category slots, of which *numbers* is awake and five are asleep until
they are built.

```
Home  "welcome amelia"
  └── numbers ──┬── number bonds   (bonds to N · parts up to N — two activities)
                ├── addition       (sums to 20)
                ├── subtraction    (minuends to 20)
                └── roman numerals (up to 10 / 50 / 100)

  flags · geography · continents · oceans · clock     ← asleep, built later
```

**`PLAN.md` in the repo root is the specification.** It is the authority on every
decision in this app: architecture, palette, deck recipes, storage keys, build
order. Read it in full before you change anything. Everything below is a summary
that tells you where to look — where the two disagree, PLAN.md wins.

**Never edit PLAN.md.** It is the spec, not a worklog. If you believe it is wrong,
say so in your report and leave it alone.

## Who this is for — read this before designing anything

**Amelia can read.** Most child-UX writing is about pre-readers and pushes hard
toward icon-only interfaces. That guidance is *not* load-bearing here. Text labels
are a real, working channel: the picture makes the screen scannable, the word says
exactly which thing it is. Do not contort a layout to avoid words, and do not strip
text labels.

What still holds, because it is about hands and attention rather than literacy: big
tap targets, one clear way home from every screen, an answer to every tap within
~100ms, no dead taps, and never a harsh error.

## Decisions taken by the owner — do not re-open these

These are settled. Do not "improve" them, and do not cite child-UX research to
justify undoing them. See PLAN.md section 9.

1. **The live timer and the live score stay on the play screen exactly as they
   are.** Personal bests keep ranking on wall-clock time.
2. **The 3–20 target grid keeps its current size and layout.** It is verified
   working on her actual phone, which outranks every guideline in this file.
   Restyle it; never resize, trim, or restructure it.
3. **Repo and deployment plumbing are untouched.** The remote stays
   `micogrande/numberbonds` and the app keeps deploying to
   `numberbonds-ten.vercel.app`. Only the local `package.json` name is `amelia`.
   Do not touch git remotes or Vercel configuration.
4. **Number Bonds stays as two separate activities** with their own labels and
   their own high scores.

## Architecture — Manifest / Engine / Renderer

Every activity is described by three artefacts and nothing else (PLAN.md §2):

- a **manifest** — pure serialisable data: identity, options, input mode, `load()`
- an **engine** — `generate(params, rng) => Question[]`, a pure function, no React
- a **prompt renderer** — a React component that reads `question.prompt` and nothing else

`activities/registry.js` is the only place that knows what exists. Home, the
category and option screens, the play host, the summary and the storage keys are
all *derived* from it. **Nothing in `app/`, `session/`, `input/`, `storage/` or
`screens/` ever names a specific activity.** Adding European flags later is one
folder plus one import line — that is the whole point of the shape.

Rules that make this a contract rather than a convention:

- `activity.id` + `option.id` + `version` form the high-score key. They are
  append-only and **stable forever**. Rename a label freely; never an id.
- `option.params` is opaque to everything except that activity's `generate`. The
  day shared code reads `params.max`, the contract has leaked.
- `generate` must be **pure** and take `rng` last. Engines must never call
  `Math.random` directly — tests stub it to throw.
- No per-activity `validate()`, no lifecycle hooks, no async `generate`, no CSS
  contract. An activity that needs one of those is telling you the abstraction is
  wrong. Fix the abstraction; do not add a hook.

The session loop is a **pure reducer** (`session/sessionMachine.js`) with exactly
one `setTimeout` in the whole app, owned by one `useEffect` and guarded by an epoch
counter. That is what structurally kills the two critical bugs this app shipped
with: a stale-closure score and orphaned timers firing into the next session.

Routing is **hash routing**, hand-rolled, zero dependencies. This is why there is
no `vercel.json`. If someone "tidies" the routes into paths, every refresh 404s in
production.

Storage keys are `amelia.scores.v1` / `amelia.prefs.v1` / `amelia.migrations.v1`,
with record keys built as `${activity.id}::${option.id}::v${version}`. Amelia has
real high scores under the old `number_bonds_scores` key — they are **migrated,
not abandoned**.

## House rules

- **Mobile first, portrait.** Design for a thumb on a real phone. Minimum touch
  target **44px**; category cards and answer buttons are far bigger than that.
- **Never the native keyboard.** No `<input>` element exists anywhere in the tree
  and eslint enforces it. Numbers are entered on the custom keypad; other answers
  are chosen from buttons. The native keyboard shifts the layout and breaks the
  illusion that this is an app.
- **Juicy feedback, via framer-motion.** Presses depress, cards spring back,
  correct answers celebrate. The *depress* fires on `:active` in pure CSS so there
  is zero JS latency — a response later than ~100ms reads to a six-year-old as "it
  didn't work" and earns a second tap.
- **Correct**: confetti (`canvas-confetti`), a green pulse, a happy bounce.
- **Incorrect**: a gentle shake and a soft reveal of the right answer. **Never a
  harsh X, never alarm red.** The error colour is ripe fruit, not danger.
- **Respect `prefers-reduced-motion`.** Feedback never disappears under reduced
  motion; only motion does. A `whileTap` scale becomes a colour flood instead.
- **No placeholder images.** No stock art, no icon fonts standing in for a
  drawing, no `via.placeholder.com`. Illustration is hand-written inline SVG in
  `src/components/garden/`, with fills referencing CSS custom properties so a
  palette change re-colours everything at once. lucide-react is chrome only —
  back gate, check, chevron — never category identity.
- **Tokens, not hex.** Colours, type sizes and radii come from
  `styles/variables.css`. The ink law: text is only ever `--color-text`,
  `--color-text-light`, or white on a `-press`/`-deep` tone. The 400-tints are
  illustration only and fail contrast as text.
- **Single page, no reloads.** The whole experience is one document.
- **Responsive by `clamp()` and flexible layout**, not by breakpoint soup.

## Stack

React 19 + Vite · vanilla CSS with CSS Modules and custom properties ·
framer-motion · canvas-confetti · lucide-react (chrome only) · vitest.

**Do not add a runtime dependency.** Dev dependencies only, and only ones PLAN.md
names. Hash routing exists precisely so react-router does not.

## Working here

```
npm run dev      # vite dev server
npm run build    # must pass before you hand work back
npm run lint     # must exit 0 — it is clean, keep it clean
npm test         # vitest run
```

Lint is configured to be worth obeying: `react-hooks/exhaustive-deps` is an
**error**, and `<input>` is banned outright. If lint fails, fix the code, not the
rule.

Tests are **vitest** in the **node** environment, co-located as `*.test.js` beside
the module they test, so deleting a module takes its tests with it. jsdom is
deliberately not installed — every engine is React-free by contract, which is what
makes node-environment testing possible. Worth testing: engines, the session
machine, storage, route parsing, rng. Not worth testing: screens, CSS, animation.

Work follows the build order in PLAN.md §7, one step at a time. Each step ships
and is deployable — a maintainer who stops halfway has a working app. Do not do
work belonging to a later step; staying in scope is what keeps this reviewable.
