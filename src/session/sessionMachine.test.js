import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TIMINGS } from '../feedback/motion'
import {
  ACTIONS,
  PHASES,
  currentChoiceCount,
  currentQuestion,
  feedbackVariant,
  gradeAnswer,
  initSession,
  pendingTimeout,
  sessionReducer,
} from './sessionMachine'

/** A deck of cards the reducer knows nothing about beyond `id` and `answer`. */
function buildDeck(size) {
  return Array.from({ length: size }, (_, i) => ({ id: `CARD-${i}`, answer: i + 1 }))
}

/**
 * Dispatch the timeout the state is currently asking for, exactly the way the
 * one `useEffect` will: read the delay and the epoch off `pendingTimeout`, then
 * hand that epoch back. Nothing here is allowed to know the epoch by any other
 * route, because neither will the effect.
 */
function fireTimer(state, { late = 0 } = {}) {
  const pending = pendingTimeout(state)
  if (!pending) throw new Error(`fireTimer(): no timer pending in phase "${state.phase}"`)

  return sessionReducer(state, {
    type: ACTIONS.ADVANCE,
    epoch: pending.epoch,
    at: state.now + pending.delay + late,
  })
}

function submit(state, value) {
  return sessionReducer(state, { type: ACTIONS.SUBMIT, value, at: state.now + 900 })
}

/** Answer the card on screen correctly, then let its success timer run out. */
function answerCorrectly(state) {
  return fireTimer(submit(state, String(currentQuestion(state).answer)))
}

