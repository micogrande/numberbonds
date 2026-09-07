/**
 * Personal bests.
 *
 * PLAN 2.6:
 *
 *   amelia.scores.v1       { [recordKey]: BestRecord }
 *
 *   const scoreKey = (activity, option) =>
 *     `${activity.id}::${option.id}::v${activity.version}`;
 *   // 'BOND_WHOLE::t10::v1'   'ADD::to20::v1'   'ROMAN::to100::v1'
 *
 *   BestRecord = { score, total, wallMs, recipeVersion, playedAt, plays }
 *
 * Parseable by construction: `::` is forbidden inside an id and validated here,
 * because today `PRACTICE_PARTS_10` cannot be split on `_`. `total` is stored so
 * the summary can say "Previous best: 10 / 18" rather than a bare number, and
 * ranking stays on wall-clock time (PLAN 2.6 — deliberately not changed during
 * the migration, since that would visibly reset Amelia's existing records).
 */

import { isPlainObject, readObject, writeObject } from './safeStorage'

export const SCORES_KEY = 'amelia.scores.v1'

/**
 * @typedef {Object} BestRecord
 * @property {number} score          Best score recorded for this key.
 * @property {number} total          Deck size that score was out of.
 * @property {number} wallMs         Wall-clock time of the best run.
 * @property {number} recipeVersion  activity.version at the time. Redundant with
 *                                   the key, and stored anyway so a record read
 *                                   in isolation is still self-describing.
 * @property {number} playedAt       When the best was set (epoch ms).
 * @property {number} plays          How many results have been recorded here.
 */

/**
 * @param {unknown} id
 * @param {string} label
 */
function assertIdSegment(id, label) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new TypeError(`scoreKey(): ${label} must be a non-empty string, got ${String(id)}`)
  }

  // The whole point of `::` as the separator is that a key can be split back
  // apart. An id containing it would make that a lie, silently and forever,
  // since these ids are append-only and stable for the life of the app.
  if (id.includes('::')) {
    throw new TypeError(`scoreKey(): ${label} must not contain "::", got "${id}"`)
  }
}

/**
 * The high-score key. PLAN 2.2 rule 1: `id` + `option.id` + `version` are
 * append-only and stable forever. Rename a label freely; never an id.
 *
 * @param {{ id: string, version: number }} activity
 * @param {{ id: string }} option
 * @returns {string}
 */
export function scoreKey(activity, option) {
  assertIdSegment(activity?.id, 'activity.id')
  assertIdSegment(option?.id, 'option.id')

  const version = activity?.version
  if (!Number.isInteger(version) || version < 1) {
    throw new TypeError(`scoreKey(): activity.version must be a positive integer, got ${String(version)}`)
  }

  return `${activity.id}::${option.id}::v${version}`
}

/**
 * @param {unknown} value
 * @returns {value is BestRecord}
 */
function isBestRecord(value) {
  return (
    isPlainObject(value) &&
    Number.isFinite(value.score) &&
    Number.isFinite(value.wallMs)
  )
}

/**
 * Every stored best, keyed by scoreKey. Always an object, never null.
 *
 * @returns {Record<string, BestRecord>}
 */
export function readAllBests() {
  return readObject(SCORES_KEY, {})
}

/**
 * @param {{ id: string, version: number }} activity
 * @param {{ id: string }} option
 * @returns {BestRecord|null}
 */
export function getBest(activity, option) {
  const stored = readAllBests()[scoreKey(activity, option)]
  return isBestRecord(stored) ? stored : null
}

/**
 * Does this result beat the stored best?
 *
 * Exported because two callers must never disagree about it: `recordResult`
 * below, which decides what is written, and the hook behind the summary, which
 * decides whether to show her a trophy. The trophy is drawn from the result and
 * the best that was standing when the session began, so the same rule has to be
 * legible from outside this file — a second copy of "is this a record" is how a
 * summary ends up congratulating a run that was never saved, or staying silent
 * about one that was.
 *
 * PLAN 2.6: `isNewRecord` requires `score > 0` — "today a child who gets every
 * question wrong on a fresh browser is congratulated with a trophy and 200
 * particles of confetti". Ties break on wall-clock time, unchanged.
 *
 * @param {BestRecord|null} previousBest
 * @param {{ score: number, wallMs: number }} result
 * @returns {boolean}
 */
