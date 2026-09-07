/**
 * The six category slots. (PLAN 1, PLAN 3.3, PLAN 3.6)
 *
 * > Six category slots exist on the home screen from day one and never reorder.
 * > A six-year-old navigates by spatial memory; a grid that grows and reshuffles
 * > over months forces her to relearn the page every time.
 *
 * So this list is fixed at six from the first commit that has a home screen, and
 * `order` is the position she learns. **Numbers is pinned top-left and never
 * moves.** Adding a seventh category is a product decision about her screen, not
 * a tidy-up.
 *
 * Five of the six are **asleep**, which is a state, not a lock (PLAN 3.6): "A
 * padlock reads as a punishment or a paywall, and greyscale-at-40% makes five of
 * the six things on her screen look broken. Asleep is warmer and it is honest:
 * sleeping things wake up on their own schedule." Since she reads, the word does
 * real work — the home screen says the state as well as drawing it.
 *
 * Waking one up is: build the activities, add them to `registry.js`, and delete
 * the `asleep` flag here. `validateRegistry()` refuses a registry with an
 * activity filed under a sleeping category, because that activity would exist
 * with no way in.
 *
 * Titles are **lowercase** on purpose (PLAN 3.2) — a style choice that suits the
 * garden, not a literacy workaround.
 */

/**
 * @typedef {Object} Category
 * @property {string} id      Stable forever. `activity.categoryId` matches this.
 * @property {string} slug    URL segment: `#/c/numbers`.
 * @property {string} title   What she reads. Lowercase (PLAN 3.2).
 * @property {number} order   Position in the grid. Never reordered.
 * @property {boolean} asleep Built later. Held in place for spatial memory.
 */

/** @type {readonly Category[]} */
export const CATEGORIES = Object.freeze(
  [
    { id: 'numbers', slug: 'numbers', title: 'numbers', order: 1, asleep: false },
    { id: 'flags', slug: 'flags', title: 'flags', order: 2, asleep: true },
    { id: 'geography', slug: 'geography', title: 'geography', order: 3, asleep: true },
    { id: 'continents', slug: 'continents', title: 'continents', order: 4, asleep: true },
    { id: 'oceans', slug: 'oceans', title: 'oceans', order: 5, asleep: true },
    { id: 'clock', slug: 'clock', title: 'clock', order: 6, asleep: true },
  ].map((category) => Object.freeze(category))
)

/**
 * The six, in the order she has learned. Sorted here rather than trusted to the
 * literal above, so an edit that adds one out of order still lands where its
 * `order` says.
 *
 * @returns {Category[]}
 */
export function categoriesInOrder() {
  return [...CATEGORIES].sort((a, b) => a.order - b.order)
}

/**
 * @param {string} slug
 * @returns {Category|null}
 */
export function getCategoryBySlug(slug) {
  return CATEGORIES.find((category) => category.slug === slug) ?? null
}
