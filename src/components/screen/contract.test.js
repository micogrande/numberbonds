import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * The screen contract, enforced by reading the CSS. (PLAN 3.3)
 *
 * Plain node, the existing vitest runner, no new dependency and no browser. Be
 * honest about what it is: **it would not have caught the bug that prompted all
 * of this.** No amount of grepping tells you that five 96px cards do not fit in
 * 554px. `npm run test:layout` is what sees that.
 *
 * What this catches is the CAUSE recurring, which is a different and much
 * cheaper job. The reported defect was not one screen being too tall; it was
 * five screens each declaring their own `height: 100%` under one global
 * `body { overflow: hidden }`, so no single file was wrong and no single file
 * could be fixed. The moment a second file has an opinion about overflow or
 * about the height of a screen, that arrangement is back and nobody notices for
 * a year.
 *
 * Every exception below is NAMED, with the reason. If you are adding a sixth,
 * you are probably about to reintroduce the bug.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SRC = join(ROOT, 'src')

/** The two files that together ARE the app shell. Nothing else may be. */
const SHELL = ['src/index.css', 'src/components/screen/Screen.module.css']

/**
 * `.layer` is the ambient butterfly/hill layer: `position: absolute; inset: 0`
 * inside the screen, clipping its own decoration so a butterfly cannot fly off
 * the page. It contains no controls and takes no taps.
 */
const OVERFLOW_ALLOWED = [...SHELL, 'src/components/garden/Ambient.module.css']

/**
 * `vh` is a viewport unit and this app's defect was a viewport-height defect, so
 * every remaining use is listed by name with what it is for. All of them size a
 * DECORATION or a piece of CHROME against the device, which is legitimate — PLAN
 * 3.7's "always the same pixel" is a promise about the phone, not about a slot.
 * None of them sizes a screen.
 *
 * This list should get shorter, never longer. A new file reaching for `vh` fails
 * here and has to argue its case in a comment first.
 */
const VH_ALLOWED = new Map([
  ['src/index.css', 'the body shell: height 100vh as the pre-2022 fallback under 100svh'],
  ['src/components/screen/Screen.module.css', 'the screen shell, same fallback'],
  ['src/styles/variables.css', '--gate-size: the one way home, sized against the device on purpose'],
  ['src/components/CategoryCard.module.css', 'the illustration pebble and its gap — decoration'],
  ['src/components/SleepingSlot.module.css', 'the sleeping motif and its gap — decoration'],
  ['src/components/garden/Ambient.module.css', 'butterfly flight paths and the hills — decoration'],
  ['src/screens/HomeScreen.module.css', 'the welcome band, the bunny and the grid gap'],
])

/** Comments are prose about the bug and would otherwise trip every rule. */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

function cssFiles() {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.css')) out.push(full)
    }
  }
  walk(SRC)
  return out.map((full) => ({
    path: full.slice(ROOT.length + 1).replaceAll('\\', '/'),
    css: stripComments(readFileSync(full, 'utf8')),
  }))
}

const FILES = cssFiles()

/** Every `prop: value` declaration in a file, as `prop:value` with its line. */
function declarations(file) {
  return file.css
    .split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => line.includes(':'))
}

const offenders = (predicate, only = () => true) =>
  FILES.filter((f) => only(f.path)).flatMap((f) =>
    declarations(f)
      .filter(({ line }) => predicate(line, f.path))
      .map(({ line, n }) => `${f.path}:${n}  ${line}`)
  )

describe('the screen contract', () => {
  it('gives `overflow` to the shell and to the ambient layer, and to nobody else', () => {
    // Overflow is how content gets destroyed. Exactly three files decide what
    // happens when something does not fit: the body (never scrolls), the content
    // region (always may), and the decoration layer (clips its own butterflies).
    expect(offenders((line) => /(^|[\s;{])overflow(-[xy])?\s*:/.test(line), (p) => !OVERFLOW_ALLOWED.includes(p))).toEqual([])
  })

  it('gives the height of a SCREEN to the shell, and to nobody else', () => {
    // `height: 100%` on a screen root, under a global `overflow: hidden`, is the
    // exact arrangement that clipped the last activity card away with no way to
    // reach it. A component sizing itself is fine; a screen sizing itself is not.
    const isScreenHeight = (line) =>
      /(^|[\s;{])(min-|max-)?(height|block-size)\s*:\s*[^;]*\b(100%|100vh|100dvh|100svh|100lvh)/.test(line)
    expect(offenders(isScreenHeight, (p) => !SHELL.includes(p) && p.startsWith('src/screens/'))).toEqual([])
  })

  it('bans `dvh` outright', () => {
    // On a page whose document never scrolls, the mobile toolbar is never given
    // a reason to retract, so dvh is pinned to the small viewport and computes
    // the identical number to svh — with a style recalculation on every frame of
    // a toolbar animation that can never change anything. It is svh with extra
    // machinery, and the comment it replaced taught the opposite.
    expect(offenders((line) => /\d(\.\d+)?dvh\b/.test(line))).toEqual([])
  })

  it('bans `position: fixed`', () => {
    // A fixed element floats OVER content instead of reserving space, which is
    // how a chrome bar ends up sitting on a card. Safari 26 also samples the
    // background of fixed and sticky elements near the viewport edges — including
    // invisible ones — to tint its own toolbar, so a full-bleed fixed layer would
    // turn the browser chrome sage green.
    expect(offenders((line) => /(^|[\s;{])position\s*:\s*fixed/.test(line))).toEqual([])
  })

  it('keeps every remaining viewport unit on the named list', () => {
    const unlisted = FILES.filter((f) => !VH_ALLOWED.has(f.path)).flatMap((f) =>
      declarations(f)
        .filter(({ line }) => /\d(\.\d+)?(vh|svh|lvh|vmin|vmax)\b/.test(line))
        .map(({ line, n }) => `${f.path}:${n}  ${line}`)
    )
    expect(unlisted).toEqual([])
  })

  it('has a reason written down for every file on that list', () => {
    for (const [, reason] of VH_ALLOWED) expect(reason.length).toBeGreaterThan(20)
  })

  it('keeps every screen module out of the layout business entirely', () => {
    // The positive form of the rule: a file under src/screens/ describes what a
    // screen CONTAINS. Screen.module.css decides how much room it gets and what
    // happens when there is not enough.
    const bad = /(^|[\s;{])(overflow(-[xy])?|position\s*:\s*fixed)/
    expect(offenders((line) => bad.test(line), (p) => p.startsWith('src/screens/'))).toEqual([])
  })
})

describe('the viewport meta', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8')

  it('carries viewport-fit=cover, without which every safe-area token is dead', () => {
    // `env(safe-area-inset-*)` returns 0 on every device — notch or not — unless
    // this key is present. styles/variables.css defines four of those tokens and
    // Screen.module.css consumes all four; without the key they are decoration
    // that looks implemented.
    expect(html).toMatch(/viewport-fit=cover/)
  })

  it('does NOT carry interactive-widget, and says why', () => {
    // It controls layout when the on-screen keyboard opens. No <input> exists
    // anywhere in this tree (eslint enforces it, AGENTS.md), so no keyboard can
    // appear, and Safari does not implement the key at all. The comment in
    // index.html exists so nobody "fixes" the omission.
    expect(html).not.toMatch(/content="[^"]*interactive-widget/)
    expect(html).toMatch(/interactive-widget`? is DELIBERATELY ABSENT/)
  })
})
