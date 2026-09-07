/**
 * Drives a real browser over the real app and measures it. (layout regression test)
 *
 * `playwright-core` + `channel: 'chrome'` — it drives the Chrome that is already
 * installed and downloads no browser binaries at all. See the justification in
 * package.json's devDependencies and in the handoff note: this defect is
 * invisible to every other tool in the repo. Vitest runs in the node environment
 * with no jsdom, and jsdom would not help — it has no layout engine and reports
 * every element at 0x0. There is no way to assert "the home gate wins its own
 * hit test" without a rendering engine.
 */

import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

import { probePage } from './probe.js'
import { SIMULATED_INSETS } from './viewports.js'

const PORT = Number(process.env.LAYOUT_PORT || 5599)
const BASE = process.env.LAYOUT_URL || `http://localhost:${PORT}`

/** Start `vite dev` and wait for it to answer. Skipped if LAYOUT_URL is set. */
export async function startServer() {
  if (process.env.LAYOUT_URL) return { stop: async () => {} }

  const child = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--port', String(PORT), '--strictPort'],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
  )
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})

  const deadline = Date.now() + 60_000
  for (;;) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) })
      if (res.ok) break
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`dev server did not start on ${BASE}`)
    await new Promise((r) => setTimeout(r, 400))
  }

  return {
    stop: async () => {
      child.kill()
      await new Promise((r) => setTimeout(r, 200))
    },
  }
}

export async function openBrowser() {
  const browser = await chromium.launch({ channel: 'chrome' })
  const context = await browser.newContext({
    // framer-motion's entrance springs keep geometry in flight for a few hundred
    // milliseconds. Forcing reduced motion is more deterministic than sleeping.
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  })

  // The app contains exactly one Math.random() — the deck seed in
  // screens/PlayHost.jsx (AGENTS.md: engines never call it, the randomness
  // enters at one place). Pinning it makes every deck identical between runs,
  // which is what lets the baseline compare a play screen's geometry
  // absolutely. Without it a Roman numerals card of a different width shifts
  // the whole centred stack and reports a layout regression that is really a
  // different question.
  // A CONSTANT, not a sequence. A sequence would still be deterministic per
  // document, but `page.goto` to a different hash on the same origin does not
  // reload the document — so the generator's position depends on how many
  // screens were visited first, and a run of six screens deals different cards
  // from a run of thirteen. Measured: the Roman numerals prompt came out 15.5px
  // taller in one run than the other, which moved the whole centred stack and
  // reported a layout regression that was really a different card.
  await context.addInitScript(() => {
    Math.random = () => 0.4242424242424242
  })

  const page = await context.newPage()
  return { browser, page }
}

/** Baloo 2 and Nunito load with `display=swap`; measuring first gives wrong rows. */
async function settle(page) {
  await page.evaluate(() =>
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))])
  )
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  )
}

const nonGateButtons = (page) =>
  page.$$eval('button', (els) =>
    els.map((el, i) => ({ i, label: (el.getAttribute('aria-label') || el.textContent || '').trim() }))
  )

/**
 * Every screen in the app, reached the way she reaches it.
 *
 * A play route CANNOT be deep-linked: `app/Shell.jsx` redirects `#/play/…` to the
 * option picker unless a game was started in this tab. A suite that navigates
 * straight to a play hash would silently measure the picker five times and report
 * green on the five screens the owner says must not regress.
 */
