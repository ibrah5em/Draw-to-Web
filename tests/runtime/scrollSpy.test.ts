import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { SCROLL_SPY_SNIPPET } from '../../src/runtime/scrollSpy'

interface FakeObserver {
  callback: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void
  options: { rootMargin?: string; threshold?: number | number[] }
  observed: Element[]
}

interface Booted {
  dom: JSDOM
  links: HTMLAnchorElement[]
  /** Drive intersection state by id; pass `{ id: bool, ... }`. */
  fire: (state: Record<string, boolean>) => void
  /** Inspect the most recently constructed observer. */
  observer: () => FakeObserver | undefined
}

function boot(opts: { withIO?: boolean; html?: string } = {}): Booted {
  const withIO = opts.withIO ?? true
  const defaultHtml = `
    <nav>
      <a href="#a">A</a>
      <a href="#b">B</a>
      <a href="#c">C</a>
    </nav>
    <main>
      <section id="a">A body</section>
      <section id="b">B body</section>
      <section id="c">C body</section>
    </main>
  `
  const dom = new JSDOM(`<!doctype html><html><body>${opts.html ?? defaultHtml}</body></html>`, {
    url: 'https://example.com',
    runScripts: 'outside-only',
  })

  const observers: FakeObserver[] = []
  if (withIO) {
    class FakeIO {
      callback: FakeObserver['callback']
      options: FakeObserver['options']
      observed: Element[] = []
      constructor(cb: FakeObserver['callback'], options: FakeObserver['options']) {
        this.callback = cb
        this.options = options ?? {}
        observers.push(this)
      }
      observe(el: Element): void {
        this.observed.push(el)
      }
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): unknown[] {
        return []
      }
    }
    const target = dom.window as unknown as { IntersectionObserver: typeof FakeIO }
    target.IntersectionObserver = FakeIO
  } else {
    delete (dom.window as unknown as Record<string, unknown>).IntersectionObserver
  }

  const links = Array.from(dom.window.document.querySelectorAll('nav a')) as HTMLAnchorElement[]

  return {
    dom,
    links,
    fire(state) {
      const ob = observers[observers.length - 1]
      if (!ob) throw new Error('No observer constructed yet')
      const entries = ob.observed
        .filter((el) => el.id in state)
        .map((el) => ({ target: el, isIntersecting: state[el.id] }))
      ob.callback(entries)
    },
    observer: () => observers[observers.length - 1],
  }
}

function run(snippet: string, dom: JSDOM): void {
  dom.window.eval(snippet)
}

describe('SCROLL_SPY_SNIPPET (I-RUN-02)', () => {
  it('observes every section whose id is referenced by a nav link', () => {
    const ctx = boot()
    run(SCROLL_SPY_SNIPPET, ctx.dom)
    const ob = ctx.observer()
    expect(ob).toBeDefined()
    expect(ob!.observed.map((el) => el.id)).toEqual(['a', 'b', 'c'])
    expect(ob!.options.rootMargin).toBe('-30% 0px -60% 0px')
  })

  it('activates the link whose section is currently intersecting', () => {
    const ctx = boot()
    run(SCROLL_SPY_SNIPPET, ctx.dom)
    ctx.fire({ a: true, b: false, c: false })
    expect(ctx.links[0].classList.contains('is-active')).toBe(true)
    expect(ctx.links[0].getAttribute('aria-current')).toBe('location')
    expect(ctx.links[1].classList.contains('is-active')).toBe(false)
    expect(ctx.links[1].getAttribute('aria-current')).toBeNull()
  })

  it('migrates the highlight as the user scrolls between sections', () => {
    const ctx = boot()
    run(SCROLL_SPY_SNIPPET, ctx.dom)
    ctx.fire({ a: true })
    ctx.fire({ a: false, b: true })
    expect(ctx.links[0].classList.contains('is-active')).toBe(false)
    expect(ctx.links[1].classList.contains('is-active')).toBe(true)
    expect(ctx.links[1].getAttribute('aria-current')).toBe('location')
  })

  it('picks the first intersecting section in document order when several overlap', () => {
    const ctx = boot()
    run(SCROLL_SPY_SNIPPET, ctx.dom)
    ctx.fire({ a: true, b: true, c: false })
    expect(ctx.links[0].classList.contains('is-active')).toBe(true)
    expect(ctx.links[1].classList.contains('is-active')).toBe(false)
  })

  it('keeps the last highlight when nothing is intersecting (footer space)', () => {
    const ctx = boot()
    run(SCROLL_SPY_SNIPPET, ctx.dom)
    ctx.fire({ c: true })
    ctx.fire({ c: false })
    expect(ctx.links[2].classList.contains('is-active')).toBe(true)
  })

  it('updates immediately on click without waiting for the observer', () => {
    const ctx = boot()
    run(SCROLL_SPY_SNIPPET, ctx.dom)
    ctx.fire({ a: true })
    ctx.links[2].click()
    expect(ctx.links[0].classList.contains('is-active')).toBe(false)
    expect(ctx.links[2].classList.contains('is-active')).toBe(true)
    expect(ctx.links[2].getAttribute('aria-current')).toBe('location')
  })

  it('ignores nav links that do not resolve to a section on the page', () => {
    const ctx = boot({
      html: `
        <nav>
          <a href="#a">A</a>
          <a href="#missing">Missing</a>
          <a href="#b">B</a>
        </nav>
        <main>
          <section id="a"></section>
          <section id="b"></section>
        </main>
      `,
    })
    run(SCROLL_SPY_SNIPPET, ctx.dom)
    expect(ctx.observer()!.observed.map((el) => el.id)).toEqual(['a', 'b'])
    ctx.fire({ b: true })
    const navLinks = ctx.links
    expect(navLinks[1].classList.contains('is-active')).toBe(false)
    expect(navLinks[2].classList.contains('is-active')).toBe(true)
  })

  it('does no work when the page has no nav links', () => {
    const ctx = boot({
      html: '<main><section id="a"></section></main>',
    })
    expect(() => run(SCROLL_SPY_SNIPPET, ctx.dom)).not.toThrow()
    expect(ctx.observer()).toBeUndefined()
  })

  it('ignores nav anchors whose href is "#" (no section id)', () => {
    const ctx = boot({
      html: `
        <nav>
          <a href="#">Home</a>
          <a href="#a">A</a>
        </nav>
        <main><section id="a"></section></main>
      `,
    })
    run(SCROLL_SPY_SNIPPET, ctx.dom)
    expect(ctx.observer()!.observed.map((el) => el.id)).toEqual(['a'])
  })

  it('still wires click activation when IntersectionObserver is unavailable', () => {
    const ctx = boot({ withIO: false })
    expect(() => run(SCROLL_SPY_SNIPPET, ctx.dom)).not.toThrow()
    ctx.links[1].click()
    expect(ctx.links[1].classList.contains('is-active')).toBe(true)
    expect(ctx.links[1].getAttribute('aria-current')).toBe('location')
  })
})
