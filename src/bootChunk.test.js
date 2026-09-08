import { readFileSync } from 'node:fs'
import { CATEGORIES } from './activities/categories'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * What is in the first chunk she downloads.
 *
 * Two comments in this codebase used to justify a design decision with a claim
 * about the boot chunk, and one of them was false by the time it was read:
 *
 *   `input/ChoiceInput.jsx`   "Importing framer-motion here put 115kB of it into
 *                             the FIRST chunk she downloads" — true when it was
 *                             written, and false the moment the home screen's
 *                             `CategoryCard` imported framer-motion, since from
 *                             then on the whole library was in that chunk
 *                             whatever this adapter did.
 *   `garden/motifs.js`        five drawings that render nowhere, imported
 *                             statically, parsed on every cold load.
 *
 * A comment cannot notice that the world moved under it. This file can. It walks
 * the STATIC import graph from `main.jsx` — the same edges a bundler follows
 * into the entry chunk, stopping where a dynamic `import()` starts a new one —
 * and states what may and may not be found there.
 *
 * It is the module graph, not the bundle: no bundler runs in a node test. That
 * is the right granularity anyway, because "is it in the boot chunk" is decided
 * by whether an edge is static, and this asserts exactly that.
 */

const SRC = dirname(fileURLToPath(import.meta.url))
const ENTRY = resolve(SRC, 'main.jsx')

/** Extensions tried for a relative specifier with none, in order. */
const EXTENSIONS = ['', '.js', '.jsx', '/index.js', '/index.jsx']

/**
 * The import/re-export statements in one file, one string each, with a
 * multi-line brace list folded back onto a single line.
 *
 * Line-anchored, so prose that happens to contain the word "import" is not a
 * statement: every comment line in this repo begins with `*`, `//` or `/*`. A
 * dynamic `import(` is skipped by the same rule that finds a static one — the
 * static form requires whitespace or a quote after the keyword and the dynamic
 * form has a bracket — which is the whole point: a dynamic import is where the
 * boot chunk ends.
 *
 * @param {string} source
 * @returns {string[]}
 */