export async function collectScreens(page, { withSummary = true } = {}) {
  const screens = []

  // 1 · home
  await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
  await page.reload({ waitUntil: 'load' })
  screens.push({ id: 'home', note: '#/', navigate: async () => { await page.goto(`${BASE}/#/`); await settle(page) } })

  // 2 · the awake categories
  const categories = await page.$$eval('[data-category]', (els) =>
    els.filter((el) => el.tagName === 'BUTTON').map((el) => el.getAttribute('data-category'))
  )

  for (const categoryId of categories) {
    screens.push({
      id: `category:${categoryId}`,
      note: `#/c/${categoryId}`,
      navigate: async () => {
        await page.goto(`${BASE}/#/`)
        await page.click(`button[data-category="${categoryId}"]`)
        await settle(page)
      },
    })

    // 3 · every activity's option picker, and 4 · its play screen
    await page.goto(`${BASE}/#/`)
    await page.click(`button[data-category="${categoryId}"]`)
    await settle(page)
    const rows = await nonGateButtons(page)
    const activityCount = rows.filter((r) => r.label !== 'Back to Home').length

    for (let n = 0; n < activityCount; n += 1) {
      const openPicker = async () => {
        await page.goto(`${BASE}/#/`)
        await page.click(`button[data-category="${categoryId}"]`)
        await settle(page)
        const all = await page.$$('button')
        // DOM order on a category screen: the gate, then one row per activity.
        await all[n + 1].click()
        await settle(page)
      }

      await openPicker()
      const slug = await page.evaluate(() => location.hash)

      screens.push({ id: `picker:${slug}`, note: slug, navigate: openPicker })

      screens.push({
        id: `play:${slug.replace('#/a/', '')}`,
        note: `${slug} → play`,
        navigate: async () => {
          await openPicker()
          // DOM order on a picker: the gate, then the start button.
          const all = await page.$$('button')
          await all[1].click()
          // The activity's chunk is a dynamic import and the deck is dealt after
          // it lands. Measuring the "Getting ready…" placeholder would report a
          // zero-sized gate and a green suite over a screen that never rendered.
          await page.waitForFunction(
            () => location.hash.startsWith('#/play/') && !document.body.textContent.includes('Getting ready'),
            null,
            { timeout: 20_000 }
          )
          await settle(page)
        },
      })
    }
  }

  // 5 · the summary. Reached by finishing a session, which is the only way in
  // (Shell.jsx redirects a summary route with no result to the option picker).
  if (withSummary) {
    screens.push({
      id: 'summary',
      note: 'roman-numerals → played to the end',
      navigate: async () => {
        await page.goto(`${BASE}/#/`)
        await page.click('button[data-category="numbers"]')
        await settle(page)
        const rows = await page.$$('button')
        await rows[rows.length - 1].click() // roman numerals — the last row
        await settle(page)
        const picker = await page.$$('button')
        await picker[1].click() // start
        await page.waitForFunction(
          () => location.hash.startsWith('#/play/') && !document.body.textContent.includes('Getting ready'),
          null,
          { timeout: 20_000 }
        )
        await settle(page)
        await playToSummary(page)
        await settle(page)
      },
    })
  }

  return screens
}

/**
 * Answer cards until the summary appears. The answers are not checked — a wrong
 * one still advances (shake 500ms → reveal 2500ms → next), and the summary's
 * geometry is the same either way.
 */
async function playToSummary(page) {
  const deadline = Date.now() + 120_000
  for (;;) {
    if (Date.now() > deadline) throw new Error('never reached the summary')
    const done = await page.evaluate(() => document.body.textContent.includes('Session Complete'))
    if (done) return
    const choices = await page.$$('button')
    // The gate is index 0; the answer buttons follow.
    if (choices.length < 2) throw new Error('no answer buttons on the play screen')
    try {
      await choices[choices.length - 1].click({ timeout: 2000 })
    } catch {
      /* the card was mid-reveal; try again on the next pass */
    }
    await page.waitForTimeout(400)
  }
}

/** Measure one screen at one viewport. */
export async function measure(page, screen, viewport, { insets = false } = {}) {
  await page.setViewportSize({ width: viewport.w, height: viewport.h })
  await screen.navigate()

  if (insets) {
    await page.evaluate((v) => {
      const s = document.documentElement.style
      s.setProperty('--safe-top', v.top)
      s.setProperty('--safe-bottom', v.bottom)
      s.setProperty('--safe-left', v.left)
      s.setProperty('--safe-right', v.right)
    }, SIMULATED_INSETS)
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    )
  }

  return page.evaluate(probePage)
}

export { BASE }
