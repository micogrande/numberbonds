import { describe, expect, it } from 'vitest'

import { anchorHome, commit, entryIndex, rewindHome } from './history'
import { HOME_HASH } from './routes'

/**
 * A history stack good enough to test against.
 *
 * Two things it models that a naive fake would not, because both are where the
 * real bug lived:
 *
 *   - `go()` is ASYNCHRONOUS. It records the request; `settle()` applies it, the
 *     way `popstate` would. Anything that must be true *before* popstate arrives
 *     is therefore assertable.
 *   - a push TRUNCATES anything ahead of the current entry, like a real stack.
 *
 * `before` is what the tab was showing before the app opened. Going back past
 * entry 0 lands there, which is what "leaving the app" means.
 */
function fakeWindow(initialHash = '') {
  const before = { hash: '(the page she came from)', state: null }
  const entries = [{ hash: initialHash, state: null }]

  let index = 0
  let left = false
  let queued = null

  const history = {
    get state() {
      return entries[index].state
    },
    pushState(state, _title, url) {
      entries.length = index + 1
      entries.push({ hash: url, state })
      index = entries.length - 1
    },
    replaceState(state, _title, url) {
      entries[index] = { hash: url, state }
    },
    go(delta) {
      // Asynchronous in every real browser: the entry does not change until
      // popstate. Nothing here moves until settle().
      queued = (queued ?? 0) + delta
    },
  }

  return {
    history,
    location: {
      get hash() {
        return entries[index].hash
      },
    },

    /** Apply whatever `go()` asked for, as popstate would. */
    settle() {
      if (queued === null) return
      const target = index + queued
      queued = null

      if (target < 0) {
        left = true
        return
      }

      index = Math.min(target, entries.length - 1)
    },

    /** Hardware Back. Returns false when it left the app. */
    back() {
      if (index === 0) {
        left = true
        return false
      }
      index -= 1
      return true
    },

    get hash() {
      return left ? before.hash : entries[index].hash
    },
    get index() {
      return index
    },
    get length() {
      return entries.length
    },
    get leftTheApp() {
      return left
    },
    get pendingGo() {
      return queued
    },
  }
}

/** Home → numbers → number bonds → play → (the summary replaces the game). */
function playThroughASession(win) {
  anchorHome(win, HOME_HASH, null)
  commit(win, '#/c/numbers')
  commit(win, '#/a/bonds-to')
  commit(win, '#/play/bonds-to/t10')
  commit(win, '#/summary/bonds-to/t10', true)
  return win
}

describe('anchoring the session so entry 0 is Home', () => {
  it('stamps the entry she opened the app on', () => {
    const win = fakeWindow('')

    expect(entryIndex(win)).toBe(null)
    expect(anchorHome(win, HOME_HASH, null)).toBe(true)

    expect(win.hash).toBe(HOME_HASH)
    expect(entryIndex(win)).toBe(0)
    expect(win.length).toBe(1)
  })

  it('puts Home underneath a cold load that arrived somewhere else', () => {
    // A refresh mid-session (PLAN 2.5) or a fragment left in the address bar.
    const win = fakeWindow('#/play/bonds-to/t10')
    anchorHome(win, HOME_HASH, '#/play/bonds-to/t10')

    expect(win.hash).toBe('#/play/bonds-to/t10')
    expect(entryIndex(win)).toBe(1)

    // ...so Back from a deep link is Home, not out of the app mid-sentence.
    win.back()
    expect(win.hash).toBe(HOME_HASH)
  })

  it('runs once — StrictMode double-invokes every effect, and a reload keeps state', () => {
    const win = fakeWindow('')

    expect(anchorHome(win, HOME_HASH, null)).toBe(true)
    expect(anchorHome(win, HOME_HASH, null)).toBe(false)
    expect(anchorHome(win, HOME_HASH, '#/c/numbers')).toBe(false)

    expect(win.length).toBe(1)
  })
})

