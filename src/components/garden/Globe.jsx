import React from 'react'

import { OUTLINE, PETAL, filled } from './strokes'

/** Where the three flowerbed blooms sit, in viewBox units. */
const BLOOMS = [
  { x: 37, y: 41, scale: 0.34 },
  { x: 62, y: 63, scale: 0.34 },
  { x: 66, y: 24, scale: 0.3 },
]

/**
 * continents — the globe as a round flowerbed. (PLAN 3.5)
 *
 * Land masses drawn as beds of soil with flowers growing out of them, and the
 * blue is what is left over. Two meridians curve across it so it reads as a
 * sphere rather than a badge.
 *
 * Three fills — sea, land, bloom. Both land shapes are inside the circle by
 * construction (every point is under 27 units from the centre against a radius
 * of 32), so no clip path is needed and the outline stays one continuous ink.
 */
const Globe = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="50" cy="50" r="32" {...filled('var(--garden-sky)')} />

    {/* meridians, ink only */}
    <g {...OUTLINE}>
      <path d="M50 18 C 34 30, 34 70, 50 82" />
      <path d="M50 18 C 66 30, 66 70, 50 82" />
      <path d="M19 50 L81 50" />
    </g>

    <g {...filled('var(--sage-400)')}>
      <path d="M30 38 C 38 31, 49 33, 51 42 C 53 51, 42 55, 34 51 C 27 47, 25 42, 30 38 Z" />
      <path d="M56 58 C 64 53, 73 58, 71 66 C 69 73, 58 75, 54 68 C 51 64, 52 60, 56 58 Z" />
    </g>

    {/* one bloom per bed, plus one over the horizon */}
    <g {...filled('var(--blush-400)')}>
      {BLOOMS.map((bloom) =>
        [0, 72, 144, 216, 288].map((angle) => (
          <path
            key={`${bloom.x}-${angle}`}
            d={PETAL}
            transform={`translate(${bloom.x} ${bloom.y}) rotate(${angle}) scale(${bloom.scale})`}
          />
        ))
      )}
    </g>
  </svg>
)

export default Globe
