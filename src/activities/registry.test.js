import { describe, expect, it, vi } from 'vitest'

import { ACTIVITIES, activitiesInCategory, defaultOption, findOption, getActivityBySlug } from './registry'
import { CATEGORIES, categoriesInOrder } from './categories'
import {
  assertActivityModule,
  defineActivity,
  questionProblems,
  validateRegistry,
} from './manifestSchema'
import { LEGACY_BOND_MODES, legacyBondOption } from '../storage/migrations'
import { scoreKey } from '../storage/scores'
import { mulberry32 } from '../lib/rng'

/**
 * This file is the guard on the two things a wrong registry breaks silently:
 * Amelia's existing high scores, and the deck sizes those scores are out of.
 * Nothing here touches React beyond importing it — a manifest is pure data, an
 * engine is a pure function, and no component is rendered, which is exactly why
 * the node environment is enough (PLAN 6).
 *
 * ── HOW THIS FILE IS ORGANISED, AND WHY IT MATTERS ──────────────────────────
 *
 * It used to quantify Number-Bonds facts over **every** activity: every activity
 * opens on `t10`, every activity has an option for every legacy bonds target,
 * every activity's option shorts are "3".."20", and every option of every
 * activity is dealt by importing the bond engine directly. A third activity
 * broke five assertions in a shared file — one of them by throwing out of an
 * engine that had never heard of it — which would have made "add an activity by
 * adding a folder and one import line" false at the first attempt.
 *
 * So there are two kinds of test below and they are kept apart on purpose:
 *
 *   CONTRACT tests quantify over ACTIVITIES and may only assert things the
 *   manifest contract itself promises. Adding an activity must not touch them.
 *   They reach an engine only through `activity.load()`, which is the same door
 *   the play host uses, so they need no import per activity.
 *
 *   MIGRATION tests are scoped to the activities the bonds migration actually
 *   wrote — found by id from `LEGACY_BOND_MODES` rather than by iterating the
 *   registry. They pin `BOND_WHOLE` / `BOND_PARTS` / `t{n}` / `v1` against
 *   `storage/migrations.js` and they are, if anything, stricter than before:
 *   the option-id scheme is now checked against all eighteen targets in order
 *   rather than spot-checked at three of them. Those ids are real high scores on
 *   a real phone. Do not relax them to make a new activity fit — a new activity
 *   is not in this block at all.
 */

const seeded = () => mulberry32(20260906)

/** For `it.each`, so a failure names the activity rather than an index. */
const eachActivity = ACTIVITIES.map((activity) => [activity.slug, activity])

/** The 3–20 targets the bonds grid has always had (PLAN 9.2, owner decision). */
const BOND_TARGETS = Array.from({ length: 18 }, (_, index) => index + 3)

/**
 * The live activity a legacy bonds mode migrated into, found by the id the
 * migration wrote. Deliberately NOT `getActivityBySlug`: the slug is a URL and
 * may be renamed, the id is half a high-score key and may not.
 */
const bondActivityFor = (mode) => ACTIVITIES.find((activity) => activity.id === LEGACY_BOND_MODES[mode].activity.id)

const eachBondMode = Object.keys(LEGACY_BOND_MODES).map((mode) => [mode, mode])

// ─── contract ────────────────────────────────────────────────────────────────

