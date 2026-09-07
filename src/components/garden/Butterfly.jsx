import React from 'react'

import { OUTLINE, WING, filled } from './strokes'

/**
 * One butterfly. (PLAN 3.3)
 *
 * The ambient layer flies two of these on coprime paths behind the cards. It is
 * drawn small and simply on purpose: it is never the thing she is looking at,
 * and a detailed one at 26px would just be noise moving across the page.
 *
 * Two fills — upper wings and lower wings — plus the ink. Under the three-fill
 * ceiling rather than at it, because this one is in motion.
 *
 * @param {Object} props
 * @param {string} [props.upper] `var(--token)` for the top pair of wings.
 * @param {string} [props.lower] `var(--token)` for the bottom pair.
 */
const Butterfly = ({ className, upper = 'var(--blush-400)', lower = 'var(--butter-400)' }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    {/* Scaled up to fill the box. At 38px on the page the whole drawing is
        about 30 real pixels wide, so anything left at half the viewBox reads as
        a dark speck rather than a butterfly. */}
    <g transform="translate(50 54) scale(1.42)">
      <path d={WING} transform="rotate(-8)" {...filled(upper)} />
      <path d={WING} transform="scale(-1 1) rotate(-8)" {...filled(upper)} />
      <path d={WING} transform="rotate(122) scale(0.68)" {...filled(lower)} />
      <path d={WING} transform="scale(-1 1) rotate(122) scale(0.68)" {...filled(lower)} />
    </g>

    {/* Thin, and sage rather than full ink: a fat dark body at this size is the
        whole silhouette, and what arrives on the page is a beetle. */}
    <ellipse cx="50" cy="55" rx="3.6" ry="13" {...filled('var(--sage-700)')} />

    <g {...OUTLINE}>
      <path d="M48 43 C 44 33, 38 28, 32 27" />
      <path d="M52 43 C 56 33, 62 28, 68 27" />
    </g>
  </svg>
)

export default Butterfly
