import React from 'react'

import { hill } from './strokes'

/**
 * The two sage hills at the bottom of the home screen. (PLAN 3.3)
 *
 * > Bottom: nothing interactive. Children mis-tap bottom-edge controls. Two
 * > overlapping sage hills bleed off the bottom edge, `pointer-events:none`.
 *
 * They are the reason the bottom edge of the page is worth nothing: there is
 * something there, so it does not read as unfinished, and there is nothing to
 * hit. `pointer-events: none` is set by the CSS that places this, so a card
 * whose bottom row overlaps a crest is still fully tappable through it.
 *
 * No outline. This is the only drawing in the garden without one — it is
 * ground, not a thing, and an ink line across the bottom of the page would read
 * as a border and cut the page in half.
 *
 * `preserveAspectRatio="none"` lets them stretch to any phone width. That is
 * safe here and nowhere else in this folder: there is no closed shape in it
 * whose proportions carry meaning, and no stroke to distort.
 */
const Hills = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 100 40"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <path d={hill(10)} fill="var(--sage-100)" />
    <path d={hill(22)} fill="var(--sage-200)" transform="translate(-14 0)" />
  </svg>
)

export default Hills
