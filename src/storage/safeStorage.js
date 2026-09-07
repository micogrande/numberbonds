/**
 * localStorage that cannot throw.
 *
 * PLAN 2.6: "`safeStorage.js` guards **both** read and write — today only the
 * read is guarded, which means a storage failure in private browsing throws out
 * of the session-complete path and hangs the app on the last card forever. It
 * also rejects a successfully-parsed non-object, because `JSON.parse('null')`
 * succeeds and returns `null`."
 *
 * Two rules, and everything else follows from them:
 *
 *   1. Nothing in here throws. Ever. A read that fails returns the fallback; a
 *      write that fails returns `false`. Callers may check the boolean, but they
 *      are never *forced* to, because the caller is the session-complete path
 *      and a throw there is the bug we are here to kill.
 *   2. A value only counts as data if it parses to a plain object. `null`, an
 *      array, a number and a string are all rejected in favour of the fallback,
 *      because every store in this app is a keyed record.
 *
 * When localStorage is unavailable — Safari private browsing, a quota wall, a
 * browser with site data blocked, or plain node in the tests — writes fall back
 * to an in-memory Map so the tab keeps working for the rest of the session. The
 * data is gone when she closes the tab, which is sad but survivable; hanging on
 * the last card is not.
 *
 * ── THE FALLBACK NEVER OUTLIVES ITS USEFULNESS ──────────────────────────────
 *
 * A fallback copy shadows localStorage for that key **only while localStorage
 * has not moved on**. Each entry remembers what localStorage held at the moment
 * the write failed; the next read compares, and the instant the stored value is
 * something else, the memory copy is dropped and localStorage wins.
 *
 * That is not tidiness, it is the bug it replaces. The fallback used to shadow
 * unconditionally for the rest of the tab's life, so a copy made during a
 * failing minute stayed authoritative after writes started working again — and
 * since every writer here is read-modify-write (`{ ...all, [key]: record }`), a
 * later successful write would rebuild the store on top of that stale copy and
 * silently delete whatever had been saved in between. On a phone that is one
 * evening's scores lost to one quota error.
 *
 * What is deliberately NOT solved: a value that was replaced with a byte-identical
 * one is indistinguishable from one nobody touched, so the memory copy keeps
 * shadowing. That is a no-op either way. This is still last-write-wins rather
 * than a merge, and anyone adding a second writer should know it.
 */

/**
 * Keys whose last write did not reach localStorage.
 *
 *   raw   what we could not store, and what reads answer with meanwhile
 *   base  what localStorage held at that moment — `null` when it could not even
 *         be read. A read whose live value differs from `base` means somebody
 *         else has written since, so the fallback is stale and is dropped.
 *
 * A successful write removes the key too: localStorage is the authority
 * whenever it works.
 *
 * @type {Map<string, { raw: string, base: string|null }>}
 */
const memory = new Map()

/**
 * localStorage as it stands, ignoring the fallback.
 *
 * Bare `localStorage` throws a ReferenceError under node, which is exactly the
 * behaviour we want: the tests get the memory fallback for free.
 *
 * @param {string} key
 * @returns {string|null} null when the key is missing OR unreadable — the two
 *   are the same thing to every caller here.
 */
function liveRaw(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * @param {string} key
 * @returns {string|null} The raw stored string, or null if there isn't one.
 */
function readRaw(key) {
  const fallback = memory.get(key)
  if (fallback === undefined) return liveRaw(key)

  const live = liveRaw(key)

  // Unchanged since the write failed: nothing else is writing, so the session
  // stays self-consistent by answering from memory.
  if (live === fallback.base) return fallback.raw

  // localStorage has moved on. It is the authority the moment it disagrees, and
  // the fallback must not come back later and overwrite what it says.
  memory.delete(key)
  return live
}

/**
 * @param {string} key
 * @param {string} raw
 * @returns {boolean} true if the value reached localStorage.
 */
function writeRaw(key, raw) {
  try {
    localStorage.setItem(key, raw)
    memory.delete(key)
    return true
  } catch {
    // Read the base BEFORE recording, and read it live: what this fallback is
    // allowed to shadow is the value that is actually in storage right now.
    memory.set(key, { raw, base: liveRaw(key) })
    return false
  }
}

/**
 * Is this a plain keyed record, as opposed to null / an array / a primitive?
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read a JSON object out of storage.
 *
 * @template T
 * @param {string} key
 * @param {T} [fallback]  Returned when the key is missing, unparseable, or
 *                        parses to anything that is not a plain object.
 * @returns {Object|T}
 */
export function readObject(key, fallback = null) {
  const raw = readRaw(key)
  if (raw === null || raw === undefined) return fallback

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return fallback
  }

  // `JSON.parse('null')` does not throw. Neither does `JSON.parse('7')`.
  if (!isPlainObject(parsed)) return fallback

  return parsed
}

/**
 * Write a JSON object to storage.
 *
 * @param {string} key
 * @param {Object} value
 * @returns {boolean} true if it reached localStorage, false if it only reached
 *                    the in-memory fallback. Never throws either way.
 */
export function writeObject(key, value) {
  if (!isPlainObject(value)) return false

  let raw
  try {
    raw = JSON.stringify(value)
  } catch {
    // A cycle or a BigInt. Nothing in this app writes one, but a caller bug
    // must not become a white screen.
    return false
  }

  return writeRaw(key, raw)
}

/**
 * Drop the in-memory fallback. **Tests only** — nothing in the app calls this,
 * because a fallback that clears itself mid-session would lose her result.
 */
export function resetMemoryFallback() {
  memory.clear()
}
