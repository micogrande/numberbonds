/**
 * One-way migrations of stored data.
 *
 * PLAN 2.6: "**Existing scores are migrated, not abandoned.** Amelia has real
 * high scores in `number_bonds_scores`. Prefix-matched longest-first
 * (`PRACTICE_PARTS_` before `PRACTICE_`), zero-scores dropped, never clobbering
 * an existing key, the old key left in place as a backup for one release,
 * idempotent so StrictMode's double-invoke is a no-op."
 *
 * This file also owns the *meaning* of the old Number Bonds keys — which old
 * mode was which activity, and how many cards its decks held. Since step 8 the
 * live writer of results is the play host, driven by the manifests in
 * `activities/number-bonds/`, so the mapping below is read by the migration
 * itself and by `activities/registry.test.js`, which pins the two together.
 */

import { readObject, writeObject } from './safeStorage'
import { SCORES_KEY, readAllBests, scoreKey } from './scores'

export const MIGRATIONS_KEY = 'amelia.migrations.v1'

/** The key Amelia's real high scores live in. Never deleted — it is the backup. */
export const LEGACY_SCORES_KEY = 'number_bonds_scores'

/** PLAN 2.6 names this migration in the applied list. */
export const BONDS_MIGRATION_ID = 'bonds-2024'

/**
 * The two Number Bonds activities, keyed by the mode name the old code used.
 *
 * PLAN 9.4: Number Bonds stays as **two separate activities** with their own
 * labels and their own high scores.
 *
 *   PRACTICE        "Bonds to N"      whole fixed, a part missing
 *                                     generateDeck(n) → n + 1 cards (0+n … n+0)
 *   PRACTICE_PARTS  "Parts up to N"   parts given, the whole missing
 *                                     generateMixedDeck(n) → n - 2 cards (wholes 3…n)
 *
 * >>> THESE IDS ARE THE HIGH-SCORE KEY AND ARE STABLE FOREVER (PLAN 2.2 rule 1).
 * >>> The manifests use exactly these ids, this option-id scheme and version 1.
 * >>> Change either side and every score migrated here becomes unreachable.
 * >>> They are deliberately NOT imported by the manifests — a manifest that
 * >>> imported from `storage/` would drag storage into the first chunk and point
 * >>> the dependency the wrong way. `activities/registry.test.js` asserts the
 * >>> two agree, so a rename fails at the moment it is made.
 *
 * `BOND_WHOLE` is PLAN 2.6's own worked example (`'BOND_WHOLE::t10::v1'`) and is
 * read here as the activity named after its *whole* — "bonds to 10" — leaving
 * `BOND_PARTS` for "parts up to 10", which also matches the old `_PARTS` suffix.
 *
 * ── WHY A FILE IN storage/ NAMES TWO ACTIVITIES ─────────────────────────────
 *
 * PLAN 2 is flat about it: "Nothing in `app/`, `session/`, `input/`, `storage/`
 * or `screens/` ever names a specific activity." This map names two. That is a
 * judgement, not an oversight, and it is written down here so nobody has to
 * make it a second time.
 *
 * The rule exists so that adding or removing an activity is one folder and one
 * import line, never an edit to shared code. This map cannot create that
 * coupling, because it can never gain an entry: `number_bonds_scores` is a
 * CLOSED store. Nothing has written to it since step 3, and no activity that
 * ships from here on ever can. It is a frozen record of data that already
 * exists on one child's phone — the shape of a store, not a directory of what
 * the app contains.
 *
 * Moving it behind `activities/number-bonds/` would cost three things:
 *
 *   1. The migration runs from `main.jsx` before React mounts, so the boot path
 *      would have to pull in an activity chunk to rescue her scores — the
 *      dependency pointing exactly the wrong way, and the first paint paying
 *      for it.
 *   2. The day that folder is deleted or restructured, the migration goes with
 *      it — while her data is still sitting in localStorage and the only
 *      remaining description of what `PRACTICE_PARTS_10` *meant* has gone. A
 *      migration has to outlive the code it migrates away from.
 *   3. `activities/registry.test.js` pins the manifests against this map. If
 *      the map lived in the same folder as the manifests, that test would be
 *      comparing a thing to itself.
 *
 * That test is what keeps this honest rather than merely excused: ids, version,
 * option-id scheme and deck sizes are all asserted to agree, so a rename fails
 * at the moment it is made instead of the next time she opens the app.
 *
 * THE FENCE: this map is finished. If you are here to add an entry for a new
 * activity, you are in the wrong file — new activities have never written to
 * the legacy key, and there is nothing of theirs to migrate.
 */
export const LEGACY_BOND_MODES = Object.freeze({
  PRACTICE_PARTS: {
    activity: { id: 'BOND_PARTS', version: 1 },
    deckSize: (target) => target - 2,
  },
  PRACTICE: {
    activity: { id: 'BOND_WHOLE', version: 1 },
    deckSize: (target) => target + 1,
  },
})

/**
 * Mode names longest-first. Sorted rather than hand-ordered, so the trap below
 * cannot be re-armed by someone tidying the object above into alphabetical
 * order — `PRACTICE` sorts before `PRACTICE_PARTS`, and that would be a silent
 * data-loss bug rather than a test failure at the point of the edit.
 */
