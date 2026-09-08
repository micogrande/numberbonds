/**
 * Which flags a child actually confuses. (WORLD.md section 2)
 *
 * The distractor rule this project set with Roman numerals: **a pure function of
 * the answer, deterministic, every distractor targeting a named real confusion.**
 * Randomness enters only in which cards are sampled and where the buttons go, so
 * every distractor set is assertable against an exact array.
 *
 * A random wrong country is worthless. If the answer is Norway and the other
 * three buttons are Portugal, Greece and Turkey, she can score without looking at
 * the flag — the question has become "which of these is Scandinavian". Put Denmark
 * and Iceland beside it and she has to actually read the cross.
 */

import { CODES, FLAGS } from './flagData'

/** How many wrong answers each card carries. Four buttons, one right. */
export const DISTRACTOR_COUNT = 3

/**
 * Families of flags that genuinely look alike, most-confusable first within each.
 *
 * A code may appear in several families — Denmark is both a Nordic cross and a
 * plain cross on a solid field — and that is the point: the families overlap the
 * way real confusion does. Order inside a family matters, because it decides
 * which distractor is reached for first.
 *
 * Every entry is a real, documented mix-up rather than a guess: the Nordic
 * crosses differ only in colour; Netherlands and Luxembourg differ only in the
 * shade of one stripe; Monaco and Poland are the same two bands in the opposite
 * order; Slovenia, Slovakia and Russia are the same tricolour with different
 * arms; Romania and Chad are famously indistinguishable (Chad is not in Europe,
 * so Moldova stands in); Ireland and Italy differ only in one stripe.
 */
const FAMILIES = Object.freeze([
  ['dk', 'no', 'is', 'se', 'fi'], // Nordic crosses — the classic family
  ['se', 'fi', 'no', 'dk', 'is'],
  ['nl', 'lu', 'fr', 'ru'], // red/white/blue, horizontal vs vertical
  ['ru', 'si', 'sk', 'rs', 'hr'], // pan-Slavic white/blue/red with arms
  ['si', 'sk', 'ru', 'hr', 'rs'],
  ['ie', 'it', 'hu', 'bg'], // green/white tricolours
  ['it', 'ie', 'hu', 'bg'],
  ['at', 'lv', 'pl', 'mc'], // red and white bands
  ['pl', 'mc', 'at', 'lv'], // same two bands, opposite order
  ['mc', 'pl', 'at', 'lv'],
  ['ro', 'md', 'ad', 'be'], // blue/yellow/red verticals
  ['md', 'ro', 'ad', 'be'],
  ['be', 'de', 'ro', 'md'], // black/yellow/red
  ['ee', 'lv', 'lt'], // the Baltics, learned as a set and confused as one
  ['lt', 'ee', 'lv'],
  ['ge', 'gb-eng', 'ch', 'dk'], // crosses on a plain field
  ['gb-eng', 'ge', 'ch', 'gb'], // the England / UK distinction this app teaches
  ['gb', 'gb-eng', 'no', 'is'],
  ['ch', 'dk', 'ge', 'gb-eng'],
  ['bg', 'hu', 'it', 'ie'], // green/white/red horizontals
  ['hu', 'bg', 'it', 'ie'],
  ['ba', 'xk', 'cy', 'ua'], // blue fields with yellow devices
  ['xk', 'ba', 'cy', 'ee'],
  ['gr', 'fi', 'sm', 'ua'], // blue and white
  ['es', 'pt', 'me', 'ad'], // arms on warm fields
  ['pt', 'es', 'me', 'md'],
  ['al', 'mk', 'tr', 'ch'], // red fields with a central device
  ['mk', 'al', 'tr', 'me'],
  ['tr', 'al', 'mk', 'ch'],
  ['am', 'by', 'lt', 'bg'],
  ['va', 'sm', 'mt', 'cy'], // white-based, arms in one corner or centre
  ['sm', 'va', 'mt', 'gr'],
  ['ua', 'se', 'ee', 'ba'], // blue over yellow
  ['cz', 'ba', 'xk', 'sk'],
  ['li', 'ad', 'md', 'ro'],
  ['lv', 'at', 'pl', 'ee'],
  ['me', 'es', 'al', 'mk'],
  ['ad', 'ro', 'md', 'es'],
  ['mt', 'pl', 'va', 'sm'],
  ['cy', 'xk', 'ba', 'va'],
  ['by', 'am', 'lv', 'at'],
  ['az', 'tr', 'am', 'by'],
  ['hr', 'sk', 'si', 'rs'],
  ['rs', 'sk', 'si', 'me'],
  ['sk', 'si', 'ru', 'hr'],
  ['de', 'be', 'ro', 'lt'],
  ['fr', 'nl', 'lu', 'ru'],
  ['lu', 'nl', 'fr', 'ru'],
  ['no', 'is', 'dk', 'gb'],
  ['is', 'no', 'fi', 'dk'],
  ['fi', 'se', 'gr', 'is'],
  ['dk', 'ch', 'no', 'gb-eng'],
  ['ie', 'it', 'bg', 'hu'],
  ['pl', 'mc', 'mt', 'at'],
])

