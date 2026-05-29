import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { MOBILE_NAV_SNIPPET } from '../../src/runtime/mobileNav'

interface Booted {
  dom: JSDOM
  doc: Document
  win: Window & typeof globalThis
  toggles: HTMLButtonElement[]
  panel: HTMLElement
  links: HTMLAnchorElement[]
  /** Element outside the panel — used to test outside-click close. */
  outside: HTMLElement
}

function boot(
  opts: {
    toggles?: number
    html?: string
  } = {}
): Booted {
  const toggleCount = opts.toggles ?? 1
  const toggleButtons = Array.from(
    { length: toggleCount },
    (_, i) => `<button data-dtw-mobile-nav-toggle id="t${i}">Menu ${i}</button>`
  ).join('')

  const html =
    opts.html ??
    `
    ${toggleButtons}
    <main id="outside">
      <p>Page content</p>
    </main>
    <div data-dtw-mobile-nav-panel id="panel">
      <a href="#a" id="link-a">A</a>
      <a href="#b" id="link-b">B</a>
      <button id="close-x" data-dtw-mobile-nav-toggle>Close</button>
    </div>
  `

  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: 'https://example.com',
    runScripts: 'outside-only',
  })

  const win = dom.window as unknown as Window & typeof globalThis
  const doc = dom.window.document
  const toggles = Array.from(
    doc.querySelectorAll('[data-dtw-mobile-nav-toggle]')
  ) as HTMLButtonElement[]
  const panel = doc.querySelector('[data-dtw-mobile-nav-panel]') as HTMLElement
  const links = panel ? (Array.from(panel.querySelectorAll('a')) as HTMLAnchorElement[]) : []
  const outside = doc.getElementById('outside') as HTMLElement

  return { dom, doc, win, toggles, panel, links, outside }
}

function run(snippet: string, dom: JSDOM): void {
  dom.window.eval(snippet)
}

function key(ctx: Booted, key: string, opts: { shift?: boolean } = {}): KeyboardEvent {
  const event = new ctx.win.KeyboardEvent('keydown', {
    key,
    shiftKey: opts.shift ?? false,
    bubbles: true,
    cancelable: true,
  })
  ctx.doc.dispatchEvent(event)
  return event
}

