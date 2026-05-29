import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { NAV_ON_SCROLL_SNIPPET } from '../../src/runtime/navOnScroll'

interface FakeObserver {
  callback: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void
  options: { threshold?: number | number[]; rootMargin?: string }
  observed: Element[]
}

interface Booted {
  dom: JSDOM
  nav: HTMLElement | null
  body: HTMLElement
  observer: () => FakeObserver | undefined
  fire: (isIntersecting: boolean) => void
}

function boot(
  opts: {
    withIO?: boolean
    html?: string
  } = {}
): Booted {
  const html = opts.html ?? `<nav>Top bar</nav><main><p>Body content</p></main>`
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: 'https://example.com',
    runScripts: 'outside-only',
  })

  const observers: FakeObserver[] = []
  if (opts.withIO ?? true) {
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
    }
    const target = dom.window as unknown as { IntersectionObserver: typeof FakeIO }
    target.IntersectionObserver = FakeIO
  } else {
    delete (dom.window as unknown as Record<string, unknown>).IntersectionObserver
  }

  return {
    dom,
    nav: dom.window.document.querySelector('nav'),
    body: dom.window.document.body,
    observer: () => observers[observers.length - 1],
    fire(isIntersecting) {
      const ob = observers[observers.length - 1]
      if (!ob) throw new Error('No observer constructed yet')
      const entries = ob.observed.map((el) => ({ target: el, isIntersecting }))
      ob.callback(entries)
    },
  }
}

function run(snippet: string, dom: JSDOM): void {
  dom.window.eval(snippet)
}

describe('NAV_ON_SCROLL_SNIPPET (I-RUN-05)', () => {
  it('inserts a sentinel as the first child of <body>', () => {
    const ctx = boot()
    run(NAV_ON_SCROLL_SNIPPET, ctx.dom)
    const first = ctx.body.firstElementChild as HTMLElement
    expect(first.hasAttribute('data-dtw-scroll-sentinel')).toBe(true)
    expect(first.getAttribute('aria-hidden')).toBe('true')
  })

  it('observes the sentinel it just inserted, with threshold 0', () => {
    const ctx = boot()
    run(NAV_ON_SCROLL_SNIPPET, ctx.dom)
    const ob = ctx.observer()
    expect(ob).toBeDefined()
    expect(ob!.observed).toHaveLength(1)
    expect(ob!.observed[0].hasAttribute('data-dtw-scroll-sentinel')).toBe(true)
    expect(ob!.options.threshold).toBe(0)
  })

  it('adds .scrolled to the nav once the sentinel stops intersecting', () => {
    const ctx = boot()
    run(NAV_ON_SCROLL_SNIPPET, ctx.dom)
    ctx.fire(false)
    expect(ctx.nav!.classList.contains('scrolled')).toBe(true)
  })

  it('removes .scrolled when the sentinel comes back into view', () => {
    const ctx = boot()
    run(NAV_ON_SCROLL_SNIPPET, ctx.dom)
    ctx.fire(false)
    ctx.fire(true)
    expect(ctx.nav!.classList.contains('scrolled')).toBe(false)
  })

  it('toggles .scrolled back and forth as the user scrolls up and down', () => {
    const ctx = boot()
    run(NAV_ON_SCROLL_SNIPPET, ctx.dom)
    ctx.fire(false)
    ctx.fire(true)
    ctx.fire(false)
    expect(ctx.nav!.classList.contains('scrolled')).toBe(true)
    ctx.fire(true)
    expect(ctx.nav!.classList.contains('scrolled')).toBe(false)
  })

  it('uses a zero-displacement sentinel (height 1px compensated by negative margin)', () => {
    const ctx = boot()
    run(NAV_ON_SCROLL_SNIPPET, ctx.dom)
    const sentinel = ctx.body.firstElementChild as HTMLElement
    expect(sentinel.style.height).toBe('1px')
    expect(sentinel.style.marginBottom).toBe('-1px')
    expect(sentinel.style.pointerEvents).toBe('none')
  })

  it('does no work when the page has no <nav>', () => {
    const ctx = boot({ html: '<main><p>No nav</p></main>' })
    expect(() => run(NAV_ON_SCROLL_SNIPPET, ctx.dom)).not.toThrow()
    expect(ctx.observer()).toBeUndefined()
    // No sentinel injected either — snippet bails before touching the DOM.
    expect(ctx.body.querySelector('[data-dtw-scroll-sentinel]')).toBeNull()
  })

  it('does no work when IntersectionObserver is unavailable', () => {
    const ctx = boot({ withIO: false })
    expect(() => run(NAV_ON_SCROLL_SNIPPET, ctx.dom)).not.toThrow()
    // The snippet bails before injecting the sentinel so we leave the DOM
    // pristine in old-browser fallback.
    expect(ctx.body.querySelector('[data-dtw-scroll-sentinel]')).toBeNull()
    expect(ctx.nav!.classList.contains('scrolled')).toBe(false)
  })
})
