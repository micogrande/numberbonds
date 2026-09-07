# Amelia — expansion plan

Turning the single Number Bonds game into a small hub of learning apps for one
six-year-old, on a phone or tablet, in portrait.

Everything below is a decision, not an option. Where a decision was close, the
reason is on the same line. Open product questions are collected at the end and
are the only things still genuinely undecided.

---

## 1. What we are building

```
Home  "Welcome Amelia"
  └── numbers ──┬── number bonds   (exists: bonds to N, parts up to N)
                ├── addition       (practice addition up to 20)
                ├── subtraction    (practice subtraction up to 20)
                └── roman numerals (up to 10 / 50 / 100)

  flags · geography · continents · oceans · clock     ← asleep, built later
```

Six category slots exist on the home screen from day one and never reorder. A
six-year-old navigates by spatial memory; a grid that grows and reshuffles over
months forces her to relearn the page every time.

### Who this is for — read this before designing anything

**Amelia can read.** Much of the child-UX literature is written about pre-readers
and pushes hard toward icon-only interfaces; that guidance is *not* load-bearing
here and has been stripped out of this plan. Text labels are a real, working
channel. Words and pictures should reinforce each other — the picture makes the
screen scannable and friendly, the word says exactly which thing it is.

Confirmed by her father, who watches her use it:

- She reads fine. Do not contort a layout to avoid words.
- The existing 50px target buttons (3–20) work on her actual phone. **Leave that
  grid alone.** It is the one piece of evidence in this document that comes from
  real hands on a real device, and it outranks every guideline.

What *does* still hold from the research, because it is about hands and attention
rather than literacy: big tap targets, one clear way home from every screen, an
answer to every tap within ~100ms, no dead taps, and never a harsh error.

---

## 2. Architecture — Manifest / Engine / Renderer

Every activity is described by three artefacts and nothing else:

- a **manifest** — pure serialisable data (identity, options, input mode, `load()`)
- an **engine** — `generate(params, rng) => Question[]`, a pure function, no React
- a **prompt renderer** — a React component that reads `question.prompt` and nothing else

A single `registry.js` is the only place that knows what exists. Home, category
screens, option screens, the play host, the summary and the storage keys are all
*derived* from it. Nothing in `app/`, `session/`, `input/`, `storage/` or
`screens/` ever names a specific activity.

Adding European flags later = one folder + one import line. That is the whole
point of the shape.

### 2.1 The Question shape

The session reducer touches only `id`, `answer`, and `choices.length`. Everything
else is opaque to it. That is why this generalises — the loop is not "a number
bond loop that also does other things", it is a deck-of-graded-cards loop.

```js
/**
 * @typedef {Object} Question
 * @property {string} id       Unique within a deck. Used as the React key, so each
 *                             card genuinely remounts (fixes the entrance animation
 *                             that currently only plays on card 1 of a session).
 * @property {string} kind     Render family: 'BOND' | 'EQUATION' | 'GLYPH' | 'ART'.
 *                             Lets ADD and SUB share one EquationPrompt. Read by
 *                             tests and aria only — NOTHING may dispatch behaviour
 *                             on it. If it ever grows a switch, delete it instead.
 * @property {Object} prompt   ENGINE-SPECIFIC. Only that kind's renderer reads it.
 * @property {string|number} answer   Graded value. A primitive comparable with ===
 *                             unless the module supplies grade().
 * @property {Choice[]} [choices]  Present iff inputMode === 'choice'. Order is final;
 *                             the engine has already placed the correct answer.
 * @property {Object} [meta]   Difficulty tags. Read by TESTS only. Never rendered.
 */

/**
 * @typedef {Object} Choice
 * @property {string|number} id   Graded against question.answer.
 * @property {string} label       Always present — doubles as the aria-label.
 * @property {ArtRef} [art]       Optional picture instead of the label text.
 */
```

Proof it generalises — the five cases, including two we have not built:

```js
// 1. number bond, part missing
{ id:'BOND-W10-P3-p1', kind:'BOND',
  prompt:{ whole:10, parts:[3,7], missing:'part1', text:'3 and what make 10?' },
  answer:7 }

// 2. written equation
{ id:'SUB-17-4', kind:'EQUATION',
  prompt:{ terms:[{t:'num',v:17},{t:'op',v:'−'},{t:'num',v:4},{t:'op',v:'='}],
           text:'17 − 4 = ?' },
  answer:13, meta:{ block:'B' } }

// 3. roman numeral, multiple choice
{ id:'ROM-40', kind:'GLYPH',
  prompt:{ glyph:'XL', text:'X L' },       // spaced for screen readers
  answer:40,
  choices:[{id:41,label:'41'},{id:60,label:'60'},{id:40,label:'40'},{id:39,label:'39'}] }

// 4. european flag — NOT BUILT, shape check only
{ id:'FLAG-ES', kind:'ART',
  prompt:{ art:{ kind:'flag', code:'ES' }, text:'Which country has this flag?' },
  answer:'ES',
  choices:[{id:'PT',label:'Portugal'},{id:'ES',label:'Spain'},…] }

// 5. clock face — NOT BUILT, shape check only
{ id:'CLOCK-0715', kind:'ART',
  prompt:{ art:{ kind:'clock', h:7, m:15 }, text:'What time does the clock show?' },
  answer:'07:15',                          // canonical zero-padded HH:MM, a primitive
  choices:[{id:'07:15',label:'quarter past 7'},…] }
```