describe('MOBILE_NAV_SNIPPET (I-RUN-04)', () => {
  describe('initial state', () => {
    it('seeds every toggle with aria-expanded="false" on load', () => {
      const ctx = boot({ toggles: 2 })
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      for (const t of ctx.toggles.filter((b) => !ctx.panel.contains(b))) {
        expect(t.getAttribute('aria-expanded')).toBe('false')
      }
    })

    it('does not pre-apply the is-open class', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      expect(ctx.panel.classList.contains('is-open')).toBe(false)
    })
  })

  describe('toggle open / close', () => {
    it('first click on the hamburger opens the panel, flips aria-expanded, focuses the first link', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      // The header toggle is the first button outside the panel.
      const hamburger = ctx.doc.getElementById('t0') as HTMLButtonElement
      hamburger.focus()
      hamburger.click()
      expect(ctx.panel.classList.contains('is-open')).toBe(true)
      expect(hamburger.getAttribute('aria-expanded')).toBe('true')
      expect(ctx.doc.activeElement).toBe(ctx.links[0])
    })

    it('second click on the hamburger closes the panel and restores focus to it', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      const hamburger = ctx.doc.getElementById('t0') as HTMLButtonElement
      hamburger.focus()
      hamburger.click()
      hamburger.click()
      expect(ctx.panel.classList.contains('is-open')).toBe(false)
      expect(hamburger.getAttribute('aria-expanded')).toBe('false')
      expect(ctx.doc.activeElement).toBe(hamburger)
    })

    it('mirrors aria-expanded across every toggle button', () => {
      const ctx = boot({ toggles: 3 })
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      ;(ctx.doc.getElementById('t0') as HTMLButtonElement).click()
      for (const t of ctx.toggles.filter((b) => !ctx.panel.contains(b))) {
        expect(t.getAttribute('aria-expanded')).toBe('true')
      }
    })

    it('the inside-panel close button toggles state as well', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      const hamburger = ctx.doc.getElementById('t0') as HTMLButtonElement
      hamburger.focus()
      hamburger.click()
      expect(ctx.panel.classList.contains('is-open')).toBe(true)
      const closeX = ctx.doc.getElementById('close-x') as HTMLButtonElement
      closeX.click()
      expect(ctx.panel.classList.contains('is-open')).toBe(false)
      expect(hamburger.getAttribute('aria-expanded')).toBe('false')
    })
  })

  describe('focus trap', () => {
    it('Tab from the last focusable wraps to the first', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      ;(ctx.doc.getElementById('t0') as HTMLButtonElement).click()
      // Focus is on link A (first focusable). Move to the close-X (last).
      const closeX = ctx.doc.getElementById('close-x') as HTMLButtonElement
      closeX.focus()
      const ev = key(ctx, 'Tab')
      expect(ev.defaultPrevented).toBe(true)
      expect(ctx.doc.activeElement).toBe(ctx.links[0])
    })

    it('Shift+Tab from the first focusable wraps to the last', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      ;(ctx.doc.getElementById('t0') as HTMLButtonElement).click()
      // Focus is already on first link after open.
      const ev = key(ctx, 'Tab', { shift: true })
      expect(ev.defaultPrevented).toBe(true)
      expect(ctx.doc.activeElement).toBe(ctx.doc.getElementById('close-x'))
    })

    it('does not interfere with Tab in the middle of the focus order', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      ;(ctx.doc.getElementById('t0') as HTMLButtonElement).click()
      ;(ctx.links[0] as HTMLAnchorElement).focus() // first link
      const ev = key(ctx, 'Tab')
      // Browser handles the natural step; snippet does not preventDefault.
      expect(ev.defaultPrevented).toBe(false)
    })
  })

  describe('close paths', () => {
    it('Escape closes the panel and restores focus', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      const hamburger = ctx.doc.getElementById('t0') as HTMLButtonElement
      hamburger.focus()
      hamburger.click()
      key(ctx, 'Escape')
      expect(ctx.panel.classList.contains('is-open')).toBe(false)
      expect(ctx.doc.activeElement).toBe(hamburger)
    })

    it('clicking an <a> inside the panel closes it (so navigation completes without an overlay covering the target)', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      ;(ctx.doc.getElementById('t0') as HTMLButtonElement).click()
      ;(ctx.doc.getElementById('link-a') as HTMLAnchorElement).click()
      expect(ctx.panel.classList.contains('is-open')).toBe(false)
    })

    it('clicking outside the panel and outside every toggle closes it', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      ;(ctx.doc.getElementById('t0') as HTMLButtonElement).click()
      ctx.outside.click()
      expect(ctx.panel.classList.contains('is-open')).toBe(false)
    })

    it('clicking on a toggle outside the panel does not double-close (toggle handler owns the flip)', () => {
      const ctx = boot()
      run(MOBILE_NAV_SNIPPET, ctx.dom)
      const hamburger = ctx.doc.getElementById('t0') as HTMLButtonElement
      hamburger.focus()
      hamburger.click()
      expect(ctx.panel.classList.contains('is-open')).toBe(true)
      hamburger.click()
      expect(ctx.panel.classList.contains('is-open')).toBe(false)
      // Third click should re-open, not stay closed (proving the doc
      // click handler isn't fighting the toggle handler).
      hamburger.click()
      expect(ctx.panel.classList.contains('is-open')).toBe(true)
    })
  })

  describe('graceful no-op cases', () => {
    it('does no work when there is no toggle button', () => {
      const ctx = boot({
        html: `<div data-dtw-mobile-nav-panel><a href="#a">A</a></div>`,
      })
      expect(() => run(MOBILE_NAV_SNIPPET, ctx.dom)).not.toThrow()
      expect(ctx.panel.classList.contains('is-open')).toBe(false)
    })

    it('does no work when there is no panel', () => {
      const ctx = boot({
        html: `<button data-dtw-mobile-nav-toggle id="t0">Menu</button>`,
      })
      expect(() => run(MOBILE_NAV_SNIPPET, ctx.dom)).not.toThrow()
      // Toggle should not have aria-expanded stamped either — snippet
      // returns early before touching any DOM.
      expect(ctx.doc.getElementById('t0')!.hasAttribute('aria-expanded')).toBe(false)
    })
  })
})