/** Answer wrongly, then let the shake and the reveal both run out. */
function answerWrongly(state) {
  return fireTimer(fireTimer(submit(state, 'ratatouille')))
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── the headline test ──────────────────────────────────────────────────────
//
// PLAN 6: "sessionMachine.js (the headline test: dispatch 18 correct answers,
// assert the recorded score is 18 — this is the permanent guard against the
// stale-closure bug class)."
//
// PLAN 5, critical, useGame.js:74: the score reaching `saveScore` came from a
// closure captured before the last `setScore`, so the summary showed "11 / 11"
// directly above "Previous Best: 10" and 11 could never be stored. If this
// describe block ever goes red, that bug is back.
describe('a session that is answered perfectly', () => {
  it('reports the full score — every card, including the last one', () => {
    let state = initSession(buildDeck(18), { startedAt: 0 })

    for (let i = 0; i < 18; i++) {
      state = answerCorrectly(state)
    }

    expect(state.phase).toBe(PHASES.COMPLETE)
    expect(state.result.score).toBe(18)
    expect(state.result.total).toBe(18)
  })

  it('reports the same number the play screen was showing', () => {
    let state = initSession(buildDeck(18), { startedAt: 0 })

    for (let i = 0; i < 18; i++) {
      state = answerCorrectly(state)
    }

    // One number, one source. The live score on the play screen and the score
    // that reaches storage are the same field of the same object.
    expect(state.result.score).toBe(state.score)
  })

  // The precise signature of the old bug: it lost exactly one card, the last
  // one graded, so a deck answered entirely wrong except the final card scored
  // zero. That is the case a coarse "18 correct" test can miss.
  it('counts a final card that is the only correct answer of the session', () => {
    let state = initSession(buildDeck(3), { startedAt: 0 })

    state = answerWrongly(state)
    state = answerWrongly(state)
    state = answerCorrectly(state)

    expect(state.phase).toBe(PHASES.COMPLETE)
    expect(state.result.score).toBe(1)
  })

  it('finishes a deck of one', () => {
    let state = answerCorrectly(initSession(buildDeck(1), { startedAt: 0 }))

    expect(state.phase).toBe(PHASES.COMPLETE)
    expect(state.result).toEqual({ score: 1, total: 1, wallMs: 2400, completedAt: 2400 })
  })
})

describe('a wrong answer', () => {
  it('scores nothing and still moves the deck on', () => {
    const start = initSession(buildDeck(4), { startedAt: 0 })

    const shaking = submit(start, 999)
    expect(shaking.phase).toBe(PHASES.SHAKE)
    expect(shaking.score).toBe(0)
    expect(shaking.index).toBe(0)

    const revealing = fireTimer(shaking)
    expect(revealing.phase).toBe(PHASES.REVEAL)
    expect(revealing.index).toBe(0)

    const next = fireTimer(revealing)
    expect(next.phase).toBe(PHASES.ANSWERING)
    expect(next.index).toBe(1)
    expect(next.score).toBe(0)
  })

  it('reveals the correct answer, and only while revealing', () => {
    const start = initSession([{ id: 'BOND-W10-P3-p1', answer: 7 }], { startedAt: 0 })
    expect(start.revealed).toBe(null)

    const shaking = submit(start, 4)
    // Still shaking: her own wrong answer is what is on screen, not the answer.
    expect(shaking.revealed).toBe(null)
    expect(shaking.submitted).toBe(4)

    const revealing = fireTimer(shaking)
    expect(revealing.revealed).toBe(7)

    const done = fireTimer(revealing)
    expect(done.phase).toBe(PHASES.COMPLETE)
    expect(done.revealed).toBe(null)
  })

  it('clears the revealed answer before the next card, so it cannot bleed across', () => {
    let state = initSession(buildDeck(2), { startedAt: 0 })
    state = answerWrongly(state)

    expect(state.index).toBe(1)
    expect(state.revealed).toBe(null)
    expect(state.submitted).toBe(null)
  })

  it('scores a session answered entirely wrong as zero, not as a record', () => {
    let state = initSession(buildDeck(11), { startedAt: 0 })

    for (let i = 0; i < 11; i++) {
      state = answerWrongly(state)
    }

    expect(state.result).toMatchObject({ score: 0, total: 11 })
  })
})

// ─── the epoch gate ─────────────────────────────────────────────────────────
//
// PLAN 5, critical, useGame.js:98: "Answer a card, tap Home within 1.5s, start
// another game — the orphaned callback fires into the new session, showing a
// card from the old deck and silently skipping one."
describe('the epoch gate', () => {
  it('increments on every phase transition', () => {
    const start = initSession(buildDeck(3), { startedAt: 0 })

    const shaking = submit(start, 999)
    expect(shaking.epoch).toBe(start.epoch + 1)

    const revealing = fireTimer(shaking)
    expect(revealing.epoch).toBe(shaking.epoch + 1)

    const next = fireTimer(revealing)
    expect(next.epoch).toBe(revealing.epoch + 1)
  })

  it('ignores a timeout belonging to the card before this one', () => {
    const start = initSession(buildDeck(4), { startedAt: 0 })
    const success = submit(start, 1)

    // The timer that was scheduled for card 1's success phase.
    const orphan = { type: ACTIONS.ADVANCE, epoch: pendingTimeout(success).epoch, at: 1500 }

    // It fires once, legitimately, and card 2 arrives.
    const onCard2 = sessionReducer(success, orphan)
    expect(onCard2.index).toBe(1)

    // She answers card 2 fast, so the machine is in a feedback phase again and
    // a phase check alone would happily let the old callback through — this is
    // the "silently skipping one" half of the bug, and only the epoch stops it.
    const answering2 = submit(onCard2, 2)
    expect(sessionReducer(answering2, orphan)).toBe(answering2)
  })

  it('ignores a timeout left over from a session she walked out of', () => {
    const abandonedSession = submit(initSession(buildDeck(11), { startedAt: 0 }), 1)
    const orphan = { type: ACTIONS.ADVANCE, epoch: pendingTimeout(abandonedSession).epoch, at: 1500 }

    // "Answer a card, tap Home within 1.5s, start another game" (PLAN 5).
    const fresh = sessionReducer(abandonedSession, {
      type: ACTIONS.START,
      deck: buildDeck(18),
      at: 9_000,
    })
    expect(fresh.index).toBe(0)
    expect(fresh.score).toBe(0)

    // The old callback lands after she has answered the first card of the new
    // session. Under the old code it advanced this deck, showing a card from
    // the old one and skipping a card of this one.
    const inPlay = submit(fresh, 1)
    expect(sessionReducer(inPlay, orphan)).toBe(inPlay)
  })

  it('never reissues an epoch a previous session already handed out', () => {
    let state = initSession(buildDeck(3), { startedAt: 0 })
    state = answerCorrectly(state)
    const before = state.epoch

    const restarted = sessionReducer(state, { type: ACTIONS.START, deck: buildDeck(3), at: 500 })

    expect(restarted.epoch).toBeGreaterThan(before)
  })

  it('drops a stale action of any kind, not just a timeout', () => {
    const state = initSession(buildDeck(3), { startedAt: 0 })
    const stale = { type: ACTIONS.SUBMIT, value: 1, epoch: state.epoch - 1, at: 100 }

    expect(sessionReducer(state, stale)).toBe(state)
  })
})

describe('input during feedback', () => {
  it.each([
    ['success', (s) => submit(s, 1)],
    ['shake', (s) => submit(s, 999)],
    ['reveal', (s) => fireTimer(submit(s, 999))],
  ])('is ignored while %s is playing', (_phase, reach) => {
    const state = reach(initSession(buildDeck(4), { startedAt: 0 }))

    // She keeps tapping — a six-year-old absolutely does — and none of it lands.
    const after = submit(submit(state, 2), 2)

    expect(after.score).toBe(state.score)
    expect(after.index).toBe(state.index)
    expect(after.phase).toBe(state.phase)
    expect(after.epoch).toBe(state.epoch)
  })

  it('is ignored once the session is over', () => {
    const done = answerCorrectly(initSession(buildDeck(1), { startedAt: 0 }))

    expect(sessionReducer(done, { type: ACTIONS.SUBMIT, value: 1, at: 5_000 })).toBe(done)
  })
})

// PLAN 5, low: "silent no-op on empty ENTER". Pressing the big green button
// with an empty box does literally nothing today — no sound, no movement, no
// reason — so she presses it again, harder.
describe('an empty submission', () => {
  it.each([['empty string', ''], ['spaces', '   '], ['null', null], ['undefined', undefined]])(
    'nudges rather than doing nothing at all (%s)',
    (_label, value) => {
      const state = initSession(buildDeck(4), { startedAt: 0 })
      const after = submit(state, value)

      expect(after).not.toBe(state)
      expect(after.nudge).toBe(state.nudge + 1)
      expect(after.phase).toBe(PHASES.ANSWERING)
      expect(after.score).toBe(0)
      expect(after.index).toBe(0)
      expect(after.submitted).toBe(null)
    }
  )

  it('counts up, so a second empty ENTER can replay the animation', () => {
    let state = initSession(buildDeck(4), { startedAt: 0 })
    state = submit(state, '')
    state = submit(state, '')

    expect(state.nudge).toBe(2)
  })

  it('does not move the epoch — nothing was scheduled, nothing needs cancelling', () => {
    const state = initSession(buildDeck(4), { startedAt: 0 })
    const after = submit(state, '')

    expect(after.epoch).toBe(state.epoch)
    expect(pendingTimeout(after)).toBe(null)
  })

  it('leaves the card fully answerable afterwards', () => {
    let state = initSession(buildDeck(4), { startedAt: 0 })
    state = submit(state, '')
    state = submit(state, '1')

    expect(state.phase).toBe(PHASES.SUCCESS)
    expect(state.score).toBe(1)
  })

  it('treats a zero as a real answer, because it is one', () => {
    // 0 + 10 = 10 is a genuine number bond card. Anything that leans on
    // falsiness eats it.
    const state = initSession([{ id: 'BOND-W10-P0', answer: 0 }], { startedAt: 0 })
    const after = submit(state, '0')

    expect(after.nudge).toBe(0)
    expect(after.phase).toBe(PHASES.SUCCESS)
    expect(after.score).toBe(1)
  })
})

describe('grading', () => {
  it('accepts the keypad string for a numeric answer', () => {
    expect(gradeAnswer({ answer: 7 }, '7')).toBe(true)
    expect(gradeAnswer({ answer: 7 }, 7)).toBe(true)
    expect(gradeAnswer({ answer: 7 }, '07')).toBe(true)
    expect(gradeAnswer({ answer: 7 }, '8')).toBe(false)
  })

  it('refuses junk instead of throwing or accepting it', () => {
    expect(gradeAnswer({ answer: 7 }, 'seven')).toBe(false)
    expect(gradeAnswer({ answer: 7 }, '')).toBe(false)
  })

  it('compares non-numeric answers as text, for a choice id or a clock reading', () => {
    expect(gradeAnswer({ answer: 'ES' }, 'ES')).toBe(true)
    expect(gradeAnswer({ answer: 'ES' }, 'PT')).toBe(false)
    expect(gradeAnswer({ answer: '07:15' }, '07:15')).toBe(true)
  })
})

// PLAN 2.3: "exactly one setTimeout owned by one useEffect". The reducer holds
// no timings; this selector is where the pacing lives, and PLAN 2.3 pins the
// numbers so all four activities feel identical.
describe('pendingTimeout', () => {
  it('holds a correct card for 1500ms', () => {
    const success = submit(initSession(buildDeck(4), { startedAt: 0 }), 1)
    expect(pendingTimeout(success).delay).toBe(1500)
  })

  it('shakes for 500ms, then sits on the answer until 2500ms have passed', () => {
    const shaking = submit(initSession(buildDeck(4), { startedAt: 0 }), 999)
    expect(pendingTimeout(shaking).delay).toBe(500)

    const revealing = fireTimer(shaking)
    expect(pendingTimeout(revealing).delay).toBe(2000)

    // The total a wrong card costs is the number the old two-timer code used.
    expect(pendingTimeout(shaking).delay + pendingTimeout(revealing).delay).toBe(
      DEFAULT_TIMINGS.reveal
    )
  })

  it('asks for no timer while she is thinking, or once it is over', () => {
    const answering = initSession(buildDeck(4), { startedAt: 0 })
    expect(pendingTimeout(answering)).toBe(null)

    const done = answerCorrectly(initSession(buildDeck(1), { startedAt: 0 }))
    expect(pendingTimeout(done)).toBe(null)

    const abandoned = sessionReducer(answering, { type: ACTIONS.ABANDON, at: 100 })
    expect(pendingTimeout(abandoned)).toBe(null)
  })

  it('hands back the epoch to dispatch with', () => {
    const success = submit(initSession(buildDeck(4), { startedAt: 0 }), 1)
    expect(pendingTimeout(success).epoch).toBe(success.epoch)
  })
})

describe('the clock', () => {
  it('measures wall time from the start of the session to the last action', () => {
    let state = initSession(buildDeck(2), { startedAt: 1_000 })
    state = answerCorrectly(state)
    state = answerCorrectly(state)

    // Two cards: 900ms of thinking plus a 1500ms hold, twice.
    expect(state.result.wallMs).toBe(4_800)
    expect(state.result.completedAt).toBe(5_800)
  })

  it('never runs backwards when the device clock jumps', () => {
    const state = initSession(buildDeck(1), { startedAt: 1_000 })
    const graded = sessionReducer(state, { type: ACTIONS.SUBMIT, value: 1, at: 500 })

    // A midnight clock correction must not mint an impossible record.
    expect(graded.now).toBe(1_000)
    expect(fireTimer(graded).result.wallMs).toBeGreaterThanOrEqual(0)
  })
})

// PLAN 2.5: "Back mid-game abandons the session and is never scored."
describe('abandoning', () => {
  it('never produces a result', () => {
    let state = initSession(buildDeck(11), { startedAt: 0 })
    state = answerCorrectly(state)
    state = answerCorrectly(state)

    const gone = sessionReducer(state, { type: ACTIONS.ABANDON, at: 6_000 })

    expect(gone.phase).toBe(PHASES.ABANDONED)
    expect(gone.result).toBe(null)
    expect(currentQuestion(gone)).toBe(null)
  })

  it('invalidates whatever timer was in flight', () => {
    const success = submit(initSession(buildDeck(11), { startedAt: 0 }), 1)
    const orphan = { type: ACTIONS.ADVANCE, epoch: pendingTimeout(success).epoch, at: 1_500 }

    const gone = sessionReducer(success, { type: ACTIONS.ABANDON, at: 1_000 })

    expect(sessionReducer(gone, orphan)).toBe(gone)
  })

  it('leaves a finished session alone — she is reading the summary', () => {
    const done = answerCorrectly(initSession(buildDeck(1), { startedAt: 0 }))

    expect(sessionReducer(done, { type: ACTIONS.ABANDON, at: 9_000 })).toBe(done)
  })
})

describe('the session state', () => {
  it('refuses a deck it cannot run', () => {
    expect(() => initSession([])).toThrow(TypeError)
    expect(() => initSession(undefined)).toThrow(TypeError)
    expect(() => initSession(null)).toThrow(TypeError)
    expect(() => initSession('BOND')).toThrow(TypeError)
  })

  it('exposes the card on screen, and nothing once the deck is spent', () => {
    const state = initSession(buildDeck(2), { startedAt: 0 })

    expect(currentQuestion(state).id).toBe('CARD-0')
    expect(currentQuestion(answerCorrectly(state)).id).toBe('CARD-1')
    expect(currentQuestion(answerCorrectly(answerCorrectly(state)))).toBe(null)
  })

  it('exposes how many choices a card offers, or null for a typed answer', () => {
    const choice = initSession(
      [{ id: 'ROM-40', answer: 40, choices: [{ id: 41 }, { id: 60 }, { id: 40 }, { id: 39 }] }],
      { startedAt: 0 }
    )
    expect(currentChoiceCount(choice)).toBe(4)

    expect(currentChoiceCount(initSession(buildDeck(1), { startedAt: 0 }))).toBe(null)
  })

  it('stays on the last card when it completes, so no header can read 19 / 18', () => {
    let state = initSession(buildDeck(18), { startedAt: 0 })
    for (let i = 0; i < 18; i++) state = answerCorrectly(state)

    expect(state.index).toBe(17)
  })

  it('never mutates the state it was handed', () => {
    const state = initSession(buildDeck(4), { startedAt: 0 })
    const snapshot = JSON.stringify(state)

    submit(state, '1')
    submit(state, '999')
    sessionReducer(state, { type: ACTIONS.ABANDON, at: 10 })

    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('ignores an action it does not recognise', () => {
    const state = initSession(buildDeck(4), { startedAt: 0 })

    expect(sessionReducer(state, { type: 'DANCE' })).toBe(state)
    expect(sessionReducer(state, undefined)).toBe(state)
    expect(sessionReducer(state, {})).toBe(state)
  })
})

describe('feedbackVariant', () => {
  // The names are motion.js's `shakeVariants` keys. They are the vocabulary the
  // screens already speak, which is what lets the hook's return shape survive
  // having its insides replaced.
  it('names each phase the way the motion variants do', () => {
    expect(feedbackVariant(PHASES.ANSWERING)).toBe('idle')
    expect(feedbackVariant(PHASES.SUCCESS)).toBe('success')
    expect(feedbackVariant(PHASES.SHAKE)).toBe('error')
    expect(feedbackVariant(PHASES.REVEAL)).toBe('correction')
    expect(feedbackVariant(PHASES.COMPLETE)).toBe('idle')
    expect(feedbackVariant(PHASES.ABANDONED)).toBe('idle')
  })
})

// ─── the contract, checked structurally ─────────────────────────────────────
//
// PLAN 2.1: "The session reducer touches only `id`, `answer`, and
// `choices.length`. Everything else is opaque to it. That is why this
// generalises." These are the tests that will fail the day somebody teaches the
// loop what a number bond is.
describe('what the reducer is allowed to know', () => {
  it('never reads anything off a card but id, answer and choices', () => {
    const forbidden = ['kind', 'prompt', 'meta', 'whole', 'parts', 'missing', 'missingIndex']

    const card = (i) => {
      const q = { id: `CARD-${i}`, answer: i + 1 }
      for (const key of forbidden) {
        Object.defineProperty(q, key, {
          enumerable: true,
          get() {
            throw new Error(`the session read question.${key}`)
          },
        })
      }
      return q
    }

    let state = initSession([card(0), card(1), card(2)], { startedAt: 0 })
    state = submit(state, '1')
    state = fireTimer(state)
    state = answerWrongly(state)
    state = fireTimer(fireTimer(submit(state, 'nope')))

    expect(state.result.score).toBe(1)
  })

  it('reads no clock and no randomness of its own', () => {
    // PLAN 6 does this to the engines; the same rule is what makes the session
    // replayable in a test at all.
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('the session called Math.random')
    })
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('the session called Date.now')
    })

    let state = initSession(buildDeck(3), { startedAt: 0 })
    state = answerCorrectly(state)
    state = answerWrongly(state)
    state = answerCorrectly(state)

    expect(state.result.score).toBe(2)
  })

  it('imports nothing but the shared timings — no React, no engine', () => {
    const source = readFileSync(new URL('./sessionMachine.js', import.meta.url), 'utf8')
    const imports = [...source.matchAll(/^\s*import[^\n]*?from\s+'([^']+)'/gm)].map((m) => m[1])

    expect(imports).toEqual(['../feedback/motion'])
  })
})
