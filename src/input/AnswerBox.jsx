import React, { useEffect, useRef } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { shakeVariants } from '../feedback/motion'

/**
 * The answer box. (PLAN 2.4)
 *
 * One box, shared by every activity that is typed into: `?` when it is empty,
 * her digits while she types, the right answer during a reveal. Number Bonds
 * draws it as the missing circle, Arithmetic will draw it as the slot after the
 * `=` — same three states, same reactions, two skins.
 *
 * It brings the behaviour and the caller brings the look. The caller passes its
 * own `className`; this component reports what is in the box through data
 * attributes, so a stylesheet can dress each state without any class-name
 * plumbing crossing the boundary:
 *
 *     data-filled="true|false"                        is there anything in it
 *     data-feedback="idle|error|success|correction"   how the last answer graded
 *     data-nudge="<n>"                                empty ENTERs this session
 *
 * The first two are separate attributes rather than one state because they are
 * two different facts.
 * During the 500ms shake the box is both *filled* (with her wrong answer, which
 * she must be able to see) and *error*, and a single collapsed state would have
 * to pick one.
 *
 * **The wobble is the point of this file.** `session.nudge` counts empty ENTERs
 * and has had nothing rendering it for three steps: pressing the big green
 * button on an empty box produced no sound, no movement and no reason, so a
 * six-year-old presses it again harder. The counter increments, the box wobbles,
 * and she is told where the missing thing goes.
 *
 * `value` is a **string**, all the way from the session. A bond answer of `0` is
 * legitimate and a bare `0` would render as an empty box.
 */
const AnswerBox = ({
  value = '',
  feedback = 'idle',
  nudge = 0,
  placeholder = '?',
  className = '',
  ...rest
}) => {
  const controls = useAnimationControls()
  const reduceMotion = useReducedMotion()
  const shown = String(value ?? '')
  const filled = shown.length > 0

  // Two effects, one element. The feedback variant and the nudge are separate
  // animations from separate causes, and framer-motion's controls are how one
  // element takes both — `animate="idle"` cannot replay on a second identical
  // empty ENTER, because the value it is given has not changed.
  useEffect(() => {
    controls.start(feedback)
  }, [feedback, controls])

  // The counter is the SESSION's, so it does not reset when a card does — and
  // this box is remounted on every card. Comparing against the last value this
  // box actually handled is what stops card 7 wobbling on arrival merely because
  // she pressed ENTER on an empty box back on card 3. It also keeps a change of
  // `reduceMotion` from replaying an old nudge.
  const handledNudge = useRef(nudge)

  useEffect(() => {
    if (nudge === handledNudge.current) return
    handledNudge.current = nudge

    // Feedback never disappears under reduced motion; only motion does (house
    // rule). The still variant fades rather than shakes, so the box still says
    // "here, this one" to a child who cannot have things moving at her.
    controls.start(reduceMotion ? 'nudgeStill' : 'nudge')
  }, [nudge, reduceMotion, controls])

  return (
    <motion.div
      className={className}
      data-filled={filled ? 'true' : 'false'}
      data-feedback={feedback}
      // Empty ENTERs so far THIS SESSION, not this card. On the element so the
      // wobble's cause is visible in the DOM rather than only inside an animation
      // controller — the fix was wired but unobservable for three steps, and this
      // is what makes "did the nudge arrive?" answerable without a screen.
      data-nudge={nudge}
      variants={shakeVariants}
      initial="idle"
      animate={controls}
      {...rest}
    >
      {filled ? shown : placeholder}
    </motion.div>
  )
}

export default AnswerBox