describe('commit', () => {
  it('counts a push deeper and leaves a replace where it is', () => {
    const win = fakeWindow('')
    anchorHome(win, HOME_HASH, null)

    commit(win, '#/c/numbers')
    expect(entryIndex(win)).toBe(1)

    commit(win, '#/a/bonds-to')
    expect(entryIndex(win)).toBe(2)

    // Play → summary is a replace (PLAN 2.5), so Back from a result lands on
    // the option picker rather than inside a game that is already over.
    commit(win, '#/play/bonds-to/t10')
    commit(win, '#/summary/bonds-to/t10', true)
    expect(entryIndex(win)).toBe(3)
    expect(win.hash).toBe('#/summary/bonds-to/t10')
  })
})

describe('the gate: Back on Home leaves the app (PLAN 2.5)', () => {
  // >>> THE REGRESSION TEST. <<<
  //
  // The gate used to push Home on top of the screen she was leaving, so Back
  // from Home walked straight back into it: a finished summary replayed its
  // trophy and its confetti, and a play route dealt a brand-new deck nobody
  // asked for. Both are now *ahead* of her, and Back on Home leaves the app.

  it('lands on Home immediately, before popstate has been anywhere', () => {
    const win = playThroughASession(fakeWindow(''))

    rewindHome(win, HOME_HASH)

    // No waiting for the rewind: the tap has already changed the screen.
    expect(win.hash).toBe(HOME_HASH)
    expect(win.pendingGo).toBe(-3)
  })

  it('leaves nothing behind her but the way out', () => {
    const win = playThroughASession(fakeWindow(''))

    expect(rewindHome(win, HOME_HASH)).toBe(3)
    win.settle()

    expect(win.index).toBe(0)
    expect(win.hash).toBe(HOME_HASH)

    // The whole defect, in one assertion: Back does not re-enter the finished
    // summary, and it does not start a new game. It leaves.
    expect(win.back()).toBe(false)
    expect(win.leftTheApp).toBe(true)
  })

  it('does the same from mid-game, where Back used to deal a fresh deck', () => {
    const win = fakeWindow('')
    anchorHome(win, HOME_HASH, null)
    commit(win, '#/c/numbers')
    commit(win, '#/a/bonds-to')
    commit(win, '#/play/bonds-to/t10')

    rewindHome(win, HOME_HASH)
    win.settle()

    expect(win.hash).toBe(HOME_HASH)
    expect(win.back()).toBe(false)
    expect(win.leftTheApp).toBe(true)
  })

  it('survives the double-tap she will certainly make', () => {
    const win = playThroughASession(fakeWindow(''))

    rewindHome(win, HOME_HASH)
    // Second tap, before popstate has landed. The first replace already set
    // this entry's depth to 0, so there is nothing left to rewind.
    expect(rewindHome(win, HOME_HASH)).toBe(0)

    win.settle()

    expect(win.leftTheApp).toBe(false)
    expect(win.index).toBe(0)
    expect(win.hash).toBe(HOME_HASH)
  })

  it('is a plain replace when she is already at the root', () => {
    const win = fakeWindow('')
    anchorHome(win, HOME_HASH, null)

    expect(rewindHome(win, HOME_HASH)).toBe(0)
    expect(win.pendingGo).toBe(null)
    expect(win.hash).toBe(HOME_HASH)
    expect(win.back()).toBe(false)
  })

  it('goes home from a cold deep link too, not back to where it dropped her', () => {
    // Without the anchor this is the case that breaks: entry 0 would be the
    // play route, and rewinding would land her on the option picker.
    const win = fakeWindow('#/play/bonds-to/t10')
    anchorHome(win, HOME_HASH, '#/play/bonds-to/t10')
    commit(win, '#/a/bonds-to', true)
    commit(win, '#/play/bonds-to/t10')

    rewindHome(win, HOME_HASH)
    win.settle()

    expect(win.hash).toBe(HOME_HASH)
    expect(win.back()).toBe(false)
  })
})

describe('nothing here throws without a usable history', () => {
  it('no-ops rather than exploding', () => {
    for (const win of [undefined, {}, { history: null }, { history: {} }]) {
      expect(entryIndex(win)).toBe(null)
      expect(() => anchorHome(win, HOME_HASH, null)).not.toThrow()
      expect(() => commit(win, '#/c/numbers')).not.toThrow()
      expect(rewindHome(win, HOME_HASH)).toBe(0)
    }
  })
})