`missing: 'whole' | 'part0' | 'part1'` replaces today's `missingIndex: 0|1|'WHOLE'`,
which overloads a number with a sentinel string and would not survive a third position.

Note for whoever builds the clock: the hour hand is `hour*30 + minute*0.5`, so at
3:30 it sits *between* 3 and 4. A child who can read a real clock will notice a
hand pinned to the 3.

**Known limit, stated plainly:** a *drag the clock hands* variant is a third input
mode and does need new machinery. Tap-to-choose does not. We are not pretending
the abstraction covers everything.

### 2.2 The manifest contract

```js
/**
 * @typedef {Object} ActivityManifest
 * @property {string} id          Uppercase snake. STABLE FOREVER — half the score key.
 *                                Must not contain "::".  e.g. 'ADD', 'ROMAN'
 * @property {string} slug        Kebab-case, unique, URL segment. 'roman-numerals'
 * @property {string} categoryId  Must match a CATEGORIES entry.
 * @property {number} version     Deck-recipe version. Bump ONLY when the recipe
 *                                changes enough to make old scores incomparable.
 * @property {string} title, subtitle, accentVar
 * @property {number} order
 * @property {ActivityOption[]} options
 * @property {'grid'|'list'} optionPicker
 * @property {'keypad'|'choice'} inputMode
 * @property {KeypadConfig|ChoiceConfig} inputConfig
 * @property {() => Promise<ActivityModule>} load   Memoised dynamic import.
 */

/**
 * @typedef {Object} ActivityOption
 * @property {string} id        ^[a-z0-9-]+$, STABLE FOREVER — other half of the key.
 * @property {string} label, short
 * @property {Object} params    OPAQUE to everything except this activity's engine.
 * @property {number} deckSize  Asserted in dev against what the engine actually
 *                              returns. This is what keeps personal bests honest.
 */
```

**What the contract deliberately does NOT include** — copy this comment into
`manifestSchema.js` verbatim, it is the fence that stops the manifest growing a
hook per activity:

> No per-activity `validate()`. No lifecycle hooks (`onStart`, `onCorrect`). No
> async `generate`. No CSS contract. An activity that needs one of these is
> telling you the abstraction is wrong — fix the abstraction, do not add a hook.

Three rules make this a contract rather than a convention:

1. `id` + `option.id` + `version` form the high-score key. Append-only. Rename the
   *label* freely; never the id.
2. `option.params` is opaque to everything except that activity's `generate`. The
   day shared code reads `params.max`, the contract has leaked.
3. `generate` must be pure and take `rng` last. This single rule is what makes the
   entire content layer testable.

Validation is two-layered: `defineActivity()` wraps each manifest export with
dev-only shape assertions that fail at import time pointing at the offending file;
`validateRegistry()` checks only cross-activity uniqueness (duplicate ids/slugs,
unknown categoryId) at boot.

### 2.3 Session loop

`useGame.js` becomes a **pure reducer** (`sessionMachine.js`) driving
`answering → success → advance` and `answering → shake → reveal → advance`, with
**exactly one** `setTimeout` owned by one `useEffect` and guarded by an epoch
counter.

This structurally eliminates the two critical bugs rather than patching them:

- the final score is computed inside the reducer from its own state, so no
  callback can capture a stale `score`
- there is one timer in the app and its cleanup is React's own effect lifecycle,
  so no orphaned callback can survive a navigation

Timings stay exactly as they are today — shake 500ms, success 1500ms, reveal 2500ms
— so all four activities feel identical.

### 2.4 Input modes

A two-entry registry (`keypad`, `choice`) behind one `SUBMIT {value}` event. A
multiple-choice Roman numeral and a keypad equation are the *same* session with a
different adapter. An activity may supply an optional `grade(question, value)` if
its answer is not a comparable primitive — that is the seam that would absorb a
composite `{h,m}` clock draft with no session change.

No `<input>` element exists anywhere in the tree, which is how "never the native
keyboard" gets enforced structurally instead of by discipline. Add an eslint rule
to keep it that way.

### 2.5 Routing — hash, no dependency

```
#/                                Home
#/c/:categorySlug                 Category
#/a/:activitySlug                 Activity option picker
#/play/:activitySlug/:optionId    Session
#/summary/:activitySlug/:optionId Result
```

Hash routing, ~80 lines, zero runtime dependencies. Path routing on Vercel needs a
`vercel.json` rewrite and introduces two production failure modes that do not
otherwise exist (a deep-link 404 if the rewrite is wrong, and a stale-chunk 404 for
any tab left open across a deploy). react-router buys deep-linkable URLs, which are
worth nothing to a child who cannot type one.

> **Load-bearing, put this in the README:** hash routing is why there is no
> `vercel.json`. If someone "tidies" the routes into paths, every refresh 404s in
> production.

`parseRoute(hash)` and `buildRoute(route)` are pure and tested; the hook is a
`hashchange`/`popstate` listener.

Behaviour:

- Play → Summary uses `replace`, not `push`, so back from the summary lands on the
  option picker, never back inside a finished game.
