/**
 * Roman numerals — the activity module. (PLAN 2.2)
 *
 * What `manifest.load()` resolves to, and the only file in this folder that
 * touches both halves of the app: the pure engine and the React renderer. Two
 * re-exports on purpose — an ActivityModule is `{ generate, Prompt }` and
 * nothing else, so there is nowhere here for logic to accumulate.
 *
 * This is also the code-splitting boundary. Nothing above it imports this file
 * statically: the registry holds `() => import('./index.js')`, so the home
 * screen can list every activity in the app without pulling this renderer,
 * framer-motion or the distractor ladder into the first chunk she downloads.
 *
 * No `grade` export. Every answer here is a number — the value of the numeral —
 * and `===` after coercion is the whole of the grading (PLAN 2.4). The seam
 * exists for the clock's composite draft, not for this, and
 * `assertActivityModule` refuses a module that exports one.
 */

export { generate } from './romanEngine'
export { default as Prompt } from './GlyphPrompt'
