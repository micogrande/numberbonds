/**
 * The activity contract. (PLAN 2.1, PLAN 2.2)
 *
 * An activity is three artefacts and nothing else: a **manifest** (pure
 * serialisable data — identity, options, input mode, `load()`), an **engine**
 * (`generate(params, rng) => Question[]`, pure, no React) and a **prompt
 * renderer** (a React component that reads `question.prompt` and nothing else).
 *
 * This file describes the manifest and the cards its engine deals, and validates
 * both. It is the reason "adding European flags later = one folder + one import
 * line" is true rather than aspirational, and it is the reason nothing in
 * `app/`, `session/`, `input/`, `storage/` or `screens/` ever names an activity.
 */

/**
 * ── THE CARD ────────────────────────────────────────────────────────────────
 *
 * PLAN 2.1, written down here because this is the file an activity author
 * reads. The session reducer touches only `id`, `answer` and `choices.length`
 * (see the narrower `SessionQuestion` in `session/sessionMachine.js`, which is
 * that subset and deliberately nothing more). Everything else is opaque to it.
 * That is why this generalises — the loop is not "a number bond loop that also
 * does other things", it is a deck-of-graded-cards loop.
 *
 * @typedef {Object} Question
 * @property {string} id       Unique within a deck. Used as the React key, so each
 *                             card genuinely remounts (fixes the entrance animation
 *                             that used to play only on card 1 of a session).
 * @property {string} kind     Render family: 'BOND' | 'EQUATION' | 'GLYPH' | 'ART'.
 *                             Lets ADD and SUB share one EquationPrompt. Read by
 *                             tests and aria only — NOTHING may dispatch behaviour
 *                             on it. If it ever grows a switch, delete it instead.
 * @property {Object} prompt   ENGINE-SPECIFIC. Only that kind's renderer reads it.
 * @property {string|number} answer   Graded value. A primitive comparable with ===
 *                             (see `gradeAnswer` in session/sessionMachine.js).
 * @property {Choice[]} [choices]  Present iff inputMode === 'choice'. Order is final;
 *                             the engine has already placed the correct answer.
 * @property {Object} [meta]   Difficulty tags. Read by TESTS only. Never rendered.
 */

/**
 * @typedef {Object} Choice
 * @property {string|number} id   Graded against question.answer.
 * @property {string} label       Always present — doubles as the aria-label.
 * @property {Object} [art]       Optional picture ALONGSIDE the label. Opaque data
 *                                (`{ kind:'flag', code:'ES' }`); the component that
 *                                draws it is supplied by the activity through
 *                                `inputConfig.Art` — see `input/ChoiceInput.jsx`.
 *                                PLAN 8 defers the shared `Art.jsx` dispatch table
 *                                until flags actually land. Do not build it now.
 */

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
 * @property {string} [defaultOptionId]  Which option the picker opens on before she
 *                                has chosen one. Defaults to the first. See the note
 *                                on it in `defineActivity` below.
 * @property {'grid'|'list'} optionPicker
 * @property {'keypad'|'choice'} inputMode
 * @property {KeypadConfig|ChoiceConfig} inputConfig
 * @property {() => Promise<ActivityModule>} load   Memoised dynamic import.
 */

/**
 * @typedef {Object} ActivityOption
 * @property {string} id        ^[a-z0-9-]+$, STABLE FOREVER — other half of the key.
 * @property {string} label     The full sentence. The start button reads it, and it
 *                              is the aria-label of every chip in the picker.
 * @property {string} short     What fits on the button face: "10", "X".
 * @property {string} [caption] The second line, UNDER `short`, for `optionPicker:
 *                              'list'` — PLAN 3.7's roman chips are "X, L, C with
 *                              'up to 10 / 50 / 100' beneath". Omit it and a list
 *                              row is just its label, exactly as before.
 *                              The 3–20 grid NEVER renders it: those are 50px
 *                              buttons and their size is an owner decision
 *                              (PLAN 9.2), so a grid manifest that sets a caption
 *                              is rejected rather than silently ignored.
 * @property {Object} params    OPAQUE to everything except this activity's engine.
 * @property {number} deckSize  Asserted in dev against what the engine actually
 *                              returns. This is what keeps personal bests honest.
 */

