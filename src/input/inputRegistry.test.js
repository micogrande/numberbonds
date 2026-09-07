import { describe, expect, it } from 'vitest'
import { INPUT_MODES, inputModes, isInputMode, resolveInput } from './inputRegistry'
import ChoiceInput from './ChoiceInput'
import KeypadInput from './KeypadInput'

describe('the registry', () => {
  it('has exactly two modes, and they are the two PLAN 2.4 names', () => {
    // Two, not three. A third entry means somebody answered "this activity does
    // not fit" with a new input mode instead of with the seam PLAN 2.4 reserves
    // for it — an activity-supplied grade().
    expect(inputModes()).toEqual(['keypad', 'choice'])
    expect(INPUT_MODES).toEqual({ KEYPAD: 'keypad', CHOICE: 'choice' })
  })

  it('mounts the keypad adapter for keypad', () => {
    expect(resolveInput(INPUT_MODES.KEYPAD).Component).toBe(KeypadInput)
  })

  it('mounts the choice adapter for choice', () => {
    // It used to throw here: `choice` was declared and unbuilt for three steps.
    // A multiple-choice deck quietly rendered with a number pad is unanswerable
    // and looks like a broken app, so the entry threw rather than falling back.
    expect(resolveInput(INPUT_MODES.CHOICE).Component).toBe(ChoiceInput)
  })

  it('knows both modes and nothing else', () => {
    expect(isInputMode(INPUT_MODES.CHOICE)).toBe(true)
    expect(isInputMode('gesture')).toBe(false)
    expect(isInputMode('toString')).toBe(false)
  })

  it('throws on a mode nobody declared, naming the offender', () => {
    expect(() => resolveInput('handwriting')).toThrow(/"handwriting"/)
    expect(() => resolveInput(undefined)).toThrow(/keypad, choice/)
  })
})

describe('the config an adapter is handed', () => {
  it('defaults to the cap the app shipped with', () => {
    // A manifest that says nothing about input must behave exactly as today. A
    // cap that is too small silently makes a correct answer untypeable.
    expect(resolveInput(INPUT_MODES.KEYPAD).config).toEqual({ maxDigits: 3 })
  })

  it('gives choice the 2x2 grid and the empty art seam', () => {
    // PLAN 4.4 is four buttons in two columns. `Art` is null rather than absent
    // so the seam is visible in the default: a picture on a button comes from
    // the activity, never from a table in `input/` (PLAN 8 defers that).
    expect(resolveInput(INPUT_MODES.CHOICE).config).toEqual({ columns: 2, Art: null })
  })

  it('lets an activity override it', () => {
    expect(resolveInput(INPUT_MODES.KEYPAD, { maxDigits: 2 }).config).toEqual({ maxDigits: 2 })
  })

  it('ignores undefined so a half-filled manifest cannot blank a default', () => {
    expect(resolveInput(INPUT_MODES.KEYPAD, { maxDigits: undefined }).config).toEqual({
      maxDigits: 3,
    })
  })

  it('carries an activity key the mode has no default for', () => {
    // `option.params` is opaque and so is inputConfig: the registry merges, it
    // does not validate the shape of somebody else's activity.
    expect(resolveInput(INPUT_MODES.KEYPAD, { maxDigits: 2, allowZero: false }).config).toEqual({
      maxDigits: 2,
      allowZero: false,
    })
  })
})
