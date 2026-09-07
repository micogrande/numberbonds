import React from 'react'

import { OUTLINE, LEAF, filled } from './strokes'

/**
 * geography — a hedgehog with a leaf map. (PLAN 3.5)
 *
 * The leaf on his back is the same LEAF primitive as the strawberry calyx and
 * the lily pads, at full size, with three stroked "rivers" on it. That is the
 * map: a shape with lines on it, which is what a map looks like before you can
 * read place names.
 *
 * Three fills — spines, snout, leaf — plus the ink. The spines themselves are
 * ink marks rather than a fourth colour, which is also what keeps him from
 * reading as a porcupine-shaped blob at 68px.
 */
const Hedgehog = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    {/* spines, drawn behind so they read as sticking out of the body */}
    <g {...OUTLINE}>
      <path d="M30 44 l -7 -11" />
      <path d="M43 35 l -3 -13" />
      <path d="M57 32 l 3 -13" />
      <path d="M71 38 l 9 -10" />
      <path d="M81 50 l 12 -6" />
    </g>

    <path
      d="M16 74 C 13 47, 33 29, 55 31 C 77 33, 90 50, 87 74 Z"
      {...filled('var(--bark)')}
    />

    {/* the leaf map */}
    <g transform="translate(30 52) rotate(-14)">
      <path d={LEAF} {...filled('var(--sage-400)')} />
      <g {...OUTLINE}>
        <path d="M2 0 L30 0" />
        <path d="M12 -1 l 6 -5" />
        <path d="M20 1 l 6 5" />
      </g>
    </g>

    {/* snout, at the low left, with a nose */}
    <ellipse cx="20" cy="68" rx="13" ry="10" {...filled('var(--sand)')} />
    <circle cx="9" cy="68" r="4" fill="var(--color-text)" />
    <circle cx="22" cy="61" r="4" fill="var(--color-text)" />

    {/* the ground he stands on */}
    <path d="M12 76 L90 76" {...OUTLINE} />
  </svg>
)

export default Hedgehog