const LEGACY_MODES_LONGEST_FIRST = Object.keys(LEGACY_BOND_MODES).sort(
  (a, b) => b.length - a.length
)

/**
 * Option id for a bonds target. `^[a-z0-9-]+$` per PLAN 2.2, and stable forever.
 *
 * @param {number} target
 * @returns {{ id: string }}
 */
export const legacyBondOption = (target) => ({ id: `t${target}` })

/**
 * Deck size for a legacy mode/target pair.
 *
 * The old records stored no `total` (PLAN 5, `ScoreStorage.js:24`), so the
 * denominator has to be reconstructed from the recipe that produced it.
 *
 * @param {string} mode
 * @param {number} target
 * @returns {number} 0 or less means "no sane deck", i.e. do not trust the record.
 */
export function legacyDeckTotal(mode, target) {
  const spec = LEGACY_BOND_MODES[mode]
  if (!spec || !Number.isInteger(target)) return 0
  return spec.deckSize(target)
}

/**
 * Split an old `${mode}_${target}` key.
 *
 * **The trap this exists for:** `PRACTICE_PARTS_10` split on `_` gives mode
 * `PRACTICE`, target `PARTS_10`. Prefix-matching longest-first is what stops
 * "parts up to 10" from being filed as, or silently colliding with, "bonds to
 * 10" — which would lose one of the two real high scores she has for every
 * target she plays.
 *
 * @param {string} key
 * @returns {{ mode: string, target: number, activity: Object, option: Object, total: number }|null}
 */
export function parseLegacyKey(key) {
  if (typeof key !== 'string') return null

  for (const mode of LEGACY_MODES_LONGEST_FIRST) {
    const prefix = `${mode}_`
    if (!key.startsWith(prefix)) continue

    const rest = key.slice(prefix.length)
    if (!/^\d+$/.test(rest)) continue

    const target = Number.parseInt(rest, 10)
    const total = legacyDeckTotal(mode, target)
    if (total <= 0) return null

    return {
      mode,
      target,
      activity: LEGACY_BOND_MODES[mode].activity,
      option: legacyBondOption(target),
      total,
    }
  }

  return null
}

/**
 * Move Amelia's Number Bonds high scores into `amelia.scores.v1`.
 *
 * Rules, all of them from PLAN 2.6:
 *
 *   - longest prefix first, so `PRACTICE_PARTS_10` is never read as
 *     mode `PRACTICE`, target `PARTS_10`
 *   - `total` reconstructed from the target, since the old records had none
 *   - score-0 records dropped: they are pollution from the bug where a first
 *     session was unconditionally a personal best
 *   - an existing key is never clobbered, so a real result recorded after this
 *     ships always beats a migrated one
 *   - the old key is left exactly where it is, as a backup
 *   - idempotent twice over — the applied flag short-circuits it, and the
 *     never-clobber rule makes a re-run a no-op anyway. StrictMode invokes
 *     everything twice in dev; this must not double-count or overwrite.
 *
 * Nothing in here throws for a storage failure. If the scores write fails
 * (private browsing), the migration is *not* marked applied, so it simply runs
 * again on the next boot.
 *
 * @param {{ now?: number }} [options]
 * @returns {{ ran: boolean, migrated: number, dropped: number, saved: boolean }}
 */
export function migrateLegacyScores(options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now()

  const state = readObject(MIGRATIONS_KEY, {})
  const applied = Array.isArray(state.applied) ? state.applied : []

  if (applied.includes(BONDS_MIGRATION_ID)) {
    return { ran: false, migrated: 0, dropped: 0, saved: true }
  }

  const legacy = readObject(LEGACY_SCORES_KEY, {})
  const bests = readAllBests()
  const next = { ...bests }

  let migrated = 0
  let dropped = 0

  for (const [legacyKey, entry] of Object.entries(legacy)) {
    const parsed = parseLegacyKey(legacyKey)
    if (parsed === null) {
      dropped += 1
      continue
    }

    const score = entry?.score
    const wallMs = entry?.time
    if (!Number.isFinite(score) || !Number.isFinite(wallMs) || wallMs < 0) {
      dropped += 1
      continue
    }

    // A zero is not a best. It is the old "first session always wins" bug.
    if (score <= 0) {
      dropped += 1
      continue
    }

    const key = scoreKey(parsed.activity, parsed.option)
    if (key in next) {
      dropped += 1
      continue
    }

    next[key] = {
      score,
      total: parsed.total,
      wallMs,
      recipeVersion: parsed.activity.version,
      playedAt: Number.isFinite(entry?.date) ? entry.date : now,
      plays: 1,
    }
    migrated += 1
  }

  if (migrated > 0) {
    const saved = writeObject(SCORES_KEY, next)
    if (!saved) {
      // Storage is unavailable. Leave the migration unapplied so a later boot,
      // in a working tab, still rescues her scores.
      return { ran: true, migrated: 0, dropped, saved: false }
    }
  }

  const marked = writeObject(MIGRATIONS_KEY, {
    ...state,
    applied: [...applied, BONDS_MIGRATION_ID],
  })

  return { ran: true, migrated, dropped, saved: marked }
}