- Back mid-game **abandons the session** and is never scored. No confirm modal — a
  six-year-old should not be asked "are you sure?", and the popstate-intercepting
  dance needed to implement one is fragile and escapable with a fast double-back.
- Back on Home is not trapped. Leaving the app is correct behaviour.
- An unknown activity or option in the URL redirects to `#/`. She can never land on
  a broken screen.
- Refresh mid-session drops it and lands on that activity's option screen with her
  last choice pre-selected. She does not refresh on purpose, so this path is a
  crash; after a crash, "here is the button, press it again" beats being dropped
  into a half-finished game she does not remember. `overscroll-behavior: none` is
  already set, so pull-to-refresh is already dead. *(No mid-session snapshot in v1
  — see Deferred.)*

### 2.6 Storage

```
amelia.scores.v1       { [recordKey]: BestRecord }
amelia.prefs.v1        { lastOption: { [activityId]: optionId } }
amelia.migrations.v1   { applied: ['bonds-2024'] }
```

```js
const scoreKey = (activity, option) =>
  `${activity.id}::${option.id}::v${activity.version}`;
// 'BOND_WHOLE::t10::v1'   'ADD::to20::v1'   'ROMAN::to100::v1'
```

Parseable by construction (`::` forbidden in ids and validated — today
`PRACTICE_PARTS_10` cannot be split on `_`), collision-free, and versioned.

```js
BestRecord = { score, total, wallMs, recipeVersion, playedAt, plays }
```

`total` is stored so the summary can say `Previous best: 10 / 18` rather than a
bare number.

`safeStorage.js` guards **both** read and write — today only the read is guarded,
which means a storage failure in private browsing throws out of the session-complete
path and hangs the app on the last card forever. It also rejects a
successfully-parsed non-object, because `JSON.parse('null')` succeeds and returns
`null`.

`isFirstResult` and `isNewRecord` are returned **separately**, and `isNewRecord`
requires `score > 0`. Today a child who gets every question wrong on a fresh browser
is congratulated with a trophy and 200 particles of confetti.

**Existing scores are migrated, not abandoned.** Amelia has real high scores in
`number_bonds_scores`. Prefix-matched longest-first (`PRACTICE_PARTS_` before
`PRACTICE_`), zero-scores dropped, never clobbering an existing key, the old key
left in place as a backup for one release, idempotent so StrictMode's double-invoke
is a no-op.

Ranking stays on **wall-clock time**, unchanged. It is true that ~1.5s per card is
fixed animation and the record is therefore hard to beat — but changing the ranked
metric during the migration would visibly reset Amelia's existing time records on
the day it ships. That is a regression to the actual user for a benefit orthogonal
to the architecture. Revisit later as its own explicit version bump.

### 2.7 File tree

```
src/
├─ app/          App.jsx · Shell.jsx · routes.js · useHashRoute.js · ErrorBoundary.jsx
├─ activities/   registry.js · categories.js · manifestSchema.js
│  ├─ number-bonds/   manifest.js · index.js · bondEngine.js · BondPrompt.jsx
│  ├─ arithmetic/     manifest.js · index.js · arithmeticEngine.js · EquationPrompt.jsx
│  └─ roman-numerals/ manifest.js · index.js · roman.js · romanEngine.js · GlyphPrompt.jsx
├─ session/      sessionMachine.js · useSession.js
├─ input/        inputRegistry.js · KeypadInput.jsx · ChoiceInput.jsx · AnswerBox.jsx
├─ screens/      Home · Category · Activity · Play · Summary
├─ components/   ScreenHeader · Keypad · Timer · CategoryCard · ActivityCard
│                OptionPicker · garden/ (SVG motifs)
├─ storage/      safeStorage.js · scores.js · prefs.js · migrations.js
├─ lib/          rng.js (mulberry32 + seeded shuffle) · time.js · id.js
├─ feedback/     celebrate.js · motion.js
└─ styles/       variables.css
```

Deleted: `App.css` (dead *and* dangerous — its `#root { max-width:1280px; padding:2rem }`
contradicts `index.css` and would break full-screen the instant anyone re-added the
import), `assets/react.svg`, `public/vite.svg`, `hooks/useGame.js`,
`engines/BondEngine.js`, `storage/ScoreStorage.js`, `styles/Screens.module.css`.

Tests are co-located as `*.test.js` beside the module they test, so a deleted module
takes its tests with it.

---

## 3. Design — "Amelia's Garden"

Warm morning light on a cream page, soft sage, hand-drawn strawberries and
butterflies. The home screen reads as one small garden seen from above: six rounded
patches, one already in bloom and five still asleep.

Saturation and celebration are deliberately **saved for the game screens**, where
confetti lands against a quiet backdrop and therefore feels bigger.

### 3.1 Tokens

Two tiers: a raw ramp underneath, semantic names on top. The ramp is what makes
"turn the whole thing up if she finds it boring" a ten-line change rather than a
redesign.