/**
 * Codes that look like `code`, best first, deduplicated across families.
 *
 * @param {string} code
 * @returns {string[]}
 */
function lookalikes(code) {
  const out = []

  for (const family of FAMILIES) {
    if (family[0] !== code) continue

    for (const other of family.slice(1)) {
      if (other !== code && FLAGS[other] && !out.includes(other)) out.push(other)
    }
  }

  // Families where the code is not the head still describe a real confusion.
  for (const family of FAMILIES) {
    if (!family.includes(code) || family[0] === code) continue

    for (const other of family) {
      if (other !== code && FLAGS[other] && !out.includes(other)) out.push(other)
    }
  }

  return out
}

/**
 * The three wrong buttons for one card. Pure, deterministic, no rng.
 *
 * Lookalikes first, in family order. When a pool is too small or too unlike to
 * supply three — the starter tier is only twelve flags — the backstop walks
 * outward from the answer's position in the canonical order, alternating before
 * and after, exactly as the Roman ladder's R6 does. Deterministic, and it can
 * always finish.
 *
 * @param {string} code   The answer.
 * @param {string[]} pool The codes this difficulty tier may use.
 * @returns {string[]} exactly DISTRACTOR_COUNT codes, distinct, never `code`
 */
export function getDistractors(code, pool) {
  if (!FLAGS[code]) throw new RangeError(`getDistractors(): unknown flag ${JSON.stringify(code)}`)

  const allowed = new Set(pool)
  const out = []

  const take = (candidate) => {
    if (out.length >= DISTRACTOR_COUNT) return
    if (candidate === code || out.includes(candidate)) return
    if (!allowed.has(candidate) || !FLAGS[candidate]) return
    out.push(candidate)
  }

  for (const other of lookalikes(code)) take(other)

  // Backstop: nearest in canonical order, alternating outward.
  const ordered = CODES.filter((c) => allowed.has(c))
  const home = ordered.indexOf(code)

  for (let step = 1; out.length < DISTRACTOR_COUNT && step <= ordered.length; step += 1) {
    take(ordered[home - step])
    take(ordered[home + step])
  }

  if (out.length < DISTRACTOR_COUNT) {
    throw new RangeError(
      `getDistractors(): pool of ${pool.length} is too small to give ${code} ` +
        `${DISTRACTOR_COUNT} distinct wrong answers.`
    )
  }

  return out
}

/**
 * The name on the button.
 *
 * Formal names throughout, with England present as its own card beside the
 * United Kingdom — the owner's decision, so the two teach the distinction by
 * sitting side by side rather than by the app correcting her.
 *
 * @param {string} code
 * @returns {string}
 */
export const nameOf = (code) => FLAGS[code].name
