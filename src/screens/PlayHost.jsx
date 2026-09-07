import React, { use, useLayoutEffect, useRef, useState } from 'react'

import PlayScreen from './PlayScreen'
import { assertActivityModule } from '../activities/manifestSchema'
import { mulberry32 } from '../lib/rng'
import { useSession } from '../session/useSession'
import { beatsBest, getBest, recordResult } from '../storage/scores'

/**
 * The play host. (PLAN 2.2, PLAN 2.3, PLAN 7 step 8)
 *
 * Everything between "she tapped a number" and "there is a result": load the
 * activity's module, deal one deck, run one session, write the result down once.
 * `PlayScreen` below it draws the card and takes the answer and knows none of
 * this; this file knows none of what a number bond is. **No activity is named
 * anywhere in it, and that must never change** — it is handed a manifest and an
 * option by the shell, and a manifest is data.
 *
 * This is where the two survivors of the deleted `hooks/useGame.js` landed: the
 * `Math.random` seed that starts a deck, and the effect that records a score.
 *
 * ── WHY A DECK IS DEALT HERE AND NOWHERE ELSE ───────────────────────────────
 *
 * PLAN 2.2 rule 3: engines are pure and take `rng` last, and they never call
 * `Math.random` — the tests stub it to throw. The randomness has to enter
 * somewhere, and this is the app's boundary: the one line below is the only
 * `Math.random` in the tree. Every engine stays deterministic under a seed and
 * therefore testable, while a real session is still unpredictable.
 *
 * ── WHY THE SCREEN UNMOUNTS BETWEEN SESSIONS ────────────────────────────────
 *
 * The shell keys this component on the activity slug and option id, and renders
 * something else entirely for the summary. So a new session is always a new
 * mount: a new deck, a new `useSession`, a new card component with an empty
 * draft. Nothing is reset by message, which is what stops the class of bug that
 * used to stamp one session's answer into the next one's box. If a future
 * routing change ever lets one host survive from one session into another, the
 * key has to grow a session counter — see the note in `PlayScreen.jsx`.
 */

/**
 * A generator for one deck.
 *
 * >>> THE ONLY `Math.random` IN THE APP. Keep it that way.
 */
const dealer = () => mulberry32((Math.random() * 0x100000000) >>> 0)

/**
 * @param {Object} props
 * @param {import('../activities/manifestSchema').ActivityManifest} props.activity
 * @param {import('../activities/manifestSchema').ActivityOption} props.option
 * @param {() => void} props.onExit      The gate. Abandons the session; never scored.
 * @param {(outcome: Object) => void} props.onComplete  Handed a finished result, once.
 */
const PlayHost = ({ activity, option, onExit, onComplete }) => {
  // The activity's engine and renderer, unwrapped from the manifest's memoised
  // dynamic import. `use` suspends the first time and returns straight away
  // afterwards, so the second game of an evening has no loading frame at all.
  // The promise MUST be the same object every render — `defineActivity`
  // memoises `load` precisely so this cannot spin.
  const module = use(activity.load())

  /**
   * One deck, dealt once, by `useSession`'s lazy initialiser.
   *
   * `option.params` goes in untouched: it is opaque to everything except this
   * activity's own `generate` (PLAN 2.2 rule 2). This file does not know, and
   * must never learn, that `params` has a `target` in it.
   */
  const deal = () => {
    assertActivityModule(module, activity)

    const deck = module.generate(option.params, dealer())

    if (import.meta.env.DEV && deck.length !== option.deckSize) {
      // PLAN 2.2: deckSize is "asserted in dev against what the engine actually
      // returns. This is what keeps personal bests honest." A best of 11/11
      // stored against a recipe that now deals 12 is a record she cannot match
      // and a denominator that lies on the summary.
      console.error(
        `${activity.id}/${option.id}: manifest says deckSize ${option.deckSize}, ` +
          `the engine dealt ${deck.length}. Fix one of them before this reaches a high score.`
      )
    }

    return deck
  }

  const session = useSession(deal)

  /**
   * The best that was standing when this session began.
   *
   * Read once, at mount, so the summary keeps showing the score she was chasing
   * even after this session has overwritten it — and so the trophy is decided
   * against that number rather than against this session's own fresh write.
   */
  const [previousBest] = useState(() => getBest(activity, option))

  /**
   * Write the result down, once, and hand it to the shell.
   *
   * Guarded on the IDENTITY of the result object, not on the phase: the reducer
   * builds `result` exactly once per session, so this survives StrictMode's
   * double-invoked effects and any re-render that runs the effect again without
   * a new session having happened.
   *
   * `result.score` is the reducer's own count, including the card graded one
   * action before the session ended. That is the whole of PLAN 5's first
   * critical bug — the last correct answer of every session used to be lost
   * between a `setScore` and a `setTimeout`, so a perfect run could never be
   * recorded.
   *
   * A LAYOUT effect, unusually, and for one reason: the session reaches
   * `complete` with no card to draw, so a passive effect would let the browser
   * paint one frame of an empty play screen between the last answer and the
   * summary. Running before paint means she never sees it. The storage write
   * inside is a few hundred microseconds and cannot throw — that is what
   * `safeStorage` is for.
   */
  const reported = useRef(null)

  useLayoutEffect(() => {
    const result = session.result
    if (!result || reported.current === result) return

    reported.current = result

    recordResult(activity, option, {
      score: result.score,
      total: result.total,
      wallMs: result.wallMs,
    })

    onComplete({
      activitySlug: activity.slug,
      optionId: option.id,
      score: result.score,
      total: result.total,
      wallMs: result.wallMs,
      // Same rule that decides what gets written, imported rather than restated
      // — a second copy of "is this a record" is how a summary ends up
      // congratulating a run that was never saved (PLAN 2.6).
      isNewRecord: beatsBest(previousBest, result),
      previousBest,
    })
  }, [session.result, activity, option, previousBest, onComplete])

  return (
    <PlayScreen
      question={session.question}
      prompt={module.Prompt}
      inputMode={activity.inputMode}
      inputConfig={activity.inputConfig}
      feedback={session.feedback}
      revealed={session.revealed}
      nudge={session.nudge}
      onSubmit={session.submit}
      // The gate. Leaving mid-game abandons the session and it is never scored
      // (PLAN 2.5) — there is nothing to cancel, because leaving unmounts the
      // session, its deck and its one timer together.
      onBack={onExit}
      currentIndex={session.index}
      total={session.total}
      startTime={session.startedAt}
      score={session.score}
    />
  )
}

export default PlayHost