/**
 * What `load()` resolves to: the other two artefacts, and nothing else.
 *
 * @typedef {Object} ActivityModule
 * @property {(params: Object, rng: () => number) => Question[]} generate  Pure, `rng` last.
 * @property {Function} Prompt  The renderer. Mounted with exactly
 *                              `{ question, userInput, feedback, nudge }` — see the
 *                              contract at the top of `screens/PlayScreen.jsx`.
 *
 * >>> THERE IS NO `grade`. PLAN 2.4 reserves an activity-supplied
 * >>> `grade(question, value)` for an answer that is not a comparable primitive,
 * >>> and the seam is real — it is `gradeAnswer` in `session/sessionMachine.js`.
 * >>> It is not injectable, and this contract no longer pretends otherwise: a
 * >>> module that exported `grade` was accepted, validated, and then silently
 * >>> graded by `===` anyway, which is the quietest possible way to lose a high
 * >>> score. `assertActivityModule` now refuses one and says what to wire.
 * >>>
 * >>> Every answer in every activity PLAN specifies is a primitive, including the
 * >>> roman numerals and the clock's canonical '07:15'. The case that needs the
 * >>> hook is the composite `{h,m}` of a drag-the-hands clock, which PLAN 2.1
 * >>> states plainly is a third input mode and does need new machinery.
 */

/**
 * **What the contract deliberately does NOT include** — copied verbatim from
 * PLAN 2.2, because it is the fence that stops the manifest growing a hook per
 * activity:
 *
 * > No per-activity `validate()`. No lifecycle hooks (`onStart`, `onCorrect`). No
 * > async `generate`. No CSS contract. An activity that needs one of these is
 * > telling you the abstraction is wrong — fix the abstraction, do not add a hook.
 *
 * Three rules make this a contract rather than a convention (PLAN 2.2):
 *
 *   1. `id` + `option.id` + `version` form the high-score key. Append-only.
 *      Rename the *label* freely; never the id.
 *   2. `option.params` is opaque to everything except that activity's `generate`.
 *      The day shared code reads `params.max`, the contract has leaked.
 *   3. `generate` must be pure and take `rng` last. This single rule is what
 *      makes the entire content layer testable.
 */

import { INPUT_MODES, inputModes, isInputMode } from '../input/inputRegistry'
// The one grader in the app. Imported rather than restated so that "exactly one
// button is correct" is checked with the comparison the session will actually
// make — a second copy of the rule is how a card passes validation and is then
// unanswerable on her phone.
import { gradeAnswer } from '../session/sessionMachine'

/** Uppercase snake, and `::` is impossible inside it, so a score key can be split. */
const ID_PATTERN = /^[A-Z][A-Z0-9_]*$/
/** Kebab-case: a URL segment that needs no escaping and reads as words. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** PLAN 2.2: option ids are `^[a-z0-9-]+$`. */
const OPTION_ID_PATTERN = /^[a-z0-9-]+$/

const OPTION_PICKERS = ['grid', 'list']

/**
 * Dev only. Everything below this line is stripped from the production bundle by
 * the constant folding on `import.meta.env.DEV`, which is what lets the
 * assertions be as chatty as they like.
 */
const DEV = import.meta.env.DEV === true

/**
 * Which file called `defineActivity`, for the message.
 *
 * PLAN 2.2 asks these assertions to "fail at import time pointing at the
 * offending file", and a manifest has no idea what file it lives in. The stack
 * does. Everything here is best-effort and wrapped: a missing file name makes
 * the message slightly worse, never the failure worse.
 *
 * @returns {string|null}
 */
