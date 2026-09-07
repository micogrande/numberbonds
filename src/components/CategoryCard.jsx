import React, { Suspense } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import styles from './CategoryCard.module.css'
import { CATEGORY_MOTIFS } from './garden/motifs'

/**
 * One awake category on the home screen. (PLAN 3.4)
 *
 * > The whole card is the button. No nested targets, nothing she can hit by
 * > accident that does something different.
 *
 * ── THE PRESS, AND WHY IT IS SPLIT IN TWO ───────────────────────────────────
 *
 * PLAN 3.4: "The depress fires on `:active` in pure CSS so there is zero JS
 * latency — a response later than ~100ms reads to a six-year-old as 'it didn't
 * work' and produces a second tap. framer-motion handles only the release
 * spring."
 *
 * Taken literally, both halves want to write `transform`, and framer-motion
 * writes it as an inline style — which beats any CSS rule, including `:active`.
 * So they are given different elements AND different properties: the button
 * owns `translateY` + the slab shadow in CSS, and this inner span owns `scale`
 * in framer-motion. Neither can clobber the other, the depress is on the
 * pointerdown frame, and the release still springs.
 *
 * Under reduced motion the scale is simply not requested, and the CSS turns the
 * press into a background-colour flood instead (PLAN 3.4). Feedback never
 * disappears; only motion does.
 *
 * ── THE SLAB ────────────────────────────────────────────────────────────────
 *
 * It is not decoration. `--color-surface` #FFFDF8 on `--color-bg` #FBF8F1
 * measures 1.04:1 — I checked — so without the slab a card is defined by a soft
 * shadow alone and vanishes on a cheap panel or in sunlight. The 6px of solid
 * `--slab` under the card is the edge that survives both.
 *
 * @param {Object} props
 * @param {{ id: string, title: string }} props.category
 * @param {number} props.index  Position in the grid; picks the pebble silhouette.
 * @param {() => void} props.onOpen
 */
const CategoryCard = ({ category, index, onOpen }) => {
  const reduced = useReducedMotion()
  const Motif = CATEGORY_MOTIFS[category.id] ?? null

  return (
    <button
      type="button"
      className={styles.card}
      // The per-category slab colour hangs off this (PLAN 3.1: "--slab is
      // overridden per category and the shadow re-resolves, because custom
      // properties substitute at computed-value time. Shipping a new category
      // is two properties, not a new rule.")
      data-category={category.id}
      // Three pebble silhouettes, rotated, so no two neighbours in the grid
      // have the same outline (PLAN 3.4).
      data-variant={index % 3}
      onClick={onOpen}
    >
      <motion.span
        className={styles.inner}
        whileTap={reduced ? undefined : { scale: 0.965 }}
        transition={{ type: 'spring', stiffness: 520, damping: 24 }}
      >
        {/* The motif of a category that is still asleep is behind a dynamic
            import (see `garden/motifs.js`), so it needs a boundary of its own.
            `null` rather than a spinner, and HERE rather than relying on the
            app's: suspending up there would drop the whole home screen to
            "Getting ready…" to fetch one drawing. The pebble is already the
            right shape and the right colour; the picture arrives into it. */}
        <span className={styles.pebble}>
          <Suspense fallback={null}>
            {Motif ? <Motif className={styles.motif} /> : null}
          </Suspense>
        </span>

        {/* She reads. The word says exactly which thing it is, and the picture
            is what makes the page scannable — they are not alternatives. */}
        <span className={styles.label}>{category.title}</span>
      </motion.span>
    </button>
  )
}

export default CategoryCard
