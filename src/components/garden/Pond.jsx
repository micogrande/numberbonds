import React from 'react'

import { OUTLINE, LEAF, filled } from './strokes'

/** A lily pad: a disc with a wedge cut out of it, centred on the origin. */
const PAD = 'M0 0 L10.3 -6.2 A12 12 0 1 1 10.3 6.2 Z'

/**
 * oceans — a lily pond with one orange fish. (PLAN 3.5)
 *
 * One fish, not a shoal: a single thing to find is what makes a child look at a
 * picture twice. Its body is the LEAF primitive at 0.8, which is why it belongs
 * to the same hand as the strawberry calyx.
 *
 * Three fills — water, pads, fish. The orange is `--color-warning`, the app's
 * only warm ochre; a hex would have been a fourth colour outside the ramp and
 * a palette change would have left it behind (PLAN 3.5).
 */
const Pond = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <ellipse cx="50" cy="56" rx="40" ry="28" {...filled('var(--garden-sky)')} />

    {/* ripples */}
    <g {...OUTLINE}>
      <path d="M24 44 C 32 39, 42 39, 50 44" />
      <path d="M58 70 C 66 65, 74 65, 80 69" />
    </g>

    {/* the fish, mid-water */}
    <g transform="translate(34 58) rotate(-8)">
      <path d="M0 0 l -11 -8 l 0 16 Z" {...filled('var(--color-warning)')} />
      <path d={LEAF} transform="scale(0.8)" {...filled('var(--color-warning)')} />
      <circle cx="19" cy="-1" r="3.2" fill="var(--color-text)" />
    </g>

    {/* two pads, one near and one far. A third fill and no more: the flower a
        pond wants would have been a fourth, and the house rule is three. */}
    <g {...filled('var(--sage-400)')}>
      <path d={PAD} transform="translate(70 44) rotate(150)" />
      <path d={PAD} transform="translate(30 76) rotate(-30) scale(0.8)" />
    </g>
  </svg>
)

export default Pond