function offendingFile() {
  try {
    const stack = new Error().stack
    if (typeof stack !== 'string') return null

    for (const frame of stack.split('\n').slice(1)) {
      if (frame.includes('manifestSchema')) continue
      const match = frame.match(/([^\s(@]+\.(?:jsx?|tsx?|mjs))/)
      if (match) return match[1].replace(/\?.*$/, '')
    }
  } catch {
    // A stack is a courtesy, not an API.
  }

  return null
}

/**
 * @param {string[]} problems
 * @param {ActivityManifest} manifest
 */
function reject(problems, manifest) {
  const where = offendingFile()
  const named = typeof manifest?.id === 'string' ? manifest.id : '(no id)'

  throw new TypeError(
    `defineActivity(${named}) — invalid manifest` +
      (where === null ? '' : ` in ${where}`) +
      `:\n  - ${problems.join('\n  - ')}\n` +
      `See PLAN 2.2 and the typedefs in activities/manifestSchema.js.`
  )
}

/**
 * @param {ActivityOption} option
 * @param {number} index
 * @returns {string[]}
 */
function optionProblems(option, index) {
  const at = `options[${index}]`
  const problems = []

  if (option === null || typeof option !== 'object') {
    return [`${at} must be an object, got ${String(option)}`]
  }

  if (typeof option.id !== 'string' || !OPTION_ID_PATTERN.test(option.id)) {
    // This is half the high-score key and it is stable forever, so a typo here
    // is not a typo — it is a personal best she can never reach again.
    problems.push(`${at}.id must match ${OPTION_ID_PATTERN} (stable forever), got ${JSON.stringify(option.id)}`)
  }

  if (typeof option.label !== 'string' || option.label.trim() === '') {
    problems.push(`${at}.label must be a non-empty string — she reads it`)
  }

  if (typeof option.short !== 'string' || option.short.trim() === '') {
    problems.push(`${at}.short must be a non-empty string`)
  }

  if (option.caption !== undefined && (typeof option.caption !== 'string' || option.caption.trim() === '')) {
    problems.push(`${at}.caption, when given, must be a non-empty string — it is the line under ${JSON.stringify(option.short)}`)
  }

  if (option.params === null || typeof option.params !== 'object') {
    problems.push(`${at}.params must be an object (opaque to everything but this activity's generate)`)
  }

  if (!Number.isInteger(option.deckSize) || option.deckSize < 1) {
    problems.push(`${at}.deckSize must be a positive integer — it is what keeps personal bests honest`)
  }

  return problems
}

/**
 * @param {ActivityManifest} manifest
 * @returns {string[]}
 */
function manifestProblems(manifest) {
  if (manifest === null || typeof manifest !== 'object') {
    return [`a manifest must be an object, got ${String(manifest)}`]
  }

  const problems = []

  if (typeof manifest.id !== 'string' || !ID_PATTERN.test(manifest.id)) {
    problems.push(`id must match ${ID_PATTERN} (uppercase snake, stable forever), got ${JSON.stringify(manifest.id)}`)
  } else if (manifest.id.includes('::')) {
    // Belt and braces: ID_PATTERN already forbids ':'. `::` is the score-key
    // separator and a key that cannot be split back apart is a silent, forever
    // kind of wrong (PLAN 2.6).
    problems.push(`id must not contain "::" — it is the score-key separator`)
  }

  if (typeof manifest.slug !== 'string' || !SLUG_PATTERN.test(manifest.slug)) {
    problems.push(`slug must match ${SLUG_PATTERN} (it is a URL segment), got ${JSON.stringify(manifest.slug)}`)
  }

  if (typeof manifest.categoryId !== 'string' || manifest.categoryId === '') {
    problems.push(`categoryId must be a non-empty string`)
  }

  if (!Number.isInteger(manifest.version) || manifest.version < 1) {
    problems.push(`version must be a positive integer (the deck-recipe version, half the score key)`)
  }

  for (const field of ['title', 'subtitle']) {
    if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
      problems.push(`${field} must be a non-empty string — Amelia reads it (PLAN §"Who this is for")`)
    }
  }

  if (manifest.accentVar !== undefined && !/^--[a-z0-9-]+$/.test(manifest.accentVar)) {
    problems.push(`accentVar, when given, must be a CSS custom property name like "--color-primary"`)
  }

  if (!Number.isInteger(manifest.order)) {
    problems.push(`order must be an integer — it is the position she navigates by`)
  }

  if (!Array.isArray(manifest.options) || manifest.options.length === 0) {
    problems.push(`options must be a non-empty array`)
  } else {
    const seen = new Set()

    manifest.options.forEach((option, index) => {
      problems.push(...optionProblems(option, index))

      const id = option?.id
      if (typeof id === 'string') {
        if (seen.has(id)) problems.push(`options[${index}].id "${id}" is used twice — two options would share one high score`)
        seen.add(id)
      }
    })
  }

  if (manifest.defaultOptionId !== undefined) {
    const known = Array.isArray(manifest.options) && manifest.options.some((option) => option?.id === manifest.defaultOptionId)
    if (!known) {
      problems.push(`defaultOptionId ${JSON.stringify(manifest.defaultOptionId)} is not one of this activity's option ids`)
    }
  }

  if (!OPTION_PICKERS.includes(manifest.optionPicker)) {
    problems.push(`optionPicker must be one of: ${OPTION_PICKERS.join(', ')}`)
  } else if (manifest.optionPicker === 'grid' && Array.isArray(manifest.options)) {
    // Loud rather than silent. The grid is 50px buttons, six across, and its
    // size and layout are an owner decision confirmed on her actual phone
    // (PLAN 9.2) — a caption cannot be drawn there without resizing it. An
    // activity that wants two lines per option wants `optionPicker: 'list'`.
    const captioned = manifest.options.filter((option) => option?.caption !== undefined).length
    if (captioned > 0) {
      problems.push(
        `optionPicker "grid" cannot render a caption (${captioned} option(s) set one). ` +
          `The grid is 50px buttons and its size is an owner decision (PLAN 9.2). Use optionPicker "list".`
      )
    }
  }

  if (!isInputMode(manifest.inputMode)) {
    // `choice` passes here even before its adapter exists: a manifest declaring
    // it is early, not wrong. `resolveInput` is what throws until step 10.
    problems.push(`inputMode must be one of: ${inputModes().join(', ')}, got ${JSON.stringify(manifest.inputMode)}`)
  }

  if (manifest.inputConfig !== undefined && (manifest.inputConfig === null || typeof manifest.inputConfig !== 'object')) {
    problems.push(`inputConfig, when given, must be an object`)
  }

  if (typeof manifest.load !== 'function') {
    problems.push(`load must be a function returning a Promise of { generate, Prompt }`)
  }

  return problems
}

