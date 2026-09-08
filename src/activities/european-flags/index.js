/**
 * European flags — the activity module. (WORLD.md)
 *
 * What `manifest.load()` resolves to: a pure generator and a renderer, and
 * nothing else. This file is the whole of what the shell knows about flags.
 */

import { generate } from './flagEngine'

export { generate }
export { default as Prompt } from './FlagPrompt'

/** Plain text for the aria-live region and for readable test failures. */
export const describe = (question) => question.prompt.text
