import React from 'react'

import { OUTLINE, PETAL, filled } from './strokes'

/**
 * A terracotta pot with one unopened bud. (PLAN 3.6)
 *
 * > A sleeping slot has no white face and no slab — just a terracotta pot with
 * > the bunny curled asleep beside it and one unopened bud in that category's
 * > reserved tint, sitting directly on the page.
 *
 * The bud is three petals folded over each other rather than a flower: closed,
 * but visibly a flower-to-be. That is the honest version of "later" — nothing
 * is broken, nothing is locked, it has simply not opened yet.
 *
 * `tint` is the category's reserved colour and is the ONLY thing that differs
 * between the five sleeping slots, so the row of them reads as five different
 * things asleep rather than five copies of one placeholder.
 *
 * Three fills — pot, rim, bud. There is no leaf on the stem, and that is not an
 * oversight: a leaf would have been a fourth (PLAN 3.5).
 *
 * @param {Object} props
 * @param {string} props.tint  A `var(--token)` from CATEGORY_TINTS.
 */
const Pot = ({ className, tint }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    {/* stem, drawn first so the soil and rim cover where it goes in */}
    <path d="M50 62 Q 44 50 50 42" {...OUTLINE} />

    {/* the bud: three petals folded together, in this category's tint */}
    <g {...filled(tint)}>
      <path d={PETAL} transform="translate(50 44) rotate(-12) scale(0.72)" />
      <path d={PETAL} transform="translate(50 44) rotate(12) scale(0.72)" />
      <path d={PETAL} transform="translate(50 44) scale(0.64)" />
    </g>

    {/* the sepals holding it closed */}
    <g {...OUTLINE}>
      <path d="M50 45 C 43 41, 40 34, 41 28" />
      <path d="M50 45 C 57 41, 60 34, 59 28" />
    </g>

    {/* soil, mostly hidden behind the rim: a warm sliver so the pot is not two
        pale shapes on a pale page */}
    <ellipse cx="50" cy="62" rx="27" ry="6" {...filled('var(--bark)')} />

    {/* Body and rim are the SAME terracotta. The ink line between them is what
        makes the rim a rim — a darker rim band read as a lampshade at 60px. */}
    <path
      d="M25 70 L75 70 L70 88 Q 68 93 62 93 L38 93 Q 32 93 30 88 Z"
      {...filled('var(--sand)')}
    />
    <rect x="19" y="58" width="62" height="14" rx="5" {...filled('var(--sand)')} />
  </svg>
)

export default Pot