/**
 * Wrap a manifest: validate it in dev, memoise its `load`, freeze it.
 *
 * **Fails at import time.** A manifest is a module-level constant, so a broken
 * one throws while the module graph is still being built — before a screen
 * renders, before a deck is dealt, and with the offending file in the message.
 * The alternative is a `undefined is not a function` three navigations later,
 * on her phone.
 *
 * The memoisation is not an optimisation. `load()` is called during render (the
 * play host unwraps the promise with React's `use`), so it MUST return the same
 * promise every time or the component suspends forever, re-importing on each
 * attempt.
 *
 * @template {ActivityManifest} T
 * @param {T} manifest
 * @returns {T}
 */
export function defineActivity(manifest) {
  if (DEV) {
    const problems = manifestProblems(manifest)
    if (problems.length > 0) reject(problems, manifest)
  }

  const loader = manifest.load
  let pending = null

  return Object.freeze({
    ...manifest,
    inputConfig: manifest.inputConfig ?? {},
    options: Object.freeze(manifest.options.map((option) => Object.freeze({ ...option }))),
    load: () => (pending ??= Promise.resolve(loader())),
  })
}

/**
 * Cross-activity checks only. (PLAN 2.2: "`validateRegistry()` checks only
 * cross-activity uniqueness (duplicate ids/slugs, unknown categoryId) at boot".)
 *
 * Shape is `defineActivity`'s job and has already happened by the time this
 * runs; what one manifest cannot possibly know is whether another one has taken
 * its id. A duplicate id is the worst of these by a distance: two activities
 * would quietly share one high score.
 *
 * Pure and returns its findings rather than throwing, so it is testable. The
 * registry throws on the result in dev.
 *
 * @param {ActivityManifest[]} activities
 * @param {{ id: string }[]} categories
 * @returns {string[]} empty when the registry is sound
 */
