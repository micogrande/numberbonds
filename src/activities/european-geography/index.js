/**
 * European geography — the activity module. (WORLD.md)
 *
 * One option today (capitals). The find-on-map option is a second option id on
 * the same manifest when its geometry exists, so it will not disturb any high
 * score set on this one.
 */

import { generate } from './geoEngine'

export { generate }
export { default as Prompt } from './CapitalPrompt'

export const describe = (question) => question.prompt.text
