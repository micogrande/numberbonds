/** Continents — the activity module. (WORLD.md) */

import { generate } from './continentsEngine'

export { generate }
export { default as Prompt } from './PlacePrompt'

export const describe = (question) => question.prompt.text
