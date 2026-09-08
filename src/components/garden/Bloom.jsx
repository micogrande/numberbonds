import React from 'react'

/**
 * One flower on the vine — a task on the day's list. (GOALS.md section 1)
 *
 * Two states and no others: a closed bud before she finishes that task, an open
 * flower after. There is deliberately no third state for "started" or "half
 * done", because a session either finished or it did not, and a flower that is
 * ajar would be a promise the data cannot keep.
 *
 * ── WHY A BUD RATHER THAN AN EMPTY SLOT ─────────────────────────────────────
 *
 * The bud is what makes the vine readable as a *plan* rather than a score. An
 * empty slot says "you have nothing"; a bud says "there is something here that
 * has not opened yet", which is the same information without the deficit. It is
 * also why the bud is drawn in the same green as the stem and not in grey:
 * greying it would say broken, and GOALS.md is explicit that nothing on this
 * screen may read as a reproach.
 *
 * House drawing rules (PLAN 3.5): flat fills, one outline, 3px sage stroke to
 * match GrassLine rather than the motifs' 3.5px ink, `vector-effect:
 * non-scaling-stroke` so the line stays put at any rendered size.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {string} [props.className]
 * @param {React.CSSProperties} [props.style] Carries `--at`, its place on the rail.
 */
const Bloom = ({ open, className, style }) => (
  <svg
    className={className}
    style={style}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    {/* The stem is the same sage as the grass line it grows out of, so the
        flower reads as part of the vine rather than as a badge stuck on it. */}
    <path
      d="M12 22 L12 14"
      fill="none"
      stroke="var(--sage-500)"
      strokeWidth={3}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />

    {open ? (
      <g>
        {/* Five petals, blush, with a butter centre — the same three-fill
            vocabulary as the strawberry patch and the pond. */}
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse
            key={angle}
            cx={12}
            cy={6.4}
            rx={3.1}
            ry={4.4}
            fill="var(--blush-400)"
            transform={`rotate(${angle} 12 10.5)`}
          />
        ))}
        <circle cx={12} cy={10.5} r={2.7} fill="var(--butter-400)" />
      </g>
    ) : (
      // A closed bud: the same silhouette, still folded.
      <path
        d="M12 6.2 C 15.1 6.2 16.3 9 16.3 11 C 16.3 13.4 14.4 14.6 12 14.6 C 9.6 14.6 7.7 13.4 7.7 11 C 7.7 9 8.9 6.2 12 6.2 Z"
        fill="var(--sage-200)"
        stroke="var(--sage-500)"
        strokeWidth={2.4}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    )}
  </svg>
)

export default Bloom