export function validateRegistry(activities, categories) {
  const problems = []

  if (!Array.isArray(activities)) return ['ACTIVITIES must be an array']

  const categoryIds = new Set((categories ?? []).map((category) => category?.id))
  const asleep = new Set((categories ?? []).filter((category) => category?.asleep).map((category) => category.id))

  const ids = new Map()
  const slugs = new Map()

  activities.forEach((activity, index) => {
    const at = activity?.slug ?? `ACTIVITIES[${index}]`

    if (ids.has(activity.id)) {
      problems.push(`duplicate activity id "${activity.id}" (${ids.get(activity.id)} and ${at}) — they would share one high score`)
    }
    ids.set(activity.id, at)

    if (slugs.has(activity.slug)) {
      problems.push(`duplicate slug "${activity.slug}" — one of them is unreachable by URL`)
    }
    slugs.set(activity.slug, at)

    if (!categoryIds.has(activity.categoryId)) {
      problems.push(`${at} names an unknown categoryId "${activity.categoryId}"`)
    } else if (asleep.has(activity.categoryId)) {
      // Not a style rule: a sleeping category has no way in, so this activity
      // exists and cannot be reached. Waking the category is the fix.
      problems.push(`${at} lives in "${activity.categoryId}", which is marked asleep — nothing can reach it`)
    }
  })

  return problems
}

/**
 * Dev-only check that `load()` resolved to the other two artefacts.
 *
 * Called by the play host the moment a module lands. Without it, a manifest
 * whose module forgot to export `Prompt` renders a blank card and blames React.
 *
 * @param {ActivityModule} module
 * @param {ActivityManifest} activity
 */
export function assertActivityModule(module, activity) {
  if (!DEV) return

  const problems = []
  if (typeof module?.generate !== 'function') problems.push('generate must be a function (params, rng) => Question[]')
  if (typeof module?.Prompt !== 'function') problems.push('Prompt must be a React component')

  // Not "grade must be a function" — grade must not be here at all. See the
  // ActivityModule typedef: nothing calls it, so a module exporting one used to
  // be validated and then graded by `===` regardless. Refusing it is the whole
  // fix: an activity author finds out at the first render of the first card
  // instead of finding out from a high score that never rose.
  if (module?.grade !== undefined) {
    problems.push(
      'grade is not part of the ActivityModule contract and NOTHING calls it — this module would be graded ' +
        'by === anyway (PLAN 2.4 reserves the seam; it is `gradeAnswer` in session/sessionMachine.js). ' +
        'If an answer here is genuinely not a comparable primitive, wire the seam: thread grade from the ' +
        'play host into useSession and through the SUBMIT action, then re-add it here. Do not export it silently.'
    )
  }

  if (problems.length > 0) {
    throw new TypeError(
      `${activity?.id ?? 'an activity'}: load() did not resolve to an ActivityModule:\n  - ${problems.join('\n  - ')}`
    )
  }
}

/**
 * Everything wrong with one dealt card. Pure, so it is testable over every deck
 * of every activity at once — see `registry.test.js`.
 *
 * PLAN 2.2 has the manifest asserting its `deckSize` "in dev against what the
 * engine actually returns", and that count was the only thing anybody checked: a
 * deck of eighteen cards with no `id` on any of them, or with the right answer
 * missing from every set of buttons, was a sound deck as far as this app was
 * concerned. The count keeps personal bests honest; this keeps the cards
 * *answerable*.
 *
 * **`kind` is deliberately not enumerated.** PLAN 2.1 lists four families, but
 * checking membership here would mean a fifth activity had to edit this file to
 * exist — which is precisely the acceptance test for steps 10 and 11 ("no file
 * outside `activities/<id>/` has changed"). It is a render family read by tests
 * and aria, and nothing may dispatch on it, so all this file asks is that it is
 * there.
 *
 * @param {Question} question
 * @param {string} inputMode  The activity's `inputMode`. `choices` are "present
 *   iff inputMode === 'choice'" (PLAN 2.1) and this is the only fact needed to
 *   check that — no activity is named, and none can be.
 * @returns {string[]} empty when the card is sound
 */
export function questionProblems(question, inputMode) {
  if (question === null || typeof question !== 'object' || Array.isArray(question)) {
    return [`a card must be an object, got ${String(question)}`]
  }

  const problems = []

  if (typeof question.id !== 'string' || question.id.trim() === '') {
    // The React key. Index keys are what made the entrance animation play on
    // card 1 of a session and never again (PLAN 5, PLAN 2.1).
    problems.push(`id must be a non-empty string — it is the React key that makes each card a genuine remount`)
  }

  if (typeof question.kind !== 'string' || question.kind.trim() === '') {
    problems.push(`kind must be a non-empty render family, e.g. 'BOND' or 'GLYPH' (read by tests and aria only)`)
  }

  if (question.prompt === null || typeof question.prompt !== 'object') {
    problems.push(`prompt must be an object — engine-specific, and only this activity's renderer reads it`)
  }

  if (!isPrimitiveAnswer(question.answer)) {
    problems.push(
      `answer must be a finite number or a string, got ${describe(question.answer)}. It is compared with === ` +
        `(session/sessionMachine.js); an object answer can never match anything she can enter.`
    )
  }

  if (question.meta !== undefined && (question.meta === null || typeof question.meta !== 'object')) {
    problems.push(`meta, when given, must be an object. It is read by TESTS only and is never rendered.`)
  }

  problems.push(...choiceProblems(question, inputMode))

  return problems
}

