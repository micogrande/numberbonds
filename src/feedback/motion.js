/**
 * Shared motion vocabulary.
 *
 * One place for the timings and the framer-motion variants, so every activity
 * feels like the same app (PLAN 2.3).
 */

/**
 * The feedback clock, in milliseconds. These are **exactly** the values the app
 * ships with today and PLAN 2.3 pins them: "Timings stay exactly as they are
 * today — shake 500ms, success 1500ms, reveal 2500ms — so all four activities
 * feel identical." Do not tune them to make a session shorter; her personal
 * bests are wall-clock times measured against this pacing.
 *
 *   shake    wrong answer shakes, then the right answer is revealed
 *   success  correct answer celebrates, then the next card arrives
 *   reveal   total time on a wrong card before the next one arrives
 */
export const DEFAULT_TIMINGS = {
  shake: 500,
  success: 1500,
  reveal: 2500,
}

/**
 * A circle (or any answer shape) arriving on screen.
 */
export const circleVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
}

/**
 * The answer slot reacting to a graded answer. Keyed by the session's feedback
 * state, so the variant names are the state names: idle · error · success ·
 * correction.
 *
 * `error` is a shake, never a colour alarm — the house rule is a gentle shake
 * and a soft reveal, never a harsh X.
 *
 * The last two are not feedback states. They answer `session.nudge` — ENTER
 * pressed on an empty box — and are driven from `input/AnswerBox.jsx` through
 * animation controls rather than from the phase, because an empty ENTER is not a
 * phase transition and must be able to replay on the second press.
 */
export const shakeVariants = {
  idle: { x: 0 },
  error: { x: [-10, 10, -10, 10, 0], transition: { duration: 0.4 } },
  success: { scale: [1, 1.2, 1], transition: { duration: 0.4 } },
  correction: { scale: 1, opacity: 1 },

  /**
   * "You have not put anything in here yet." Deliberately smaller and quicker
   * than `error`: nothing has been graded, so it must not read as a wrong
   * answer.
   */
  nudge: { x: [0, -7, 7, -4, 0], transition: { duration: 0.3 } },

  /**
   * The same message with no movement, for `prefers-reduced-motion`. Feedback
   * never disappears under reduced motion; only motion does.
   */
  nudgeStill: { opacity: [1, 0.45, 1], transition: { duration: 0.4 } },
}