function importStatements(source) {
  const lines = source.split(/\r?\n/)
  const statements = []

  const braces = (text) => (text.match(/\{/g) ?? []).length - (text.match(/\}/g) ?? []).length

  for (let index = 0; index < lines.length; index++) {
    const first = lines[index].trim()

    const isImport = /^import[\s'"{*]/.test(first)
    const isReExport = /^export\s*[{*]/.test(first)
    if (!isImport && !isReExport) continue

    let statement = first
    let depth = braces(first)
    let cursor = index

    // `import {\n  A,\n  B,\n} from './x'` — keep going until the list closes.
    while (depth > 0 && cursor + 1 < lines.length && cursor - index < 50) {
      cursor += 1
      statement += ` ${lines[cursor].trim()}`
      depth += braces(lines[cursor])
    }

    index = cursor
    statements.push(statement)
  }

  return statements
}

/**
 * The module specifier a statement names, or null for one that names none
 * (`export { a, b }` re-exports local bindings and reaches no other file).
 *
 * @param {string} statement
 * @returns {string|null}
 */
function specifierOf(statement) {
  const withFrom = statement.match(/\bfrom\s*['"]([^'"]+)['"]/)
  if (withFrom) return withFrom[1]

  const sideEffect = statement.match(/^import\s*['"]([^'"]+)['"]/)
  return sideEffect ? sideEffect[1] : null
}

/**
 * A relative specifier as a path on disk, or null if nothing is there.
 *
 * @param {string} fromFile
 * @param {string} specifier
 * @returns {string|null}
 */
function resolveRelative(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier)

  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`

    try {
      readFileSync(candidate)
      return candidate
    } catch {
      // Not this one.
    }
  }

  return null
}

/**
 * Everything the entry pulls in without crossing a dynamic import.
 *
 * @returns {{ files: Set<string>, packages: Set<string>, unresolved: string[] }}
 */
function walkBootChunk() {
  const files = new Set()
  const packages = new Set()
  const unresolved = []
  const queue = [ENTRY]

  while (queue.length > 0) {
    const file = queue.pop()
    if (files.has(file)) continue
    files.add(file)

    // A stylesheet is a leaf: it reaches no JavaScript.
    if (file.endsWith('.css')) continue

    for (const statement of importStatements(readFileSync(file, 'utf8'))) {
      const specifier = specifierOf(statement)
      if (specifier === null) continue

      if (!specifier.startsWith('.')) {
        // A bare specifier: react, framer-motion, lucide-react, canvas-confetti.
        packages.add(specifier.split('/')[0])
        continue
      }

      const target = resolveRelative(file, specifier)
      if (target === null) unresolved.push(`${relative(SRC, file)} → ${specifier}`)
      else queue.push(target)
    }
  }

  return { files, packages, unresolved }
}

const BOOT = walkBootChunk()

/** Is this source file reached without crossing a dynamic import? */
const inBootChunk = (path) => BOOT.files.has(resolve(SRC, path))

describe('the walk itself', () => {
  it('resolves every relative import it meets', () => {
    // A specifier this cannot resolve is a hole in the graph, and a hole makes
    // every "is not in the boot chunk" assertion below vacuously true.
    expect(BOOT.unresolved).toEqual([])
  })

  it('starts where the browser starts and finds the app', () => {
    expect(inBootChunk('main.jsx')).toBe(true)
    expect(inBootChunk('app/App.jsx')).toBe(true)
    expect(inBootChunk('app/Shell.jsx')).toBe(true)
    expect(inBootChunk('screens/HomeScreen.jsx')).toBe(true)
    expect(BOOT.files.size).toBeGreaterThan(20)
  })

  it('stops at a dynamic import, or it is measuring nothing', () => {
    // Every activity is behind `manifest.load()`, which is a dynamic import.
    // If these ever appear, the walk has started following `import()` and every
    // assertion in this file has quietly stopped meaning anything.
    expect(inBootChunk('activities/number-bonds/bondEngine.js')).toBe(false)
    expect(inBootChunk('activities/number-bonds/BondPrompt.jsx')).toBe(false)
    expect(inBootChunk('activities/arithmetic/arithmeticEngine.js')).toBe(false)
    expect(inBootChunk('activities/roman-numerals/romanEngine.js')).toBe(false)
  })
})

describe('framer-motion is already there, whatever any one file decides', () => {
  it('arrives with the home screen, which is the first thing she sees', () => {
    // PLAN 3.4 gives the category card a release spring, so `CategoryCard`
    // imports framer-motion; `HomeScreen` imports `CategoryCard`; `Shell`
    // imports `HomeScreen`. There is no dynamic import anywhere on that chain
    // and there should not be — the home screen must paint on first frame.
    expect(inBootChunk('components/CategoryCard.jsx')).toBe(true)
    expect(BOOT.packages.has('framer-motion')).toBe(true)
  })

  it('so the input adapters cannot change what she downloads by avoiding it', () => {
    // `input/ChoiceInput.jsx` used to justify hand-rolled CSS animation with
    // "importing framer-motion here would put 115kB into the FIRST chunk". The
    // adapter really is eagerly reachable — `manifestSchema` imports the input
    // registry, and every manifest is loaded at boot — but the library is in
    // that chunk either way, so the bundle can no longer be the reason. Measured
    // at the time of writing: the entry chunk is 362.43 kB with it and 246.30 kB
    // without, i.e. framer-motion is 116 kB of it (38 kB gzipped) and the home
    // screen is already paying all of it.
    expect(inBootChunk('input/ChoiceInput.jsx')).toBe(true)
    expect(inBootChunk('input/inputRegistry.js')).toBe(true)
    expect(inBootChunk('activities/manifestSchema.js')).toBe(true)
  })
})

/** The drawing each slot uses, by file name. PLAN 3.5 names all six by hand. */
const MOTIF_FILES = Object.freeze({
  numbers: 'Strawberries',
  flags: 'Bunting',
  geography: 'Hedgehog',
  continents: 'Globe',
  oceans: 'Pond',
  clock: 'Sunflower',
})

describe('a drawing nothing renders is not in the boot chunk', () => {
  it('keeps the motif of the slot she opens most', () => {
    expect(inBootChunk('components/garden/Strawberries.jsx')).toBe(true)
  })

  // DERIVED, NOT LISTED. Waking a category used to mean editing this file, and a
  // hand-kept list of "asleep" slots is wrong the moment one ships — it failed
  // exactly that way twice, for flags and then geography. The rule has never
  // changed: a drawing belongs in the boot chunk if and only if the home screen
  // actually draws it. So ask the categories.
  //
  // A sleeping slot draws a pot and a curled bunny (PLAN 3.6) and never looks in
  // CATEGORY_MOTIFS, so its motif renders nowhere; statically imported it would
  // still be parsed on every cold load of her phone, for a picture that cannot
  // appear until its category ships.
  it.each(CATEGORIES.map((category) => [category.id, MOTIF_FILES[category.id], !category.asleep]))(
    '%s: motif in the boot chunk is %s',
    (id, drawing, awake) => {
      expect(
        inBootChunk(`components/garden/${drawing}.jsx`),
        awake
          ? `${id} is awake, so ${drawing} is painted on first frame and must ship eagerly`
          : `${id} renders nowhere yet, so ${drawing} must stay behind a dynamic import`
      ).toBe(awake)
    }
  )

  it('still ships what a sleeping slot really does draw', () => {
    expect(inBootChunk('components/SleepingSlot.jsx')).toBe(true)
    expect(inBootChunk('components/garden/Pot.jsx')).toBe(true)
    expect(inBootChunk('components/garden/Bunny.jsx')).toBe(true)
  })
})
