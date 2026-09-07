/**
 * Arithmetic — the activity module. (PLAN 2.2)
 *
 * What `manifest.load()` resolves to — for BOTH `ADD` and `SUB`, which are two
 * activities sharing one engine and one renderer. PLAN 8: "Two activities
 * sharing `EquationPrompt` needs no machinery at all", so there is none: the
 * same `generate` deals both decks and is told which by `params.op`, and the
 * same `Prompt` draws both lines because the operator is already inside the
 * card.
 *
 * Two re-exports on purpose — an ActivityModule is `{ generate, Prompt }` and
 * nothing else, so there is nowhere here for logic to accumulate.
 *
 * This is also the code-splitting boundary. Nothing above it imports this file
 * statically: both manifests hold `() => import('./index.js')`, so the home
 * screen can list every activity in the app without pulling this renderer,
 * framer-motion or the card space into the first chunk she downloads. Both
 * manifests naming the same module is what makes addition and subtraction one
 * chunk rather than two.
 *
 * No `grade` export. Every answer here is a number and `===` after coercion is
 * the whole of the grading (PLAN 2.4) — the seam exists for the clock's
 * composite draft, not for this, and `assertActivityModule` refuses a module
 * that exports one.
 */

export { generate } from './arithmeticEngine'
export { default as Prompt } from './EquationPrompt'
