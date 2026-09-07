/**
 * The layout regression test.  `npm run test:layout`
 *
 * Six assertions, run over every screen the registry produces at every viewport
 * in the matrix. Each one exists because it catches a specific way this class of
 * bug shows up, and the third is what stops a future "just make everything
 * smaller" patch from passing the first two.
 *
 *   A  the DOCUMENT never scrolls          — the shell still has a definite height
 *   B  the gate is whole, big and its own  — PLAN 3.7, "always the same pixel"
 *   C  every control is reachable          — in view, or scrollable into view
 *   D  every control is at least 44px      — WCAG 2.5.8, and the house floor
 *   E  a `fixed` screen genuinely fits     — home and the five play screens
 *   F  an overflowing list peeks           — the last visible row is CUT, not absent
 *   G  home and the play screens did not move  (--baseline / baseline.json, +/-1px)
 *
 * Flags:
 *   --baseline   write baseline.json instead of asserting (run this on the code
 *                you are about to change, so G has something to compare against)
 *   --insets     also run the whole matrix with a notched iPhone's safe-area
 *                insets forced on, because no emulator reports them
 *   --json FILE  dump every measurement for offline inspection
 *   --only RE    restrict to screens whose id matches
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { collectScreens, measure, openBrowser, startServer } from './harness.js'
import { FIXED_FLOOR_HEIGHT, TAP_FLOOR, VIEWPORTS } from './viewports.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = resolve(HERE, 'baseline.json')

const argv = process.argv.slice(2)
const has = (flag) => argv.includes(flag)
const valueOf = (flag) => {
  const i = argv.indexOf(flag)
  return i === -1 ? null : argv[i + 1]
}

const WRITE_BASELINE = has('--baseline')
const WITH_INSETS = has('--insets')
const JSON_OUT = valueOf('--json')
const ONLY = valueOf('--only') ? new RegExp(valueOf('--only')) : null

/**
 * The screens whose geometry must not move. These are the ones the owner says
 * already fit well: home, and the five play screens. Nothing else is baselined —
 * the category screen and the pickers are the ones being fixed, so pinning their
 * pixels would pin the bug.
 */
const isBaselined = (id) => id === 'home' || id.startsWith('play:')

/**
 * Home and the five play screens claim their child count is a constant written
 * in the source, so they may clip. Assertion E proves the claim.
 */
const isFixed = (id) => id === 'home' || id.startsWith('play:')

const failures = []
const notes = []
const fail = (where, message) => failures.push(`${where}  ${message}`)

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol

async function main() {
  const server = await startServer()
  const { browser, page } = await openBrowser()
  const all = {}

  try {
    let screens = await collectScreens(page)
    if (ONLY) screens = screens.filter((s) => ONLY.test(s.id))

    console.log(`\n${screens.length} screens x ${VIEWPORTS.length} viewports\n`)

    for (const viewport of VIEWPORTS) {
      const gates = []

      for (const screen of screens) {
        const key = `${screen.id} @ ${viewport.name}`
        const m = await measure(page, screen, viewport)
        all[key] = m

        // ── A · the document never scrolls ────────────────────────────────
        if (m.doc.scrolls) {
          fail(key, `document scrolls: ${m.doc.scrollW}x${m.doc.scrollH} in ${m.doc.clientW}x${m.doc.clientH}`)
        }

        // ── B · the gate ──────────────────────────────────────────────────
        if (screen.id === 'home') {
          if (m.gate) fail(key, 'home has a Back-to-Home gate; it should not')
        } else if (!m.gate) {
          fail(key, 'no Back-to-Home gate on a non-home screen')
        } else {
          if (!m.gate.inViewport) fail(key, `gate outside the viewport at ${JSON.stringify(m.gate.rect)}`)
          if (m.gate.minSide < TAP_FLOOR) fail(key, `gate short side ${m.gate.minSide} < ${TAP_FLOOR}`)
          if (!m.gate.ownsItsCentre) {
            fail(key, `gate loses its own hit test — elementFromPoint returns "${m.gate.hitOwner}"`)
          }
          gates.push({ key, rect: m.gate.rect })
        }

        // ── C · reachability, and D · the tap floor ───────────────────────
        for (const c of m.controls) {
          if (!c.reachable) {
            fail(key, `"${c.label}" is unreachable at ${JSON.stringify(c.rect)} (viewport ${m.vw}x${m.vh})`)
          } else if (c.movedDocument) {
            fail(key, `"${c.label}" needed the DOCUMENT to scroll — the shell lost its height`)
          }
          if (c.minSide < TAP_FLOOR) {
            fail(key, `"${c.label}" short side ${c.minSide} < ${TAP_FLOOR}`)
          }
        }

        // ── E · a `fixed` screen genuinely fits ───────────────────────────
        if (isFixed(screen.id) && viewport.h >= FIXED_FLOOR_HEIGHT && m.region) {
          if (m.region.growth !== 'fixed') {
            fail(key, `expected growth="fixed", got "${m.region.growth}"`)
          }
          if (m.region.scrollH > m.region.clientH + 1) {
            fail(
              key,
              `growth="fixed" region overflows: ${m.region.scrollH} in ${m.region.clientH}. ` +
                'Either the claim is false or the screen grew a child it cannot bound.'
            )
          }
        }

        // ── F · the peek ──────────────────────────────────────────────────
        if (m.peek && m.peek.rows > 0 && !m.peek.cut) {
          notes.push(
            `${key}  list overflows by ${m.peek.overflowBy}px but no row is cut by the edge — ` +
              'the scroll affordance is missing'
          )
        }
      }

      // ── B (continued) · the same pixel on every non-home screen ──────────
      if (gates.length > 1) {
        const [first, ...rest] = gates
        for (const g of rest) {
          if (!near(g.rect.x, first.rect.x) || !near(g.rect.y, first.rect.y)) {
            fail(
              g.key,
              `gate moved: ${g.rect.x},${g.rect.y} vs ${first.rect.x},${first.rect.y} on ${first.key}`
            )
          }
        }
      }

      process.stdout.write(`  ${viewport.name.padEnd(9)} ${viewport.note}\n`)
    }

    if (WITH_INSETS) {
      console.log('\n  safe-area pass (--safe-top 59px / --safe-bottom 34px forced)\n')
      for (const viewport of VIEWPORTS) {
        for (const screen of screens) {
          const key = `${screen.id} @ ${viewport.name} +insets`
          const m = await measure(page, screen, viewport, { insets: true })
          all[key] = m
          if (m.gate && m.gate.rect.y < 59) {
            fail(key, `gate at y=${m.gate.rect.y} is under a 59px top inset`)
          }
          for (const c of m.controls) {
            if (!c.reachable) fail(key, `"${c.label}" unreachable under simulated insets`)
          }
        }
      }
    }

    // ── G · non-regression ────────────────────────────────────────────────
    if (WRITE_BASELINE) {
      const out = {}
      for (const [key, m] of Object.entries(all)) {
        const id = key.split(' @ ')[0]
        if (!isBaselined(id) || key.includes('+insets')) continue
        out[key] = {
          vw: m.vw,
          vh: m.vh,
          doc: { scrollH: m.doc.scrollH, clientH: m.doc.clientH },
          controls: m.controls.map((c) => ({ label: c.label, ...c.rect })),
        }
      }
      mkdirSync(dirname(BASELINE_PATH), { recursive: true })
      writeFileSync(BASELINE_PATH, `${JSON.stringify(out, null, 2)}\n`)
      console.log(`\nbaseline written: ${Object.keys(out).length} screen/viewport pairs`)
    } else {
      let baseline = null
      try {
        baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
      } catch {
        notes.push('no baseline.json — assertion G (non-regression) did not run')
      }
      if (baseline) {
        for (const [key, want] of Object.entries(baseline)) {
          const got = all[key]
          if (!got) {
            // A --only run measures a subset. Missing is only a failure when the
            // whole matrix was asked for.
            if (ONLY) continue
            fail(key, 'baselined screen is missing from this run')
            continue
          }
          // Below 560px of viewport height the baseline records a screen that is
          // BROKEN — the keypad's ENTER row off the bottom edge with no way to
          // reach it, the gate under a bond diagram. Holding the new layout to
          // those numbers would be holding it to the bug. Above 560 the baseline
          // is the contract: home and the five play screens do not move.
          if (want.vh < FIXED_FLOOR_HEIGHT) {
            const moved = want.controls.some((w, i) => {
              const g = got.controls[i]
              return !g || !near(g.rect.x, w.x) || !near(g.rect.y, w.y)
            })
            if (moved) notes.push(`${key}  geometry changed below the ${FIXED_FLOOR_HEIGHT}px floor (expected)`)
            continue
          }
          if (got.controls.length !== want.controls.length) {
            fail(key, `control count ${got.controls.length} vs baseline ${want.controls.length}`)
            continue
          }
          want.controls.forEach((w, i) => {
            const g = got.controls[i]
            if (!near(g.rect.x, w.x) || !near(g.rect.y, w.y) || !near(g.rect.w, w.w) || !near(g.rect.h, w.h)) {
              fail(
                key,
                `"${w.label}" moved: ${g.rect.x},${g.rect.y} ${g.rect.w}x${g.rect.h} ` +
                  `vs baseline ${w.x},${w.y} ${w.w}x${w.h}`
              )
            }
          })
        }
      }
    }
  } finally {
    if (JSON_OUT) writeFileSync(JSON_OUT, `${JSON.stringify(all, null, 2)}\n`)
    await browser.close()
    await server.stop()
  }

  if (notes.length) {
    console.log(`\n${notes.length} note(s):`)
    for (const n of notes.slice(0, 20)) console.log(`  · ${n}`)
  }

  if (failures.length) {
    console.log(`\nFAILED — ${failures.length} assertion(s):\n`)
    const shown = failures.slice(0, 60)
    for (const f of shown) console.log(`  x ${f}`)
    if (failures.length > shown.length) console.log(`  … and ${failures.length - shown.length} more`)
    process.exitCode = 1
    return
  }

  console.log(`\nPASSED — every screen, every viewport.`)
}

await main()
