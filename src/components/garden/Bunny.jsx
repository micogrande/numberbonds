import React from 'react'

import { OUTLINE, EAR, filled } from './strokes'

/**
 * The bunny, in two poses. (PLAN 3.3, PLAN 3.5, PLAN 3.6)
 *
 * > the bunny gets two dot eyes and a blush oval, no mouth
 *
 * No mouth is the rule that makes him readable in both poses at once: a mouth
 * has to be happy or sad, and this bunny is neither — he is just there. Awake
 * he peeks over the top-right of the header with his ears breaking the line;
 * asleep he is curled beside a pot in a category that has not been built yet.
 *
 * Asleep, the two dots become two closed arcs. That is the whole difference and
 * it is the entire message of PLAN 3.6: not locked, not broken, asleep.
 *
 * One file, two poses, because they are one character. Splitting them would let
 * the two drift apart, and a garden with two different bunnies in it is a
 * garden drawn by two people.
 *
 * @param {Object} props
 * @param {'peek'|'asleep'} [props.pose]
 */
const Bunny = ({ className, pose = 'peek' }) => {
  const asleep = pose === 'asleep'

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {asleep ? (
        <>
          {/* the curled back, tail end at the right */}
          <path
            d="M14 84 C 10 60, 30 48, 52 50 C 74 52, 88 66, 86 84 Z"
            {...filled('var(--cream-200)')}
          />

          {/* Ears laid back ALONG the body, drawn over it rather than behind:
              behind, the back covers them and a sleeping bunny reads as a
              loaf. They are what makes the shape a rabbit at 50px. */}
          <g transform="translate(32 58)">
            <path d={EAR} transform="rotate(82) scale(0.9)" {...filled('var(--cream-200)')} />
            <path d={EAR} transform="rotate(99) scale(0.85)" {...filled('var(--cream-200)')} />
          </g>

          {/* the head, tucked down at the left */}
          <circle cx="26" cy="70" r="16" {...filled('var(--cream-200)')} />

          {/* one closed eye — the whole difference between this pose and the
              other one, and the entire message of PLAN 3.6 */}
          <path d="M18 68 C 22 73, 28 73, 32 68" {...OUTLINE} />
          <ellipse cx="20" cy="79" rx="7" ry="4.5" {...filled('var(--blush-400)')} />
        </>
      ) : (
        <>
          <g transform="translate(50 62)">
            <path d={EAR} transform="translate(-11 0) rotate(-4)" {...filled('var(--cream-200)')} />
            <path
              d={EAR}
              transform="translate(11 0) scale(-1 1) rotate(-4)"
              {...filled('var(--cream-200)')}
            />
            <path
              d={EAR}
              transform="translate(-11 -1) rotate(-4) scale(0.5)"
              {...filled('var(--blush-200)')}
            />
            <path
              d={EAR}
              transform="translate(11 -1) scale(-1 1) rotate(-4) scale(0.5)"
              {...filled('var(--blush-200)')}
            />
          </g>

          <ellipse cx="50" cy="76" rx="31" ry="26" {...filled('var(--cream-200)')} />

          <circle cx="39" cy="73" r="4.4" fill="var(--color-text)" />
          <circle cx="61" cy="73" r="4.4" fill="var(--color-text)" />

          {/* blush-400 rather than blush-200: at 56px on a cream card, the
              200-tint is invisible and the cheeks may as well not be drawn.
              Both are illustration tints, and neither is ever text. */}
          <ellipse cx="28" cy="84" rx="8" ry="5" {...filled('var(--blush-400)')} />
          <ellipse cx="72" cy="84" rx="8" ry="5" {...filled('var(--blush-400)')} />
        </>
      )}
    </svg>
  )
}

export default Bunny
