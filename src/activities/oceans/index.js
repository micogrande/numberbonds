/** Oceans and seas — the activity module. (WORLD.md) */

import { generate } from './oceansEngine'

export { generate }
export { default as Prompt } from './CluePrompt'

export const describe = (question) => question.prompt.text
