/**
 * The in-page measurement. Serialised into the browser by `harness.js`, so it
 * must be self-contained: no imports, no closure over anything.
 *
 * It is deliberately version-agnostic — the same function measures the code
 * before the layout fix and after it, which is what makes the before/after
 * numbers comparable rather than two different reports.
 *
 * ── WHY IT MEASURES ELEMENTS AND NOT `documentElement.scrollHeight` ─────────
 *
 * Because on the shipped code that number under-reports the bug by 73%. At
 * 375x554 the category screen's `scrollHeight` is 611 against a 554 viewport —
 * a 57px deficit — while the true shortfall is 210px. `justify-content: center`
 * on an overflowing column sends half the overflow to NEGATIVE coordinates, and
 * scrollHeight cannot see above y=0. It also says nothing at all about the home
 * gate being covered and losing its own hit test, which is the serious half of
 * the failure. Per-element geometry is the only thing that sees either.
 *
 * ── WHY `documentElement.clientWidth` AND NEVER `window.innerWidth` ─────────
 *
 * Chrome widens the initial containing block when content overflows: at a 320px
 * emulation on the bonds picker `innerWidth` reports 356, which hides the
 * horizontal clipping completely.
 */

/**
 * @returns {Object} one screen, fully measured
 */
export function probePage() {
  const doc = document.documentElement
  const vw = doc.clientWidth
  const vh = doc.clientHeight

  const round = (n) => Math.round(n * 100) / 100
  const box = (el) => {
    const r = el.getBoundingClientRect()
    return {
      x: round(r.left),
      y: round(r.top),
      w: round(r.width),
      h: round(r.height),
      right: round(r.right),
      bottom: round(r.bottom),
    }
  }

  const labelOf = (el) =>
    (el.getAttribute('aria-label') || el.textContent || el.tagName)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40)

  const isScrollable = (el) => {
    const cs = getComputedStyle(el)
    const canY = /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1
    const canX = /auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1
    return canY || canX
  }

  const scrollerFor = (el) => {
    let node = el.parentElement
    while (node && node !== doc) {
      if (isScrollable(node)) return node
      node = node.parentElement
    }
    return null
  }

  // The nearest ancestor that CLIPS, scrollable or not. An element inside a
  // clipping box is invisible when it leaves that box, even while its rect is
  // still comfortably inside the viewport — which is a way to hide a keypad's
  // ENTER row from a check that only looks at the viewport. Ask twice.
  const clipperFor = (el) => {
    let node = el.parentElement
    while (node && node !== doc) {
      const cs = getComputedStyle(node)
      if (/auto|scroll|hidden|clip/.test(cs.overflowY) || /auto|scroll|hidden|clip/.test(cs.overflowX)) {
        return node
      }
      node = node.parentElement
    }
    return null
  }

  // Every scroll container in the page, so the reachability pass can put them
  // all back exactly where it found them and leave the page as it was.
  const allScrollers = [doc, document.body].concat(
    Array.from(document.querySelectorAll('*')).filter((el) => {
      const cs = getComputedStyle(el)
      return /auto|scroll/.test(cs.overflowY) || /auto|scroll/.test(cs.overflowX)
    })
  )
  const savedScroll = allScrollers.map((el) => ({ el, top: el.scrollTop, left: el.scrollLeft }))

  const fullyInside = (r) => r.y >= -0.5 && r.bottom <= vh + 0.5 && r.x >= -0.5 && r.right <= vw + 0.5

  /** Inside the viewport AND inside every box that would clip it. */
  const fullyVisible = (el, r) => {
    if (!fullyInside(r)) return false
    const clipper = clipperFor(el)
    if (!clipper) return true
    const c = clipper.getBoundingClientRect()
    const cs = getComputedStyle(clipper)
    const clipsY = /auto|scroll|hidden|clip/.test(cs.overflowY)
    const clipsX = /auto|scroll|hidden|clip/.test(cs.overflowX)
    if (clipsY && (r.y < c.top - 0.5 || r.bottom > c.bottom + 0.5)) return false
    if (clipsX && (r.x < c.left - 0.5 || r.right > c.right + 0.5)) return false
    return true
  }

  const controls = Array.from(
    document.querySelectorAll('button, a[href], [role="button"], input, select, textarea')
  )
    // Never counted: something the layout has explicitly taken out of play.
    .filter((el) => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false
      return true
    })

  const items = controls.map((el) => {
    const rect = box(el)
    const inViewport = fullyVisible(el, rect)
    return {
      label: labelOf(el),
      cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '',
      rect,
      minSide: round(Math.min(rect.w, rect.h)),
      inViewport,
      hasScroller: scrollerFor(el) !== null,
      // Filled by the reachability pass below.
      reachable: inViewport,
      movedDocument: false,
      rectAfterScroll: null,
    }
  })

  // ── reachability ──────────────────────────────────────────────────────────
  // "Off screen" is only a failure if nothing can bring it on screen. Scrolling
  // a REGION is the safety net; scrolling the DOCUMENT would mean the shell has
  // lost its definite height and the home gate no longer holds still, so that is
  // recorded as a failure of its own.
  controls.forEach((el, i) => {
    if (items[i].inViewport) return
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    const after = box(el)
    items[i].rectAfterScroll = after
    items[i].reachable = fullyVisible(el, after)
    items[i].movedDocument = doc.scrollTop !== 0 || doc.scrollLeft !== 0 || document.body.scrollTop !== 0
  })

  savedScroll.forEach(({ el, top, left }) => {
    el.scrollTop = top
    el.scrollLeft = left
  })

  // ── the home gate ─────────────────────────────────────────────────────────
  // PLAN 3.7: "one 72px round button, top-left, in the identical position on
  // every non-home screen […] One way home, always the same pixel."
  const gateEl = document.querySelector('[aria-label="Back to Home"]')
  let gate = null
  if (gateEl) {
    const r = box(gateEl)
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    const hit = cx >= 0 && cy >= 0 && cx <= vw && cy <= vh ? document.elementFromPoint(cx, cy) : null
    gate = {
      rect: r,
      minSide: round(Math.min(r.w, r.h)),
      inViewport: fullyInside(r),
      // The assertion that catches the serious half of the reported bug: on the
      // shipped code this returns "Bonds to…" at 375x554, so the one way home
      // starts a game instead.
      hitOwner: hit ? labelOf(hit.closest('button, a, [role="button"]') || hit) : null,
      ownsItsCentre: hit ? gateEl.contains(hit) || hit === gateEl : false,
    }
  }

  // ── regions ───────────────────────────────────────────────────────────────
  const screenEl = document.querySelector('[data-screen]')
  const contentEl = document.querySelector('[data-slot="content"]')
  const region = contentEl
    ? {
        growth: screenEl ? screenEl.getAttribute('data-growth') : null,
        mode: contentEl.getAttribute('data-mode'),
        clientH: contentEl.clientHeight,
        scrollH: contentEl.scrollHeight,
        clientW: contentEl.clientWidth,
        scrollW: contentEl.scrollWidth,
        overflowY: getComputedStyle(contentEl).overflowY,
        overflowX: getComputedStyle(contentEl).overflowX,
        rect: box(contentEl),
      }
    : null

  // ── the peek ──────────────────────────────────────────────────────────────
  // When a growing list overflows, the last VISIBLE row must be cut by the
  // region's bottom edge rather than aligned to it. A partially visible card is
  // the whole scroll affordance: no arrow, no chrome, no text.
  let peek = null
  if (region && region.scrollH > region.clientH + 1) {
    const rowEls = Array.from(document.querySelectorAll('[data-row]'))
    const edge = region.rect.bottom
    peek = {
      overflowBy: region.scrollH - region.clientH,
      rows: rowEls.length,
      cut: rowEls.some((el) => {
        const r = box(el)
        return r.y < edge - 1 && r.bottom > edge + 1
      }),
    }
  }

  // Every element whose painted box leaves the viewport with nothing to scroll
  // it back — the shape the reported bug actually takes.
  const clipped = items.filter((it) => !it.reachable)

  return {
    vw,
    vh,
    doc: {
      scrollH: doc.scrollHeight,
      clientH: doc.clientHeight,
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      overflowY: getComputedStyle(document.body).overflowY,
      scrolls: doc.scrollHeight > doc.clientHeight + 1 || doc.scrollWidth > doc.clientWidth + 1,
    },
    gate,
    region,
    peek,
    controls: items,
    counts: {
      controls: items.length,
      offViewport: items.filter((it) => !it.inViewport).length,
      unreachable: clipped.length,
      belowTapFloor: items.filter((it) => it.minSide < 44).length,
    },
    // A compact, diffable summary — this is what the baseline file stores.
    signature: items.map((it) => `${it.label}@${it.rect.x},${it.rect.y} ${it.rect.w}x${it.rect.h}`),
  }
}