```css
:root {
  /* ─── ink law ──────────────────────────────────────────────────────────
     Text is ONLY ever --color-text, --color-text-light, or white on a
     -press/-deep tone. The 400-tints are ILLUSTRATION ONLY.
     Measured fails, do not use for text:
       --sage-400  #A8C0A0  1.85:1 on bg      --blush-400 #E9A6BC  2.1:1 on bg
     ──────────────────────────────────────────────────────────────────── */

  /* raw ramp */
  --cream-100:#FBF8F1; --cream-200:#FFFDF8;
  --sage-100:#EEF3E7; --sage-200:#E3EDD9; --sage-400:#A8C0A0;
  --sage-500:#5B7553; --sage-600:#4A6244; --sage-700:#3C5137;
  --blush-100:#FDF0F2; --blush-200:#F9DCE3; --blush-400:#E9A6BC;
  --blush-500:#B8496B; --blush-700:#97304F;
  --butter-100:#FDF6E4; --butter-200:#FBEBC8; --butter-400:#F6D98A;
  --sand:#F2E4D4; --bark:#8A6A4F;
  --sleep-surface:#EDE9DF; --sleep-edge:#DCD5C6;

  /* semantic */
  --color-bg:var(--cream-100);        --color-surface:var(--cream-200);
  --color-text:#3E4A3A;               /* 8.82:1 on bg */
  --color-text-light:#616D5B;         /* 5.15:1 on bg — AA at every size */
  --color-primary:var(--sage-500);    --color-primary-hover:var(--sage-600);
  --color-primary-press:var(--sage-700);
  --color-secondary:var(--blush-500); --color-secondary-press:var(--blush-700);
  --color-success:#2E7D4F;            --color-success-press:#22603C;
  --color-success-soft:#EAF5EE;       /* replaces hardcoded #f0fdf4 */
  --color-warning:#A8551A;
  --color-warning-soft:#FBF1DF;       /* replaces hardcoded #fffbeb */
  --color-error:#C0455A;              /* ripe fruit, not alarm red */
  --color-error-press:#9C3348;

  /* reserved for the sleeping categories */
  --garden-sky:#DDEAF0; --garden-lilac:#E7E0EF; --garden-peach:#FBEEE0;

  /* type — fluid, no magic numbers */
  --fs-display: clamp(2.25rem, 5vw + 1rem, 3.25rem);
  --fs-h2:      clamp(1.5rem, 3vw + 0.7rem, 2.125rem);
  --fs-card:    clamp(1.1875rem, 2.5vw + 0.6rem, 1.625rem);
  --fs-body:    clamp(1.0625rem, 1.5vw + 0.7rem, 1.25rem);
  --fs-numeral: clamp(2.75rem, 10vw + 0.5rem, 5rem);

  /* the slab — this is what makes a card read as a button to a pre-reader */
  --slab: var(--sage-700);
  --shadow-slab:  0 6px 0 0 var(--slab), 0 8px 16px -8px rgba(90,110,84,.28);
  --shadow-press: 0 0 0 0 var(--slab), 0 2px 6px -3px rgba(90,110,84,.24);
  /* shadows are green-tinted, never black — black on cream goes grey and kills it */

  --radius-card:28px;
  --radius-pebble:44% 56% 52% 48% / 50% 46% 54% 50%;
  --safe-top:env(safe-area-inset-top); --safe-bottom:env(safe-area-inset-bottom);
  --ambient-play:running;
}
@media (prefers-reduced-motion: reduce) {
  :root { --ambient-play:paused; }
}
```

`--slab` is overridden per category (`.catOceans { --slab: … }`) and the shadow
re-resolves, because custom properties substitute at computed-value time. Shipping
a new category is two properties, not a new rule.

Prune while extending: `--radius-sm`, `--radius-md`, `--shadow-sm`, `--shadow-lg`,
`--shadow-float` and `--font-heading` are currently defined and referenced nowhere.

### 3.2 Type

Two families. **Baloo 2** (700/800) for display and category labels — thick, closed,
high x-height, survives being set enormous and still reads friendly. **Nunito**
(400/700/900), already loaded, for body and **all maths digits**. Nunito's 1/7/4 are
unambiguous at speed and the keypad, bond diagram and timer are already tuned to its
metrics; switching the numeral face would be a regression dressed as a redesign.

Category labels are **lowercase** — a style choice that suits the garden, not a
literacy workaround. Don't letter-space them.

### 3.3 Home screen

The page cannot scroll (`body { overflow:hidden }`), which happily matches the
guidance to avoid scrolling for young children. So it is a fill-the-viewport layout.
Switch `100vh` → `100dvh` with a `100vh` fallback so the iOS URL bar does not clip
the last row.

1. **Header band**, `clamp(96px, 17vh, 150px)` — "welcome amelia" in Baloo 800, two
   lines, with *amelia* in blush. A bunny at ~56px peeks over the top-right, ears
   breaking the line. A 3px hand-drawn grass baseline runs full width underneath,
   planting the header on the ground without a rule or a card.
2. **Grid**, `flex:1`, two columns always, `grid-auto-rows: minmax(0,1fr)`, three
   rows, six cards. No `aspect-ratio` — let the row be `1fr` so the grid compresses
   instead of overflowing on a short device. Smallest computed card is 141×123 at
   320×568, which is roughly double the 75px guidance for children and triple the
   44px house floor. At ≥600px, `max-width:560px; margin-inline:auto` so tablet
   cards don't stretch into letterboxes.
3. **Bottom: nothing interactive.** Children mis-tap bottom-edge controls. Two
   overlapping sage hills bleed off the bottom edge, `pointer-events:none`.
