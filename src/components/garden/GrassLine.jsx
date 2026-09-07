import React from 'react'

/** Where the blades stand, in viewBox units across a 300-unit strip. */
const BLADES = [14, 33, 58, 96, 122, 151, 178, 205, 231, 262, 285]

/**
 * The hand-drawn grass baseline under the header. (PLAN 3.3)
 *
 * > A 3px hand-drawn grass baseline runs full width underneath, planting the
 * > header on the ground without a rule or a card.
 *
 * That sentence is the whole design: it does the job a `border-bottom` would do
 * and none of the harm. A 1px rule across a cream page reads as a form; a line
 * with grass growing out of it reads as ground, and the bunny above it is
 * standing on something.
 *
 * 3px and sage rather than the motifs' 3.5px ink, deliberately — it runs the
 * full width of the screen, and at ink weight it would be the loudest thing on
 * the page. `vector-effect: non-scaling-stroke` is what lets it stretch to any
 * width without the line thickening, which is the only reason
 * `preserveAspectRatio="none"` is safe here.
 */
const GrassLine = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 300 14"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <g
      fill="none"
      stroke="var(--sage-500)"
      strokeWidth={3}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    >
      <path d="M0 11 Q 38 7 75 11 T 150 11 T 225 11 T 300 11" />
      {BLADES.map((x, i) => {
        // Lean, height and direction all cycle on different periods, so eleven
        // blades never fall into a repeat she can see.
        const lean = i % 2 ? 3 : -3
        const tall = i % 3 === 0 ? 9 : 6

        return <path key={x} d={`M${x} 10 q ${lean * 0.4} ${-tall * 0.6} ${lean} ${-tall}`} />
      })}
    </g>
  </svg>
)

export default GrassLine