describe('the registry is sound', () => {
  it('has no duplicate ids, no duplicate slugs and no unknown categories', () => {
    expect(validateRegistry(ACTIVITIES, CATEGORIES)).toEqual([])
  })

  it('resolves every activity by its own slug, and every option by its own id', () => {
    for (const activity of ACTIVITIES) {
      expect(getActivityBySlug(activity.slug)).toBe(activity)

      for (const option of activity.options) {
        expect(findOption(activity, option.id)).toBe(option)
      }
    }
  })

  it('resolves an unknown slug or option to null rather than to something', () => {
    // PLAN 2.5: an unknown activity or option in the URL redirects to `#/`. That
    // only works if a lookup answers "no" instead of answering "the first one".
    expect(getActivityBySlug('flags-of-europe')).toBeNull()
    expect(findOption(ACTIVITIES[0], 'not-an-option')).toBeNull()
    expect(findOption(null, 'anything')).toBeNull()
  })

  it('opens every picker on an option that activity actually has', () => {
    for (const activity of ACTIVITIES) {
      const opened = defaultOption(activity)

      expect(activity.options, `${activity.id} opened on an option it does not have`).toContain(opened)

      if (activity.defaultOptionId !== undefined) {
        expect(opened.id).toBe(activity.defaultOptionId)
      }

      // A remembered choice wins; nonsense falls back rather than throwing.
      const other = activity.options[activity.options.length - 1]
      expect(defaultOption(activity, other.id)).toBe(other)
      expect(defaultOption(activity, 'nonsense')).toBe(opened)
    }
  })
})

describe('the six category slots', () => {
  it('is six, in a fixed order, with numbers pinned first (PLAN 3.3)', () => {
    const inOrder = categoriesInOrder()
    expect(inOrder).toHaveLength(6)
    expect(inOrder[0].id).toBe('numbers')
    expect(inOrder.map((category) => category.order)).toEqual([1, 2, 3, 4, 5, 6])
    expect(new Set(inOrder.map((category) => category.slug)).size).toBe(6)
  })

  it('has exactly one awake category and five asleep', () => {
    expect(CATEGORIES.filter((category) => !category.asleep).map((c) => c.id)).toEqual(['numbers'])
    expect(CATEGORIES.filter((category) => category.asleep)).toHaveLength(5)
  })

  it('files every activity in exactly one category, in `order` order', () => {
    // The screen renders by `order`, because she navigates by spatial memory and
    // the array literal in registry.js is not a promise about position.
    const listed = []

    for (const category of CATEGORIES) {
      const inCategory = activitiesInCategory(category.id)

      for (const activity of inCategory) {
        expect(activity.categoryId).toBe(category.id)
      }

      const orders = inCategory.map((activity) => activity.order)
      expect(orders, `${category.id} is not sorted by order`).toEqual([...orders].sort((a, b) => a - b))

      listed.push(...inCategory)
    }

    expect(listed).toHaveLength(ACTIVITIES.length)
  })
})

describe('every activity deals the deck it advertises', () => {
  // PLAN 2.2: "deckSize — Asserted in dev against what the engine actually
  // returns. This is what keeps personal bests honest." A stored best of 11/11
  // is a lie the moment the recipe deals 12.
  //
  // The engine arrives through `activity.load()` — the manifest's own memoised
  // dynamic import, the same door the play host opens — so this block never
  // imports an engine and a new activity needs no line here.
  it.each(eachActivity)('%s deals what its manifest promises', async (_slug, activity) => {
    const module = await activity.load()

    expect(() => assertActivityModule(module, activity)).not.toThrow()

    for (const option of activity.options) {
      const at = `${activity.id}/${option.id}`
      const deck = module.generate(option.params, seeded())

      expect(deck, at).toHaveLength(option.deckSize)
      expect(new Set(deck.map((card) => card.id)).size, `${at} has duplicate card ids`).toBe(deck.length)

      // Not just the count (PLAN 2.1). A deck of the right length whose cards
      // have no id, or whose right answer is on none of the four buttons, is a
      // deck she cannot play — and the count check has always passed it.
      deck.forEach((card, index) => {
        expect(questionProblems(card, activity.inputMode), `${at} card ${index} (${card?.id})`).toEqual([])
      })
    }
  })

  it.each(eachActivity)('%s deals the same deck twice from the same seed', async (_slug, activity) => {
    // PLAN 2.2 rule 3: "generate must be pure and take rng last. This single rule
    // is what makes the entire content layer testable."
    const module = await activity.load()

    for (const option of activity.options) {
      expect(module.generate(option.params, seeded()), `${activity.id}/${option.id}`).toEqual(
        module.generate(option.params, seeded())
      )
    }
  })

  it.each(eachActivity)('%s never reaches for Math.random', async (_slug, activity) => {
    // PLAN 6: "Engines must not call Math.random directly — tests stub it to
    // throw." The one Math.random in the app is the dealer in `PlayHost.jsx`; an
    // engine that calls its own is unseedable and therefore untestable.
    const module = await activity.load()
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error(`${activity.id} called Math.random — engines take rng last (PLAN 2.2 rule 3)`)
    })

    try {
      for (const option of activity.options) {
        expect(() => module.generate(option.params, seeded())).not.toThrow()
      }
    } finally {
      random.mockRestore()
    }
  })
})