4. **Ambient layer** behind the cards: two butterflies on coprime 18s/26s paths so
   they never sync into a pattern. They pass *behind* the cards, which is what makes
   the page feel like a place rather than a screen. Paused in-game and on
   `visibilitychange`.

Numbers is pinned top-left and never moves.

### 3.4 The card

The whole card is the button. No nested targets, nothing she can hit by accident
that does something different.

Press state is where the juice lives: `box-shadow: var(--shadow-slab)` collapsing to
`--shadow-press` with `translateY(6px)`. The **depress fires on `:active` in pure
CSS** so there is zero JS latency — a response later than ~100ms reads to a
six-year-old as "it didn't work" and produces a second tap. framer-motion handles
only the release spring.

The slab also solves a real problem: card surface `#FFFDF8` against page `#FBF8F1`
is 1.04:1, so without it the card is defined by a soft shadow alone and vanishes on
a cheap panel or in sunlight.

Inside, the illustration sits on an organic blob (`border-radius: 44% 56% 52% 48% /
50% 46% 54% 50%`), with three variants rotated so no two neighbours have the same
silhouette. A `::after` pencil outline — inset 5px, `1.5px solid var(--color-text)`
at 18% opacity, `rotate(0.35deg)` — makes a CSS rectangle read as hand-drawn for
four lines of code.

Under reduced motion, `whileTap` becomes a background-colour flood rather than a
scale. Feedback never disappears; only motion does.

### 3.5 Illustration

No image files ship. Every motif is hand-written inline SVG in
`src/components/garden/`, one file per motif, fills referencing CSS custom properties
so a palette change re-colours everything at once.

House rules so six drawings by one hand read as one family: max 3 flat fills plus one
outline; outline `#3E4A3A` at 3.5px with `vector-effect: non-scaling-stroke`; nothing
smaller than 6px at the smallest render size; built from ~7 shared primitives (petal,
leaf, hill, berry, wing, ear, stem); the bunny gets two dot eyes and a blush oval,
no mouth.

- **numbers** → a strawberry patch. Chosen deliberately: strawberries are countable
  and the seeds give her something to count while she waits.
- flags → bunting · geography → hedgehog with a leaf map · continents → globe as a
  round flowerbed · oceans → lily pond with one orange fish · clock → a sunflower
  whose face is a dial, because sunflowers follow the sun.

lucide-react is kept but **demoted to chrome only** (back gate, check, delete,
chevron), at `strokeWidth={2.5}` so it doesn't look thin beside Baloo. Line art
cannot carry category identity for a pre-reader — a `Waves` icon does not say
"oceans" to a six-year-old, it says "three grey squiggles".

### 3.6 The five sleeping categories

Not locked, not greyed out — **asleep**. A padlock reads as a punishment or a
paywall, and greyscale-at-40% makes five of the six things on her screen look
broken. Asleep is warmer and it is honest: sleeping things wake up on their own
schedule.

Since she reads, the word is doing real work — label these `oceans · asleep` (or
similar) so the state is stated as well as drawn.

A sleeping slot has **no white face and no slab** — just a terracotta pot with the
bunny curled asleep beside it and one unopened bud in that category's reserved tint,
sitting directly on the page. The position is held for spatial memory while the
affordance is unmistakably absent.

The label stays full moss ink (7.71:1). Greying it to `--color-text-light` gives
3.73:1 and fails AA. "Asleep" is said by the picture and the missing slab, never by
making the word harder to read.

Tapping one is **not a dead tap** — children read an unresponsive tap as "the device
is broken", not "this isn't available". It wiggles ±2.5° for 400ms and a small
"z z z" floats up and fades. Honest, charming, over in half a second, and it does not
escalate on repeat taps. Sleeping things wake up on their own schedule and there is
nothing you can do about it, which is a fact of life a six-year-old has fully
accepted.

Rejected: a seedling that grows a leaf per tap. It implies she can make the category
arrive by tapping enough, which is a promise the app cannot keep.

When a category ships it plays a one-time 900ms wake sequence, then never animates
unprompted again.

### 3.7 Numbers menu

Tapping *numbers* opens a **full screen**, animated as a shared-element expansion —
the card is a `motion.div layoutId="cat-numbers"` and the category header carries the
same id, so the thing she touched visibly becomes the room she is in.

Not an accordion: the page cannot scroll, so revealing three activities would shove
the other cards off the bottom, and the card she touched would slide away from her
finger. Not a bottom sheet: it leaves two surfaces live at once, dismissal requires
an adult convention (drag the handle, tap outside), and it puts controls at the
bottom edge where children mis-tap.

Getting back is **one 72px round button, top-left, in the identical position on every
non-home screen**, drawn as a little wooden garden gate. One way home, always the same
pixel. That single consistent exit is worth more than any navigational elegance.

Three activity rows, each ~190px tall on a 390×844 phone, with option chips inline so
the common case is Home → playing in two taps:

- **number bonds** → the existing 3–20 target grid, **kept at its current size and
  layout**. Confirmed working on her phone. Restyle it into the garden palette; do
  not resize it, do not reduce the range, do not restructure it into levels. Fix
  only the bug where the selection resets to 10 on every return home.
  Both variants stay as two separate activities with their own labels and high
  scores — "Bonds to 10" and "Parts up to 10" are perfectly distinguishable to a
  child who reads. Give them different art anyway, because it looks better.
