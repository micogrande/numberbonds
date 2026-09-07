import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyKey } from '../input/keypadRules'
import { resetMemoryFallback } from '../storage/safeStorage'
import { getBest, recordResult } from '../storage/scores'
import {
  ACTIONS,
  PHASES,
  currentQuestion,
  initSession,
  pendingTimeout,
  sessionReducer,
} from './sessionMachine'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const HOOK_SOURCE = readFileSync(new URL('./useSession.js', import.meta.url), 'utf8')

// ─── the audit ──────────────────────────────────────────────────────────────
//
// PLAN 2.3: "**exactly one** `setTimeout` owned by one `useEffect` and guarded
// by an epoch counter."
//
// THIS TEST FAILS AGAINST THE OLD IMPLEMENTATION. `hooks/useGame.js` scheduled
// three timeouts (500 / 1500 / 2500ms) and threw every handle away, so answering
// a card and tapping Home within 1.5s let the orphan fire into the *next*
// session — a card from the old deck on screen, one from the new deck skipped,
// and on the error path the previous session's answer stamped into the new input
// box. There is nothing to patch here: a timer whose only handle is held by an
// effect cleanup cannot outlive the screen that started it.
//
// If someone adds a second `setTimeout` anywhere in the app, this goes red and
// asks them to put their delay in the session machine instead.
describe('the one timer in the app', () => {
  /** Every shipped source file — tests excluded, they are allowed fake timers. */
  function sourceFiles(dir = SRC) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(full)
      if (!/\.jsx?$/.test(entry.name) || /\.test\.jsx?$/.test(entry.name)) return []
      return [full]
    })
  }

  it('is the only setTimeout in the whole tree', () => {
    const schedulers = {}

    for (const file of sourceFiles()) {
      const found = readFileSync(file, 'utf8').match(/\bsetTimeout\s*\(/g)
      if (found) schedulers[relative(SRC, file).split(sep).join('/')] = found.length
    }

    expect(schedulers).toEqual({ 'session/useSession.js': 1 })
  })

  it('hands its handle to the effect cleanup, which is what makes it uncancellable-by-accident', () => {
    expect(HOOK_SOURCE).toMatch(/return\s*\(\)\s*=>\s*clearTimeout\(id\)/)
  })

  // The dependency array is the fragile part, and it is fragile in a way that is
  // invisible in review: `[state]` looks *more* correct and quietly reschedules
  // the pending advance on every keystroke. This pins it.
  it('depends on the pending delay and epoch, never on the session state', () => {
    expect(HOOK_SOURCE).toMatch(/\}, \[pendingDelay, pendingEpoch[^\]]*\]\)/)
    expect(HOOK_SOURCE).not.toMatch(/\}, \[state\]\)/)
  })
})