// ─── migration ───────────────────────────────────────────────────────────────

describe('the high-score keys Amelia already has', () => {
  // storage/migrations.js: ">>> When the manifests land at step 8 they MUST use
  // exactly these ids, this option-id scheme and version 1, or every score
  // migrated here becomes unreachable."
  //
  // Scoped to the two activities the migration wrote and derived from the
  // migration itself, so a third activity is not even visible here. Nothing in
  // this block may be loosened.

  it('keeps Number Bonds as two separate activities (PLAN 9.4, owner decision)', () => {
    // Not a style point. They have separate high scores that already exist on
    // her phone; merging them would strand one of the two.
    expect(getActivityBySlug('bonds-to').id).toBe('BOND_WHOLE')
    expect(getActivityBySlug('parts-up-to').id).toBe('BOND_PARTS')
    expect(getActivityBySlug('bonds-to')).not.toBe(getActivityBySlug('parts-up-to'))
  })

  it.each(eachBondMode)('%s still exists, under the id and version the migration wrote', (mode) => {
    const spec = LEGACY_BOND_MODES[mode]
    const activity = bondActivityFor(mode)

    expect(activity, `no activity for legacy mode ${mode}`).toBeDefined()
    expect(activity.id).toBe(spec.activity.id)
    expect(activity.version).toBe(spec.activity.version)
  })

  it.each(eachBondMode)('%s matches the option-id scheme the migration wrote', (mode) => {
    const activity = bondActivityFor(mode)

    // Every one of the eighteen, in order — the old spot-check at 3, 10 and 20
    // would have missed a hole anywhere else in the range.
    expect(activity.options.map((option) => option.id)).toEqual(
      BOND_TARGETS.map((target) => legacyBondOption(target).id)
    )
  })

  it.each(eachBondMode)('%s agrees with the deck sizes the migration reconstructed totals from', (mode) => {
    const spec = LEGACY_BOND_MODES[mode]
    const activity = bondActivityFor(mode)

    for (const option of activity.options) {
      const target = Number.parseInt(option.id.slice(1), 10)
      expect(option.deckSize, `${activity.id}/${option.id}`).toBe(spec.deckSize(target))
    }
  })

  it("still produces PLAN 2.6's worked key", () => {
    const bonds = getActivityBySlug('bonds-to')
    expect(scoreKey(bonds, findOption(bonds, 't10'))).toBe('BOND_WHOLE::t10::v1')
  })

  it('opens on the target the app has always opened on', () => {
    for (const mode of Object.keys(LEGACY_BOND_MODES)) {
      expect(defaultOption(bondActivityFor(mode)).id).toBe('t10')
    }
  })

  it('covers the 3–20 grid the owner confirmed on her phone (PLAN 9.2)', () => {
    for (const mode of Object.keys(LEGACY_BOND_MODES)) {
      const activity = bondActivityFor(mode)

      expect(activity.optionPicker).toBe('grid')
      expect(activity.options.map((option) => option.short)).toEqual(BOND_TARGETS.map(String))
    }
  })
})

// ─── the contract itself ─────────────────────────────────────────────────────