- **arithmetic** → two chips, each showing the operation *and* a worked preview:
  "addition · 8 + 5 = ?" and "subtraction · 17 − 4 = ?". Word and picture reinforcing
  each other.
- **roman numerals** → three chips reading **X**, **L**, **C** with "up to 10 / 50 /
  100" beneath.

---

## 4. Activity specs

### 4.1 Number Bonds — preserved

Behaviour is unchanged. The engine is converted to emit the `Question` shape with
`rng` injected, `missingIndex` becomes `missing: 'whole'|'part0'|'part1'`, the
double-assigned `answer` landmine is deleted, and `BondDiagram` → `BondPrompt` keyed
on `question.id`. Non-regression tests pin the current counts: 11 cards for
`whole=10`, 18 for `mixed(20)`.

Two visual bugs fixed in passing: the connector SVG (currently `top:50%` on a
container whose whole circle lives in the *top* half, so the lines float across the
part circles and never touch the whole — the code comment already admits the
coordinates were never matched to the layout), and the entrance animation that only
plays on card 1.

### 4.2 Addition — `ADD`, 18 cards

**"Numbers from 3 to 20" means the range of the SUM**, not of every operand. The
existing `generateMixedDeck` already uses that exact phrasing with that exact meaning
(`for (let w = 3; w <= max; w++)` over the whole). Reading it as "every operand ≥ 3"
would delete every `+1` and `+2` fact — the first facts a six-year-old must be fluent
in — and force a minimum sum of 6.

```
1 ≤ a ≤ 19 · 1 ≤ b ≤ 19 · 3 ≤ a+b ≤ 20 · answer = a+b
0 never appears.
```

Zero is excluded because Number Bonds already drills `0 + n` for every target, and
`n + 0` requires no counting or recall — it inflates the score without teaching
anything.

The missing value is **always the result**, 100% of cards. Missing-*addend* is
precisely what Number Bonds already is, and keeping the unknown always immediately
right of `=` gives one stable visual grammar while she is still learning what `=`
means.

Both orientations exist as cards (`13+4` is count-on-from-larger; `4+13` requires
first noticing you should flip it — genuinely different problems at this age), but a
given unordered pair appears **at most once per deck**.

Card space is 189 ordered cards, partitioned into three blocks that sum to 189:

| block | rule | size | skill |
|---|---|---|---|
| A within ten | `a+b ≤ 10` | 44 | count-on, no bridging |
| B teen + small | `a+b ≥ 11` and `max ≥ 10` | 109 | ones-column only (13+4) |
| C bridging ten | `a+b ≥ 11` and `max ≤ 9` | 36 | make-ten (8+5 = 8+2+3) |

Deck = 6 A, then 6 B, then 6 C, in that order. Reserved slots guarantee coverage:
index 4 a double ≤10, index 6 a fact with an addend of exactly 10, index 12 a double
≥11. Block B renders larger-first at indices 6–9 and smaller-first at 10–11, so she
meets the flipped form only after four count-on reps. A final block-local fix-up pass
prevents two adjacent cards sharing an answer.

Rendered `17 + 4 = ␣` on one line. Input cap **2 digits** (max answer is 20),
overriding the hook's current 3.

### 4.3 Subtraction — `SUB`, 18 cards

Same reading: 3–20 is the **minuend**, consistent with the given example `17 - 4`.
Subtrahend capped at 9 — subtracting a two-digit number is a later skill needing
partitioning, and unconstrained sampling produces those about a third of the time.

```
3 ≤ m ≤ 20 · 1 ≤ s ≤ 9 · s ≤ m-1 · answer = m-s, so 1 ≤ answer ≤ 19
0 never appears, and the answer is never negative.
```

`n − n = 0` is excluded: it is a rule to be told, not a fact to be recalled, and it
breaks the visual grammar — the answer box shows `?` when empty and a big `0` when
answered, and both read as "nothing" to a child.

**Why this is not just Number Bonds re-skinned:** Number Bonds never renders a `−`
sign anywhere. Subtraction as an operation with its own symbol, read left to right,
is genuinely new content. (Note that `17 − ? = 13` *is* literally a Number Bonds card
in equation clothing, which is exactly why the blank is always the result.)

134 cards, blocks A (`m ≤ 10`, 44) / B (`m ≥ 11`, `answer ≥ 10`, 54 — the given
example lives here) / C (`m ≥ 11`, `answer ≤ 9`, 36). Reserved: index 5 `m === 10`,
index 11 `answer === 10`, index 12 `s === 9`.

> **Implementation trap, the most likely bug in this file:** block C thins out at the
> top. Available C cards per minuend are `{11:8, 12:7, 13:6, 14:5, 15:4, 16:3, 17:2,
> 18:1, 19:0, 20:0}`. Minuends 19 and 20 have **no** bridging card at `s ≤ 9`. A
> sampler that assumes every minuend can produce a C card loops forever.

`−` is U+2212 MINUS SIGN, not a hyphen — at 44px+ the difference is obvious.

### 4.4 Roman Numerals — `ROMAN`, multiple choice