// ─── the `at` contract ──────────────────────────────────────────────────────
//
// The reducer never reads a clock, so every action has to bring one. An action
// dispatched without `at` leaves `now` on `startedAt`, and the session records
// `wallMs: 0` — which, since ties break on time, mints a record nothing can ever
// beat and freezes that key forever.
describe('the clock the hook is responsible for', () => {
  it('reaches the reducer through exactly one dispatch, so no action can skip it', () => {
    const calls = HOOK_SOURCE.match(/dispatch\(/g) ?? []
    expect(calls).toHaveLength(1)
    expect(HOOK_SOURCE).toMatch(/dispatch\(\{ \.\.\.action, at: Date\.now\(\) \}\)/)
  })

  it('takes the advancing epoch from pendingTimeout, not from the state at fire time', () => {
    // `state.epoch` has already moved on by the time a stale timer fires; using
    // it would hand the reducer a key that always matches and disarm the gate.
    expect(HOOK_SOURCE).not.toMatch(/epoch:\s*state\.epoch/)
    expect(HOOK_SOURCE).toMatch(/epoch: pendingEpoch/)
  })
})

// ─── a model of the mounted play screen ─────────────────────────────────────
//
// jsdom is deliberately not installed (PLAN 6), so the hook itself cannot be
// rendered here. What this models is the *lifecycle* the hook hands to React:
// one timeout, rescheduled when `[pendingDelay, pendingEpoch]` changes, cleared
// by the cleanup on every re-run and on unmount. Everything it does with the
// session — the reducer, `pendingTimeout`, the epoch, and now the keypad's own
// `applyKey` — is the real module, not a stand-in, and the three structural
// tests above pin the real hook to this wiring.
//
// The half-typed answer is modelled here rather than read off the hook because
// as of step 7 that is where it lives: the draft belongs to the card on the play
// screen and reaches the session only as the value of one SUBMIT (PLAN 2.4).
// `MODEL_MAX_DIGITS` therefore stands in for an activity's `inputConfig`, not
// for anything the session knows.
//
// `leave()` keeps a reference to the timer React just cleared, so a test can
// fire it anyway and prove the epoch gate would have caught it too.
const MODEL_MAX_DIGITS = 2

function mountSession(deck, { at = 0 } = {}) {
  let state = initSession(deck, { startedAt: at })
  let clock = at
  let input = ''
  let mounted = true
  let scheduled = null
  let depDelay = null
  let depEpoch = null

  const syncTimer = () => {
    const pending = mounted ? pendingTimeout(state) : null
    const delay = pending === null ? null : pending.delay
    const epoch = pending === null ? null : pending.epoch

    // React only re-runs the effect when a dependency changes. When it does, the
    // cleanup clears the old handle before the new one is scheduled.
    if (delay === depDelay && epoch === depEpoch) return
    depDelay = delay
    depEpoch = epoch
    scheduled = delay === null ? null : { fireAt: clock + delay, epoch }
  }

  const send = (action) => {
    state = sessionReducer(state, { ...action, at: clock })
    syncTimer()
  }

  syncTimer()

  const api = {
    get state() {
      return state
    },
    get scheduled() {
      return scheduled
    },
    /** What the answer box renders: the revealed answer, else what she has typed. */
    get answerBox() {
      return state.revealed === null ? input : String(state.revealed)
    },
    get card() {
      return currentQuestion(state)
    },

    wait(ms) {
      clock += ms
      return api
    },

    press(key) {
      // The play screen disables the keypad outside `answering`, so a press
      // during feedback never happens; the reducer refuses it too.
      if (state.phase !== PHASES.ANSWERING) return api
      if (key === 'ENTER') send({ type: ACTIONS.SUBMIT, value: input })
      else input = applyKey(input, key, MODEL_MAX_DIGITS)
      return api
    },

    /** The one timeout elapsing. */
    fireTimer() {
      if (scheduled === null) throw new Error('fireTimer(): nothing is scheduled')
      const due = scheduled
      clock = Math.max(clock, due.fireAt)
      input = ''
      send({ type: ACTIONS.ADVANCE, epoch: due.epoch })
      return api
    },

    /** Navigating away: React runs the cleanup, and the screen abandons the session. */
    leave() {
      const orphan = scheduled
      send({ type: ACTIONS.ABANDON })
      mounted = false
      syncTimer()
      scheduled = null
      input = ''
      return orphan
    },

    /** A fresh deck in the same mounted hook — Play Again, or a second game. */
    start(nextDeck) {
      mounted = true
      input = ''
      send({ type: ACTIONS.START, deck: nextDeck })
      return api
    },

    /** Deliver a timeout React had already cancelled. Must be a no-op. */
    deliver(orphan, { after = 0 } = {}) {
      clock += after
      send({ type: ACTIONS.ADVANCE, epoch: orphan.epoch })
      return api
    },
  }

  return api
}

/** A bonds-to-10 shaped deck: 11 cards, answers she can actually type. */
const deckOf = (size, tag = 'CARD') =>
  Array.from({ length: size }, (_, i) => ({ id: `${tag}-${i}`, answer: i }))

/** Type the right answer and let the 1500ms celebration run out. */
const answerCorrectly = (game) => {
  for (const digit of String(game.card.answer)) game.press(digit)
  game.wait(700).press('ENTER')
  return game.fireTimer()
}

function installStorage() {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  }
  return store
}

const BONDS = { id: 'BOND_WHOLE', version: 1 }
const T10 = { id: 't10' }

beforeEach(() => {
  resetMemoryFallback()
  installStorage()
})

afterEach(() => {
  delete globalThis.localStorage
  resetMemoryFallback()
  vi.restoreAllMocks()
})

// (a) PLAN 5, critical, useGame.js:74. The old hook handed `saveScore` a `score`
// captured before the last `setScore`, so the summary showed "11 / 11" directly
// above "Previous Best: 10" and 11 could never be stored. This walks the whole
// path the hook walks — reducer to storage — and insists the number on the
// screen is the number in the store.
describe('a perfect session', () => {
  it('stores exactly the score the summary is showing', () => {
    let game = mountSession(deckOf(11))
    for (let i = 0; i < 11; i++) game = answerCorrectly(game)

    const { result } = game.state
    expect(result.score).toBe(11)

    // The hook spreads `result` straight in; these field names are the contract
    // between the session and storage, and this is where a rename gets caught.
    recordResult(BONDS, T10, {
      score: result.score,
      total: result.total,
      wallMs: result.wallMs,
    })

    const best = getBest(BONDS, T10)
    expect(best.score).toBe(11)
    expect(best.score).toBe(game.state.score)
    expect(best.total).toBe(11)
    expect(best.wallMs).toBeGreaterThan(0)
  })

  it('records a real time, so a first run cannot mint an unbeatable record', () => {
    // Every dispatch carries `at`, or `wallMs` comes out 0 and — ties breaking on
    // time — nothing could ever beat it.
    let game = mountSession(deckOf(4))
    for (let i = 0; i < 4; i++) game = answerCorrectly(game)

    expect(game.state.result.wallMs).toBe(4 * (700 + 1500))
  })
})

