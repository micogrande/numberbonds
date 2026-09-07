import React from 'react'

import { OUTLINE, filled } from './strokes'

/** The five flags, hung along the string. Points computed off the same curve. */
const FLAGS = [
  { x: 11.6, y: 30.7, fill: 'var(--blush-400)' },
  { x: 30.8, y: 36.9, fill: 'var(--butter-400)' },
  { x: 50, y: 39, fill: 'var(--sage-400)' },
  { x: 69.2, y: 36.9, fill: 'var(--blush-400)' },
  { x: 88.4, y: 30.7, fill: 'var(--butter-400)' },
]

/**
 * flags — bunting. (PLAN 3.5)
 *
 * A swag of five triangles on a string, which is what "flags" looks like in a
 * garden rather than in an atlas. The five hang points are the quadratic the
 * string is drawn with, sampled at t = 0.1/0.3/0.5/0.7/0.9, so a flag sits ON
 * the line instead of near it.
 *
 * Three fills, alternating, and no flag is a real national flag — this is the
 * category's sign, not a preview of its content.
 */
const Bunting = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    {/* the two posts the string is tied to */}
    <path d="M6 22 L6 78" {...OUTLINE} />
    <path d="M94 22 L94 78" {...OUTLINE} />

    <path d="M6 26 Q50 52 94 26" {...OUTLINE} />

    {FLAGS.map((flag) => (
      <path
        key={flag.x}
        d={`M${flag.x - 9} ${flag.y - 1} L${flag.x + 9} ${flag.y - 1} L${flag.x} ${flag.y + 22} Z`}
        {...filled(flag.fill)}
      />
    ))}
  </svg>
)

export default Bunting