describe('defineActivity refuses a broken manifest at import time', () => {
  const sound = {
    id: 'TEST_ONE',
    slug: 'test-one',
    categoryId: 'numbers',
    version: 1,
    title: 'Test',
    subtitle: 'A test',
    order: 1,
    options: [{ id: 'a1', label: 'A one', short: '1', params: {}, deckSize: 3 }],
    optionPicker: 'grid',
    inputMode: 'keypad',
    inputConfig: {},
    load: async () => ({}),
  }

  it('accepts a sound one', () => {
    expect(() => defineActivity(sound)).not.toThrow()
  })

  it.each([
    ['a lowercase id', { id: 'bond_whole' }],
    ['an id with the score-key separator in it', { id: 'A::B' }],
    ['a slug that is not a URL segment', { slug: 'Test One' }],
    ['version zero', { version: 0 }],
    ['no options', { options: [] }],
    ['an option id with a capital in it', { options: [{ ...sound.options[0], id: 'A1' }] }],
    ['an option with no deck size', { options: [{ ...sound.options[0], deckSize: 0 }] }],
    ['two options sharing an id', { options: [sound.options[0], sound.options[0]] }],
    ['a defaultOptionId that does not exist', { defaultOptionId: 'nope' }],
    ['an unknown input mode', { inputMode: 'shout' }],
    ['an unknown option picker', { optionPicker: 'carousel' }],
    ['no load', { load: undefined }],
    ['no title', { title: '' }],
    ['an empty caption', { optionPicker: 'list', options: [{ ...sound.options[0], caption: '  ' }] }],
  ])('rejects %s', (_label, patch) => {
    expect(() => defineActivity({ ...sound, ...patch })).toThrow(TypeError)
  })

  it('accepts a two-line chip on a list picker (PLAN 3.7)', () => {
    // "three chips reading X, L, C with 'up to 10 / 50 / 100' beneath"
    expect(() =>
      defineActivity({
        ...sound,
        optionPicker: 'list',
        options: [{ id: 'to10', label: 'Roman numerals up to 10', short: 'X', caption: 'up to 10', params: {}, deckSize: 10 }],
      })
    ).not.toThrow()
  })

  it('refuses a caption on the 3–20 grid rather than silently dropping it', () => {
    // The grid is 50px buttons and its size is an owner decision confirmed on her
    // actual phone (PLAN 9.2). A caption cannot be drawn in one without resizing
    // it, so the manifest is wrong rather than the screen.
    expect(() =>
      defineActivity({ ...sound, options: [{ ...sound.options[0], caption: 'up to 10' }] })
    ).toThrow(/optionPicker "grid" cannot render a caption/)
  })

  it('accepts either input mode', () => {
    expect(() => defineActivity({ ...sound, inputMode: 'choice', inputConfig: { columns: 2 } })).not.toThrow()
  })

  it('memoises load, because the play host unwraps that promise during render', () => {
    let calls = 0
    const activity = defineActivity({ ...sound, load: async () => { calls += 1; return {} } })

    const first = activity.load()
    const second = activity.load()

    expect(first).toBe(second)
    expect(calls).toBe(1)
  })
})

describe('assertActivityModule guards what load() resolved to', () => {
  const activity = { id: 'TEST_ONE' }
  const sound = { generate: () => [], Prompt: () => null }

  it('accepts the two artefacts and nothing else', () => {
    expect(() => assertActivityModule(sound, activity)).not.toThrow()
  })

  it('refuses a module that exports grade, because nothing calls it', () => {
    // PLAN 2.4 reserves the seam and `session/sessionMachine.js` holds it, but it
    // is not injectable: a module supplying `grade` used to be validated and then
    // graded by `===` anyway. Silently ignoring a hook an activity author wrote
    // on purpose is how a correct answer gets marked wrong.
    expect(() => assertActivityModule({ ...sound, grade: () => true }, activity)).toThrow(/nothing calls it/i)
  })

  it('refuses a module with no renderer', () => {
    expect(() => assertActivityModule({ generate: () => [] }, activity)).toThrow(/Prompt/)
  })
})

