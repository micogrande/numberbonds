/**
 * The tab's history stack. (PLAN 2.5)
 *
 * `routes.js` is pure and never touches `window`; `useHashRoute` connects a hash
 * to React state. This is the third piece and the smallest: the few lines that
 * decide what pressing hardware **Back** does. Every function here takes the
 * window it should act on, so the whole file is testable in the node
 * environment (PLAN 6) against a fake stack — no jsdom, no DOM at all.
 *
 * ── THE INVARIANT ───────────────────────────────────────────────────────────
 *
 * **Entry 0 of this app's history is Home, and every entry we create carries its
 * own index.** Given those two things the app always knows how deep it is, and
 * the gate can rewind exactly that far instead of pushing yet another entry.
 *
 * That is what makes PLAN 2.5 true: *"Back on Home is not trapped. Leaving the
 * app is correct behaviour."*
 *
 * The bug this replaces: the gate used to PUSH Home on top of wherever she was,
 * so Back from Home walked *into* the screen she had just left. From a finished
 * game that meant the summary again — trophy and two hundred particles of
 * confetti replayed for a session that ended a minute ago. From mid-game it
 * meant the play route again, which deals a brand-new deck: a six-year-old
 * pressing Back to put the phone down was handed another game instead.
 *
 * ── WHY THE CURRENT ENTRY IS REWRITTEN BEFORE THE REWIND ────────────────────
 *
 * `history.go()` is asynchronous — `popstate` arrives a tick or more later. So
 * `rewindHome` first REPLACES the entry she is standing on with Home, which is
 * synchronous and moves the screen immediately (no ~100ms dead tap, PLAN 3.4),
 * and only then rewinds to entry 0.
 *
 * It also makes a double-tap safe, which matters because she will absolutely
 * double-tap: the replace has already set this entry's index to 0, so a second
 * tap arriving before `popstate` finds a depth of 0 and rewinds nothing. Without
 * that, two taps would fire `go(-3)` twice and throw her out of the app.
 */

/** The field we stamp on every history entry we create. */
const INDEX = 'ameliaIndex'

/**
 * The history object, or null when there isn't a usable one (node, a sandbox
 * that has taken `pushState` away). Every function below no-ops rather than
 * throwing: a navigation that quietly does nothing is survivable, and a throw
 * out of a tap handler is a dead app with no gesture that fixes it.
 *
 * @param {Window} win
 * @returns {History|null}
 */
function stack(win) {
  const history = win?.history
  return history !== null && typeof history === 'object' && typeof history.pushState === 'function'
    ? history
    : null
}

/**
 * How deep into the app this entry is, or `null` when the entry is not one of
 * ours — a cold load, or a fragment someone typed into the address bar.
 *
 * @param {Window} win
 * @returns {number|null}
 */
export function entryIndex(win) {
  const value = stack(win)?.state?.[INDEX]
  return Number.isInteger(value) && value >= 0 ? value : null
}

/**
 * How deep we are, treating an unstamped entry as the root. Internal, because
 * callers outside want to know "is this ours" (`entryIndex`) rather than have
 * that question quietly answered for them.
 *
 * @param {Window} win
 * @returns {number}
 */
function depth(win) {
  return entryIndex(win) ?? 0
}

/**
 * Establish the invariant, once, at boot: entry 0 is Home.
 *
 * A cold load can land on any hash — a refresh mid-session, a link, a fragment
 * left in the address bar. Rather than leave the root entry pointing at the
 * middle of the app (which would make the gate rewind to a picker instead of
 * Home), the root is rewritten to Home and the hash she actually arrived on is
 * pushed on top of it. So Back from a deep link goes Home, and Back from Home
 * leaves the app, which is the same shape as every other visit.
 *
 * Idempotent: a stamped entry has already been through here, so StrictMode's
 * double-invoked effect and a reload — `history.state` survives a reload, and so
 * do the entries behind it — both do nothing.
 *
 * @param {Window} win
 * @param {string} homeHash
 * @param {string|null} keepHash  The hash she arrived on, when it is a real
 *   non-home route worth keeping. Null to land her on Home.
 * @returns {boolean} true if this call anchored the session.
 */
export function anchorHome(win, homeHash, keepHash = null) {
  const history = stack(win)
  if (history === null || entryIndex(win) !== null) return false

  history.replaceState({ [INDEX]: 0 }, '', homeHash)

  if (typeof keepHash === 'string' && keepHash !== '' && keepHash !== homeHash) {
    history.pushState({ [INDEX]: 1 }, '', keepHash)
  }

  return true
}

/**
 * Go to a hash, carrying the depth forward. A push is one deeper; a replace
 * stands where it is.
 *
 * @param {Window} win
 * @param {string} hash
 * @param {boolean} [replace]
 */
export function commit(win, hash, replace = false) {
  const history = stack(win)
  if (history === null) return

  const index = depth(win)

  if (replace) {
    history.replaceState({ [INDEX]: index }, '', hash)
  } else {
    history.pushState({ [INDEX]: index + 1 }, '', hash)
  }
}

/**
 * The gate: home, and nothing behind her but the way out of the app.
 *
 * Rewrites this entry to Home (synchronous — the screen changes now) and then
 * rewinds to entry 0, so the play and summary entries she came through are
 * *ahead* of her rather than one Back press away. Pressing Back on Home then
 * leaves the app, which PLAN 2.5 says is correct behaviour.
 *
 * @param {Window} win
 * @param {string} homeHash
 * @returns {number} how many entries were rewound; 0 when she was already at the
 *   root and the replace was the whole of it.
 */
export function rewindHome(win, homeHash) {
  const history = stack(win)
  if (history === null) return 0

  const index = depth(win)

  history.replaceState({ [INDEX]: 0 }, '', homeHash)

  if (index > 0 && typeof history.go === 'function') history.go(-index)

  return index
}
