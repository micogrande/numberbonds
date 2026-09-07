import React from 'react'

import { OUTLINE, PETAL, LEAF, filled } from './strokes'

/** Twelve petals, twelve hours. She will notice eventually. */
const PETAL_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]

/**
 * clock — a sunflower whose face is a dial. (PLAN 3.5)
 *
 * > because sunflowers follow the sun.
 *
 * Twelve petals for twelve hours, and the seed head is the dial. The hands are
 * set at ten past ten, which is the pose a clock is drawn in everywhere and
 * therefore the one that says "clock" fastest.
 *
 * Three fills — petals, face, leaf. The hands and ticks are cream STROKES on
 * the bark face rather than a fourth fill; cream on `--bark` measures 4.94:1,
 * so they are legible marks and not a texture.
 */
const Sunflower = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    {/* stem and one leaf */}
    <path d="M50 62 Q 54 78 50 94" {...OUTLINE} />
    <path d={LEAF} transform="translate(52 78) rotate(18) scale(0.85)" {...filled('var(--sage-400)')} />

    <g {...filled('var(--butter-400)')}>
      {PETAL_ANGLES.map((angle) => (
        <path key={angle} d={PETAL} transform={`translate(50 44) rotate(${angle}) scale(0.62)`} />
      ))}
    </g>

    <circle cx="50" cy="44" r="17" {...filled('var(--bark)')} />

    {/* the dial: four ticks and two hands, at ten past ten */}
    <g
      stroke="var(--cream-200)"
      strokeWidth={3.5}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      fill="none"
    >
      <path d="M50 32 L50 36" />
      <path d="M62 44 L58 44" />
      <path d="M50 56 L50 52" />
      <path d="M38 44 L42 44" />
      <path d="M50 44 L41 38" />
      <path d="M50 44 L56 36" />
    </g>
  </svg>
)

export default Sunflower