export function beatsBest(previousBest, result) {
  const score = result?.score
  const wallMs = result?.wallMs

  if (!Number.isFinite(score) || !Number.isFinite(wallMs) || wallMs < 0) return false

  // A zero is never a personal best, first session or not.
  if (score <= 0) return false

  if (previousBest === null || previousBest === undefined) return true

  return (
    score > previousBest.score ||
    (score === previousBest.score && wallMs < previousBest.wallMs)
  )
}

/**
 * Record the result of a finished session.
 *
 * PLAN 2.6: "`isFirstResult` and `isNewRecord` are returned **separately**, and
 * `isNewRecord` requires `score > 0`. Today a child who gets every question
 * wrong on a fresh browser is congratulated with a trophy and 200 particles of
 * confetti."
 *
 * The two flags mean different things and neither implies the other:
 *
 *   isFirstResult  nothing was stored under this key before this result. The
 *                  summary can say "first time!" without claiming a record.
 *   isNewRecord    this result beat the stored best AND scored at least one
 *                  card. A zero is never a personal best, first session or not.
 *
 * Ties break on wall-clock time, which is the ranking the app already shipped
 * with and PLAN 2.6 keeps deliberately.
 *
 * A zero-scoring result with nothing stored writes nothing at all, which keeps
 * the store to records worth beating and matches what the migration does with
 * the legacy zeros. `plays` still counts every result recorded against an
 * existing record, improving or not.
 *
 * Never throws for a storage failure — that is the entire point of safeStorage.
 * It *does* throw for a malformed activity/option id, because that is a bug in a
 * manifest and must be loud; ids are compile-time constants, so the live
 * session-complete path cannot reach it.
 *
 * @param {{ id: string, version: number }} activity
 * @param {{ id: string }} option
 * @param {{ score: number, total: number, wallMs: number, playedAt?: number }} result
 * @returns {{ key: string, isFirstResult: boolean, isNewRecord: boolean,
 *             previousBest: BestRecord|null, record: BestRecord|null, saved: boolean }}
 */
export function recordResult(activity, option, result) {
  const key = scoreKey(activity, option)

  const all = readAllBests()
  const stored = all[key]
  const previousBest = isBestRecord(stored) ? stored : null
  const isFirstResult = previousBest === null

  const score = result?.score
  const total = result?.total
  const wallMs = result?.wallMs
  const playedAt = Number.isFinite(result?.playedAt) ? result.playedAt : Date.now()

  const wellFormed =
    Number.isFinite(score) && score >= 0 &&
    Number.isFinite(total) && total > 0 &&
    Number.isFinite(wallMs) && wallMs >= 0

  if (!wellFormed) {
    // A caller bug. Refuse to poison the store with it, but do not throw: this
    // runs on the session-complete path.
    console.warn('recordResult(): ignoring a malformed result for', key, result)
    return { key, isFirstResult, isNewRecord: false, previousBest, record: previousBest, saved: false }
  }

  const isNewRecord = beatsBest(previousBest, { score, wallMs })

  let record = null
  if (isNewRecord) {
    record = {
      score,
      total,
      wallMs,
      recipeVersion: activity.version,
      playedAt,
      plays: (Number.isFinite(previousBest?.plays) ? previousBest.plays : 0) + 1,
    }
  } else if (previousBest !== null) {
    // Not a record, but it happened. Keep the best untouched and count the play.
    record = {
      ...previousBest,
      plays: (Number.isFinite(previousBest.plays) ? previousBest.plays : 0) + 1,
    }
  }

  const saved = record === null ? false : writeObject(SCORES_KEY, { ...all, [key]: record })

  return { key, isFirstResult, isNewRecord, previousBest, record, saved }
}