describe('a dealt card is a Question (PLAN 2.1)', () => {
  const typed = { id: 'X-1', kind: 'GLYPH', prompt: { text: 'what?' }, answer: 7 }
  const chosen = {
    ...typed,
    choices: [
      { id: 6, label: '6' },
      { id: 7, label: '7' },
      { id: 8, label: '8' },
      { id: 9, label: '9' },
    ],
  }

  it('accepts a typed card and a multiple-choice card', () => {
    expect(questionProblems(typed, 'keypad')).toEqual([])
    expect(questionProblems(chosen, 'choice')).toEqual([])
  })

  it.each([
    ['no id — the React key that makes a card remount', { ...typed, id: '' }, 'keypad'],
    ['no kind', { ...typed, kind: undefined }, 'keypad'],
    ['a prompt that is not an object', { ...typed, prompt: 'what?' }, 'keypad'],
    ['an answer that === can never match', { ...typed, answer: { h: 7, m: 15 } }, 'keypad'],
    ['meta that is not an object', { ...typed, meta: 'block B' }, 'keypad'],
    ['a choice deck with no choices', typed, 'choice'],
    ['choices on a keypad deck, which nothing would render', chosen, 'keypad'],
    ['one choice, which is not a choice', { ...typed, choices: [{ id: 7, label: '7' }] }, 'choice'],
    ['a choice with no label to read', { ...typed, choices: [{ id: 7 }, { id: 8, label: '8' }] }, 'choice'],
    [
      'the same id on two buttons',
      { ...typed, choices: [{ id: 7, label: '7' }, { id: 7, label: 'seven' }, { id: 8, label: '8' }] },
      'choice',
    ],
  ])('rejects %s', (_label, card, inputMode) => {
    expect(questionProblems(card, inputMode).length).toBeGreaterThan(0)
  })

  it('rejects a card whose right answer is on no button', () => {
    // The worst one. She taps all four, is wrong all four times, and no amount of
    // thinking would have helped.
    const unanswerable = { ...chosen, answer: 42 }
    expect(questionProblems(unanswerable, 'choice').join(' ')).toMatch(/not on any button/)
  })

  it('rejects a card whose answer is on two buttons', () => {
    const ambiguous = { ...typed, choices: [{ id: 7, label: '7' }, { id: '7', label: 'seven' }, { id: 8, label: '8' }] }
    expect(questionProblems(ambiguous, 'choice').join(' ')).toMatch(/two buttons are both right/)
  })

  it('grades a choice id the way the session will', () => {
    // The string '7' on a button and the number 7 as the answer is one correct
    // choice, not zero — because that is what `gradeAnswer` does at run time.
    const stringy = { ...typed, choices: [{ id: '7', label: '7' }, { id: '8', label: '8' }] }
    expect(questionProblems(stringy, 'choice')).toEqual([])
  })
})

describe('validateRegistry catches what one manifest cannot see', () => {
  const make = (patch) => ({
    id: 'ONE',
    slug: 'one',
    categoryId: 'numbers',
    ...patch,
  })

  it('catches a duplicate id', () => {
    const problems = validateRegistry([make({}), make({ slug: 'two' })], CATEGORIES)
    expect(problems.join(' ')).toMatch(/duplicate activity id/)
  })

  it('catches a duplicate slug', () => {
    const problems = validateRegistry([make({}), make({ id: 'TWO' })], CATEGORIES)
    expect(problems.join(' ')).toMatch(/duplicate slug/)
  })

  it('catches an unknown category', () => {
    const problems = validateRegistry([make({ categoryId: 'dinosaurs' })], CATEGORIES)
    expect(problems.join(' ')).toMatch(/unknown categoryId/)
  })

  it('catches an activity filed under a sleeping category, which nothing can reach', () => {
    const problems = validateRegistry([make({ categoryId: 'oceans' })], CATEGORIES)
    expect(problems.join(' ')).toMatch(/asleep/)
  })
})