// (b) PLAN 5, critical, useGame.js:98.
describe('answering correctly and then leaving inside the 1500ms hold', () => {
  it('takes the pending advance with it', () => {
    const game = mountSession(deckOf(11))
    game.press('0').wait(400).press('ENTER')

    expect(game.scheduled).not.toBe(null)

    game.wait(300)
    const orphan = game.leave()

    expect(orphan).not.toBe(null) // there *was* a live timer
    expect(game.scheduled).toBe(null) // and the cleanup took it
  })

  it('cannot be yanked to a summary by a timer that escapes anyway', () => {
    const game = mountSession(deckOf(1))
    game.press('0').wait(400).press('ENTER')

    // The last card: this advance is the one that ends the session.
    const orphan = game.leave()
    game.deliver(orphan, { after: 1_100 })

    expect(game.state.phase).toBe(PHASES.ABANDONED)
    expect(game.state.result).toBe(null)
  })
})

// (c) The same orphan, arriving after she has started playing again.
describe('a second session started inside the window', () => {
  it('keeps its own deck and its own first card', () => {
    const first = deckOf(11, 'OLD')
    const second = deckOf(18, 'NEW')

    const game = mountSession(first)
    game.press('0').wait(400).press('ENTER')

    const orphan = game.leave()
    game.start(second)
    game.deliver(orphan, { after: 1_100 })

    expect(game.state.deck).toBe(second)
    expect(game.card.id).toBe('NEW-0')
    expect(game.state.index).toBe(0)
    expect(game.state.score).toBe(0)
    expect(game.state.phase).toBe(PHASES.ANSWERING)
  })

  it('does not inherit the answer box of the session she walked out of', () => {
    // The error path used to leave two orphans, one of which wrote the previous
    // session's answer into the input buffer. The revealed answer now lives in
    // the state and is never written to the buffer, so there is nothing to leak.
    const game = mountSession(deckOf(11, 'OLD'))
    game.press('9').wait(400).press('ENTER') // wrong: card OLD-0's answer is 0

    expect(game.answerBox).toBe('9')

    const orphan = game.leave()
    game.start(deckOf(18, 'NEW'))
    game.deliver(orphan, { after: 3_000 })

    expect(game.answerBox).toBe('')
    expect(game.state.revealed).toBe(null)
  })
})

// (d) Nothing about the feel changes. The pacing IS her personal bests.
describe('the pacing she already knows', () => {
  it('holds a correct card for 1500ms', () => {
    const game = mountSession(deckOf(4), { at: 1_000 })
    game.press('0').wait(500).press('ENTER')

    expect(game.scheduled.fireAt).toBe(1_500 + 1_500)
  })

  it('shakes for 500ms, reveals the answer, and moves on at 2500ms', () => {
    const game = mountSession(deckOf(4), { at: 0 })
    game.press('9').press('ENTER')

    expect(game.scheduled.fireAt).toBe(500)
    expect(game.answerBox).toBe('9')

    game.fireTimer()

    expect(game.state.phase).toBe(PHASES.REVEAL)
    expect(game.answerBox).toBe('0') // a bond answer is legitimately zero
    expect(game.scheduled.fireAt).toBe(2_500)

    game.fireTimer()

    expect(game.state.index).toBe(1)
    expect(game.answerBox).toBe('')
  })

  it('clears the box on the new card, in the same step as the advance', () => {
    const game = mountSession(deckOf(4))
    game.press('0').press('ENTER')

    expect(game.answerBox).toBe('0')

    game.fireTimer()

    // Never a frame of the previous answer sitting under the new card.
    expect(game.state.index).toBe(1)
    expect(game.answerBox).toBe('')
  })

  // The cap itself moved to the keypad adapter at step 7 and is covered there,
  // per-activity, in input/KeypadInput.test.js. What still belongs here is that a
  // refused press does not disturb the session.
  it('still refuses a digit past the cap, and the session never sees it', () => {
    const game = mountSession(deckOf(4))
    game.press('1').press('2').press('3')

    expect(game.answerBox).toBe('12')
    expect(game.state.phase).toBe(PHASES.ANSWERING)
    expect(game.state.nudge).toBe(0)
  })

  it('ignores the keypad while it is showing her something', () => {
    const game = mountSession(deckOf(4))
    game.press('9').press('ENTER')
    game.press('1')

    expect(game.answerBox).toBe('9')
  })
})