/** A value `gradeAnswer` can actually compare. @param {unknown} value */
function isPrimitiveAnswer(value) {
  return typeof value === 'number' ? Number.isFinite(value) : typeof value === 'string'
}

/** @param {unknown} value */
function describe(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return typeof value === 'object' ? 'an object' : JSON.stringify(value)
}

/**
 * The buttons, if this card has any.
 *
 * @param {Question} question
 * @param {string} inputMode
 * @returns {string[]}
 */
function choiceProblems(question, inputMode) {
  const wantsChoices = inputMode === INPUT_MODES.CHOICE
  const choices = question.choices

  if (choices === undefined) {
    return wantsChoices
      ? [`choices are missing: this activity's inputMode is "choice", and there is nothing to tap`]
      : []
  }

  const problems = []

  if (!wantsChoices) {
    // "Present iff inputMode === 'choice'" (PLAN 2.1). A keypad deck carrying
    // choices means somebody built a multiple-choice engine and left the
    // manifest on `keypad`: the buttons never render and the card is answerable
    // only by typing the answer she was supposed to pick out of four.
    problems.push(`choices must be absent unless inputMode is "choice" — this activity's is ${JSON.stringify(inputMode)}`)
  }

  if (!Array.isArray(choices) || choices.length < 2) {
    problems.push(`choices must be an array of at least two — one option is not a choice`)
    return problems
  }

  const seen = new Set()
  let correct = 0

  choices.forEach((choice, index) => {
    const at = `choices[${index}]`

    if (choice === null || typeof choice !== 'object') {
      problems.push(`${at} must be an object, got ${describe(choice)}`)
      return
    }

    if (!isPrimitiveAnswer(choice.id)) {
      problems.push(`${at}.id must be a finite number or a string — it is graded against question.answer`)
    } else {
      const key = String(choice.id)
      if (seen.has(key)) problems.push(`${at}.id ${JSON.stringify(choice.id)} appears twice — two buttons grade alike`)
      seen.add(key)
    }

    if (typeof choice.label !== 'string' || choice.label.trim() === '') {
      problems.push(`${at}.label must be a non-empty string — she reads it, and it doubles as the aria-label`)
    }

    if (gradeAnswer(question, choice.id)) correct += 1
  })

  if (correct !== 1) {
    // The worst bug this file can catch. Zero means the card is unanswerable —
    // she taps all four, gets all four wrong, and no amount of thinking helps.
    // Two means the deck grades one of two identical-looking taps as wrong.
    problems.push(
      `exactly one choice must grade as correct against answer ${JSON.stringify(question.answer)}, found ${correct}` +
        (correct === 0 ? ' — the right answer is not on any button' : ' — two buttons are both right')
    )
  }

  return problems
}

/**
 * Dev-only. Throws on the card about to be rendered.
 *
 * Called by the play screen for each card as it mounts, which is the last moment
 * anything can see a card before a six-year-old does. `registry.test.js` runs
 * the same check over every card of every deck of every activity, so the usual
 * way to meet this message is a failing test rather than a broken screen; this
 * is the backstop for a deck that only misbehaves under a real, unseeded rng.
 *
 * @param {Question} question
 * @param {string} inputMode
 */
export function assertQuestion(question, inputMode) {
  if (!DEV) return

  const problems = questionProblems(question, inputMode)
  if (problems.length === 0) return

  const named = typeof question?.id === 'string' ? ` "${question.id}"` : ''

  throw new TypeError(
    `a dealt card${named} is not a Question (PLAN 2.1):\n  - ${problems.join('\n  - ')}\n` +
      `See the Question typedef in activities/manifestSchema.js.`
  )
}
