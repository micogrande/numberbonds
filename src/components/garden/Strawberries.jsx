import React from 'react'

import { OUTLINE, BERRY, LEAF, filled, stem } from './strokes'

/**
 * numbers — a strawberry patch. (PLAN 3.5)
 *
 * > Chosen deliberately: strawberries are countable and the seeds give her
 * > something to count while she waits.
 *
 * So the seeds are not texture. There are exactly seven on the big berry and
 * three on the small one, drawn as chunky marks rather than specks, because a
 * child who counts them should get the same answer twice.
 *
 * Three fills — berry, calyx, seed — plus the one ink outline. Nothing here
 * knows it is on a card; the card supplies the pebble behind it.
 */
const Strawberries = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    {/* stems first, so the berries sit on top of where they join */}
    <path d={stem(38, 34, 33, 10, 6)} {...OUTLINE} />
    <path d={stem(72, 47, 78, 24, -5)} {...OUTLINE} />

    {/* the small berry, behind */}
    <g transform="translate(72 47) scale(0.72)">
      <path d={BERRY} {...filled('var(--blush-500)')} />
    </g>

    {/* the big berry */}
    <g transform="translate(38 34)">
      <path d={BERRY} {...filled('var(--blush-500)')} />
    </g>

    {/* seeds — seven, countable, 9 units long so they hold up at 68px */}
    <g
      stroke="var(--butter-200)"
      strokeWidth={3.5}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      fill="none"
    >
      <path d="M28 43 l 7 4" />
      <path d="M44 41 l 7 4" />
      <path d="M33 54 l 7 4" />
      <path d="M47 53 l 6 4" />
      <path d="M38 64 l 6 4" />
      <path d="M26 51 l 6 4" />
      <path d="M42 30 l 7 3" />

      <path d="M66 55 l 6 4" />
      <path d="M77 57 l 5 3" />
      <path d="M71 65 l 5 3" />
    </g>

    {/* calyx: the same LEAF the hedgehog and the pond are drawn with */}
    <g {...filled('var(--sage-400)')}>
      <path d={LEAF} transform="translate(38 32) rotate(200) scale(0.55)" />
      <path d={LEAF} transform="translate(38 32) rotate(262) scale(0.5)" />
      <path d={LEAF} transform="translate(38 32) rotate(338) scale(0.55)" />

      <path d={LEAF} transform="translate(72 45) rotate(205) scale(0.4)" />
      <path d={LEAF} transform="translate(72 45) rotate(330) scale(0.4)" />
    </g>
  </svg>
)

export default Strawberries