Four choices in a 2×2 grid, each ≥88px tall. Three choices give a 33% guess floor
that makes the score noise; six would halve the button height or push the numeral off
screen. Four means exactly one correct plus three distractors, one per confusion
family.

Deck: **up to 10 is exhaustive** — there are only ten possible cards, so she meets
all ten every session and only the order and button positions vary. That is right for
a closed set of ten facts. Up to 50 and up to 100 are 12 cards, stratified across five
shape classes with the two hardest slots reserved: one round-ten from `{40,50}` /
`{40,60,90,100}`, and the **final card** drawn from the double-subtractive set
`{44,49}` / `{44,49,94,99}` — `XLIV`, `XLIX`, `XCIV`, `XCIX`.

**Distractors are a pure function of `(value, max)` with no randomness at all**, so
every set is assertable with an exact expected array. Randomness enters only in which
values are sampled and where the buttons go.

The ladder, evaluated in order until three are accepted, rejecting anything outside
`[1, max]`, equal to the answer, or already taken:

| rule | family | example |
|---|---|---|
| R1a | subtractive read additively | `XL → 60`, `IX → 11`, `IV → 6` |
| R1b | additive read subtractively (**trailing pair only**) | `LX → 40`, `XI → 9` |
| R2 | tally miscount | ±1 |
| R3 | ten slip (**only when value ≥ 10**) | ±10 |
| R4 | five slip (V read as X) | ±5 |
| R5 | fifty slip (L/C) | ±50 |
| R6 | nearest-neighbour backstop | ±2, ±3, … |

R1b matches the **last two characters**, not `includes` — `XIII` must not generate 9;
no child misreads the leading `XI` of `XIII` as `IX`. R3's `value ≥ 10` gate stops `I`
producing 11, which is not a real confusion.

Verified outputs: `IV → [6,5,3]` (the reversal plus neighbours) · `IX → [10,8,4]` (the
whole 4/6/9/11 cluster) · `XL → [60,41,39]` · `LX → [40,61,59]` · `C → [99,90,95]`,
which puts `XC` on a button.

Checked exhaustively over all 480 distractors for max ∈ {10,50,100}: always exactly 3,
always distinct, always in range, and **every one within 20 of the answer** — no
absurd option ever reaches a button.

Accepted consequence: at max=50, `XL`'s reversal (60) is out of range and is dropped,
so the `XL`/`LX` pair is not directly exercised there. Keeping distractors inside the
advertised range matters more, because an out-of-range option is eliminable without
reading the numeral. The confusion is fully exercised at max=100.

Correct-answer position is balanced across the deck (each of the four slots used
3×/3×/3×/3× at n=12) with no position used twice in a row, so she can never score by
pattern or by thumb position. Choices are shuffled, not sorted — sorted order leaks
structure, because the reversal distractor sits at a fixed offset.

Numeral rendered uppercase in a serif face with `letter-spacing ≥ 0.08em` so `III` is
countable. Wrong answer dims rather than crossing out; the correct button then lights
green. Never a red X.

---

## 5. Bugs to fix along the way

15 found. The two critical ones are structurally eliminated by the reducer, not
patched.

| sev | where | what |
|---|---|---|
| **critical** | `useGame.js:74` | Stale-closure `score` reaches `saveScore` — the last correct answer of a session is never counted, so a perfect run can never be recorded. The summary shows "11 / 11" directly above "Previous Best: 10", and 11 can never be stored. |
| **critical** | `useGame.js:98` | Timer handles never stored or cleared. Answer a card, tap Home within 1.5s, start another game — the orphaned callback fires into the new session, showing a card from the old deck and silently skipping one. The error path leaves two orphans, one of which stamps the previous session's answer into the new input box. |
| high | `ScoreStorage.js:43` | `setItem` unguarded. In private browsing it throws out of `nextProblem` *before* `setMode(SUMMARY)`, so the app hangs on the last card forever, every session. |
| high | `ScoreStorage.js:28` | First session is unconditionally a personal best — 0/11 fires the trophy and 200 particles of confetti. |
| medium | `BondDiagram.module.css:83` | Connector lines can never reach the whole circle. The core visual of a number bond is broken. |
| medium | `BondDiagram.jsx:54` | Index keys → the entrance animation plays only on card 1 of each session. |
| medium | `index.css:21` | `100vh` + `overflow:hidden` with no landscape query — in landscape the ENTER/0/DEL row is clipped off-screen and unreachable. |
| medium | `GameScreen.jsx:18` | Home button is an unstyled 24px icon — well under the 44px the house rules mandate. |
| medium | `ScoreStorage.js:24` | No `total` stored, so "Previous Best: 10" has no denominator. |
| medium | `App.jsx:20` | No history integration — hardware Back exits the app mid-session. |
| low | ×5 | Double-assigned `answer` in `BondEngine`; `JSON.parse('null')` unguarded; silent no-op on empty ENTER; target resets to 10 on every return home; `npm run lint` fails on a false positive, which trains everyone to ignore lint. |

Dead code to delete: `App.css`, `assets/react.svg`, `public/vite.svg`, `generateBond`,
`getBestScore`, the unreachable `{!SummaryScreen && …}` branch in `App.jsx`, the
orphaned JSDoc above `generateDeck`, duplicated declarations in two CSS modules, and
`formatTime` duplicated between `Timer.jsx` and `SummaryScreen.jsx`.

