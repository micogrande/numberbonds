/**
 * Number Bonds — the activity module. (PLAN 2.2)
 *
 * What `manifest.load()` resolves to, and the only file in this folder that
 * touches both halves of the app: the pure engine and the React renderer. It is
 * two re-exports on purpose — an ActivityModule is `{ generate, Prompt }` and
 * nothing else, so there is nowhere here for logic to accumulate.
 *
 * This is also the code-splitting boundary. Nothing above it imports this file
 * statically: the registry holds `() => import('./index.js')`, so the home
 * screen can list every activity in the app without pulling a single renderer or
 * engine into the first chunk she downloads. `bootChunk.test.js` asserts it —
 * `bondEngine.js` and `BondPrompt.jsx` must not be reachable from `main.jsx`
 * without crossing an `import()`.
 *
 * It does NOT keep framer-motion out, and used to claim it did. PLAN 3.4 gives
 * the home screen's cards a release spring, so `components/CategoryCard.jsx`
 * imports framer-motion eagerly and the library is in the boot chunk before this
 * boundary is reached. What crosses it is this activity's own code, which is
 * still the point: five activities' worth of engines and prompts is real weight,
 * and none of it is downloaded to look at a menu.
 *
 * No `grade` export. Every answer here is a number and `===` after coercion is
 * the whole of the grading (PLAN 2.4) — the seam exists for the clock's
 * composite draft, not for this.
 */

export { generate } from './bondEngine'
export { default as Prompt } from './BondPrompt'
