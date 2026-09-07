/**
 * The house rules of the garden, as code. (PLAN 3.5)
 *
 * > House rules so six drawings by one hand read as one family: max 3 flat
 * > fills plus one outline; outline #3E4A3A at 3.5px with `vector-effect:
 * > non-scaling-stroke`; nothing smaller than 6px at the smallest render size;
 * > built from ~7 shared primitives (petal, leaf, hill, berry, wing, ear,
 * > stem); the bunny gets two dot eyes and a blush oval, no mouth.
 *
 * Every motif in this folder imports `OUTLINE` rather than restating a stroke,
 * so "the line got thinner" is a one-line change here and not a hunt through
 * six files. The colour is `var(--color-text)`, which IS #3E4A3A — the outline
 * is the same moss ink the words are set in, which is most of why the drawings
 * and the labels look like they belong together.
 *
 * `vector-effect: non-scaling-stroke` is the load-bearing part: a motif is
 * drawn in a 100x100 box and rendered anywhere from 44px (a sleeping bud) to
 * 96px (a category card). Without it the line would be 1.5px on the small one
 * and 3.4px on the large one, and the family would fall apart across the grid.
 *
 * SIZE FLOOR. The smallest render is ~68px for a 100-unit box, so 6px is about
 * 8.8 units. No feature below is smaller than 8 units, and the ones that come
 * closest (strawberry seeds, bunny eyes) are drawn as chunky marks rather than
 * detail. If you add a motif, check its smallest mark against that number.
 */

/**
 * Spread onto any outlined path. Never set `stroke` or `strokeWidth` locally.
 * @type {Readonly<Object>}
 */
export const OUTLINE = Object.freeze({
  fill: 'none',
  stroke: 'var(--color-text)',
  strokeWidth: 3.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
})

/**
 * The same line, filled. For a shape that is both a colour and an outline —
 * which is most of them.
 *
 * @param {string} fill  A `var(--token)`. Never a hex; a palette change has to
 *                       re-colour everything at once (PLAN 3.5).
 * @returns {Object}
 */
export const filled = (fill) => ({ ...OUTLINE, fill })

/* ─── the seven primitives ──────────────────────────────────────────────────
   Each is a path in its own local space with its anchor at the origin, so a
   motif places it with `transform="translate(x y) rotate(d)"` and never
   re-derives the geometry. That is what makes a leaf on the hedgehog and a leaf
   on the strawberry the SAME leaf.
   ────────────────────────────────────────────────────────────────────────── */

/** An almond, 32 long and 18 across, tip at the origin pointing +x. */
export const LEAF = 'M0 0 C 8 -9, 24 -9, 32 0 C 24 9, 8 9, 0 0 Z'

/** A teardrop 28 tall, fat end up, stem end at the origin. */
export const PETAL = 'M0 0 C -10 -6, -11 -22, 0 -28 C 11 -22, 10 -6, 0 0 Z'

/** A strawberry: shoulders on the x axis, 34 across, hanging 34 below. */
export const BERRY =
  'M-17 0 C -17 -7, -8 -11, 0 -11 C 8 -11, 17 -7, 17 0 C 17 15, 6 30, 0 34 C -6 30, -17 15, -17 0 Z'

/** A bunny ear, 34 tall, base at the origin, leaning left. */
export const EAR = 'M0 0 C -8 -11, -9 -27, -2 -35 C 5 -28, 7 -11, 3 0 Z'

/** One butterfly wing, 28 across, hinge at the origin, opening up and right. */
export const WING = 'M0 0 C 10 -17, 27 -19, 29 -6 C 31 5, 16 11, 0 0 Z'

/**
 * A hill that bleeds off both sides of a 100-wide box and off the bottom.
 * @param {number} y  Height of the crest, in viewBox units from the top.
 * @param {number} [bottom] Where the fill closes off. Below the box on purpose.
 */
export const hill = (y, bottom = 120) =>
  `M-20 ${bottom} L-20 ${y + 12} C 10 ${y - 6}, 30 ${y - 10}, 52 ${y + 2} ` +
  `C 74 ${y + 13}, 96 ${y + 1}, 120 ${y - 5} L120 ${bottom} Z`

/**
 * A bowed stem. The bow is what stops six straight lines looking like a
 * diagram — nothing in this garden is drawn with a ruler.
 */
export const stem = (x1, y1, x2, y2, bow = 8) =>
  `M${x1} ${y1} Q${(x1 + x2) / 2 + bow} ${(y1 + y2) / 2} ${x2} ${y2}`