---

## 6. Testing

**vitest**, one dev dependency. (`node --test` was the leaner option and was rejected:
on Windows `node --test 'src/**/*.test.js'` goes through cmd.exe, which does not strip
the single quotes, and recursive test discovery only landed in Node 21.)

`environment: 'node'` — every engine is React-free by contract, which is what makes
this possible. jsdom is deferred until a component test genuinely earns it.

Worth testing: `roman.js` (exact-value tables and the full distractor ladder),
`arithmeticEngine.js` (block counts 44/109/36 and 44/54/36, reserved slots, no
duplicate unordered pairs, no adjacent equal answers, determinism under a seeded
rng, and the block-C shortfall at the top of the minuend range), `sessionMachine.js`
(the headline test: dispatch 18 correct answers, assert the recorded score is 18 —
this is the permanent guard against the stale-closure bug class), `scores.js`,
`migrations.js`, `routes.js`, `rng.js`.

Not worth testing: screens, CSS, animation.

Engines must not call `Math.random` directly — tests stub it to throw.

---

## 7. Build order

Each step ships and is deployable. A maintainer who stops halfway has a working app.

| # | step | parallel-safe |
|---|---|---|
| 1 | Hygiene: delete dead files, rename package to `amelia`, real title/favicon, fix lint, add vitest, **rewrite `AGENTS.md` for the hub** (it currently describes a single Part-Part-Whole app and will actively steer future agents back to that framing) | — |
| 2 | Shared primitives: `lib/rng.js`, `lib/time.js`, `feedback/motion.js`, `feedback/celebrate.js`, `100dvh` + landscape fix, `ScreenHeader` with a 44px home button | — |
| 3 | Storage behind a shim: `safeStorage`, `scores`, `migrations`. `ScoreStorage.js` becomes a two-line forwarder so `useGame` compiles untouched. **Verify on her device that existing bests still show, before moving on** | — |
| 4 | `sessionMachine.js` + tests. Wire nothing. Zero risk | — |
| 5 | Swap `useGame`'s internals for the reducer, keeping its exact return shape so every screen compiles unchanged. **This is the commit that fixes the critical bugs** — the single most valuable commit in the plan | — |
| 6 | Introduce the `Question` shape; convert `BondEngine`; `BondDiagram` → `BondPrompt` keyed on `question.id`; fix the connector SVG | — |
| 7 | Input layer: `KeypadInput`, `AnswerBox`, `inputRegistry`; `GameScreen` → `PlayScreen` composing header + prompt + input | — |
| 8 | **Registry + hash routing + Home/Category/Activity screens.** The one big-bang. One agent, on a branch, play-tested on her actual phone including the hardware back button from every screen, before merge | no |
| 9 | `prefs.js` — remember her last chosen option | yes |
| 10 | **Roman Numerals**, tests first. Deliberately before Arithmetic: it stresses the contract hardest (non-keypad input, non-numeric prompt), so if the abstraction is wrong it is cheapest to find out here | yes |
| 11 | **Arithmetic**, tests first. Shares `EquationPrompt` between ADD and SUB | yes |
| 12 | **Amelia's Garden**: tokens, type scale, home screen, category cards, the six SVG motifs, sleeping slots | yes |
| 13 | Polish: aria-live announcements, `MotionConfig reducedMotion="user"`, confetti gated on reduced motion, `user-select:none` on the play screen | yes |

**Falsifiable acceptance test for steps 10 and 11** — the step passes only if no file
outside `activities/<id>/` and the single registry import line has changed. This is
the only mechanism that *proves* the contract rather than asserting it, it catches a
wrong abstraction at the cheapest moment, and it is what makes two agents building two
activities in parallel safe.

---

## 8. Deferred, on purpose

- **Mid-session resume.** A snapshot of the deck in localStorage on every card is
  net-new failure surface (a corrupt snapshot becomes a crash loop) for a path she
  will rarely hit. Refresh drops to the option screen instead. Revisit if it bites.
- **Think-time ranking.** Correct diagnosis, wrong moment — see §2.6.
- **`Art.jsx` dispatch table.** Add it when flags land, not now. Two activities
  sharing `EquationPrompt` needs no machinery at all.
- **PWA install.** Last, because it changes nothing functional and caching bugs are
  the worst class to have in an app a child uses alone.

---

## 9. Decisions taken by the owner

All four open questions are settled. Recorded here so no future agent re-opens them.

1. **The timer and the live score stay exactly as they are.** They were built
   deliberately. Personal bests keep ranking on wall-clock time. Do not remove,
   hide, or "improve" them, and do not cite child-UX research to justify doing so.
2. **The 3–20 target grid stays at its current size and layout.** Verified on her
   actual phone. Restyle only.
3. **Repo and deployment plumbing are untouched.** The GitHub repo stays
   `micogrande/numberbonds` and the app keeps deploying to
   `numberbonds-ten.vercel.app`. Only the local `package.json` name changes to
   `amelia`. Do not touch git remotes or Vercel configuration.
4. **Number Bonds stays as two activities**, since she reads and the labels
   distinguish them. Separate high scores are preserved.
