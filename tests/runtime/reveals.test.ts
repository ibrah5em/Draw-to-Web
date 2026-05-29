import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { REVEALS_SNIPPET } from '../../src/runtime/reveals'

interface FakeObserver {
  callback: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void
  options: { threshold?: number | number[]; rootMargin?: string }
  observed: Element[]
  unobserved: Element[]
}

interface Booted {
  dom: JSDOM
  els: HTMLElement[]
  observer: () => FakeObserver | undefined
  fire: (intersecting: Record<string, boolean>) => void
}

function boot(
  opts: {
    withIO?: boolean
    reduceMotion?: boolean
    html?: string
  } = {}
): Booted {
  const html =
    opts.html ??
    `
    <section data-dtw-reveal id="r1"><h2>One</h2></section>
    <section data-dtw-reveal id="r2"><h2>Two</h2></section>
    <section data-dtw-reveal id="r3"><h2>Three</h2></section>
  `
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: 'https://example.com',
    runScripts: 'outside-only',
  })

  // matchMedia is not in jsdom — stub it to drive prefers-reduced-motion.
  const reduce = opts.reduceMotion ?? false
  ;(dom.window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: q.includes('reduce') ? reduce : false,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList

  const observers: FakeObserver[] = []
  if (opts.withIO ?? true) {
    class FakeIO {
      callback: FakeObserver['callback']
      options: FakeObserver['options']
      observed: Element[] = []
      unobserved: Element[] = []
      constructor(cb: FakeObserver['callback'], options: FakeObserver['options']) {
        this.callback = cb
        this.options = options ?? {}
        observers.push(this)
      }
      observe(el: Element): void {
        this.observed.push(el)
      }
      unobserve(el: Element): void {
        this.unobserved.push(el)
      }
      disconnect(): void {}
    }
    const target = dom.window as unknown as { IntersectionObserver: typeof FakeIO }
    target.IntersectionObserver = FakeIO
  } else {
    delete (dom.window as unknown as Record<string, unknown>).IntersectionObserver
  }

  const els = Array.from(dom.window.document.querySelectorAll('[data-dtw-reveal]')) as HTMLElement[]

  return {
    dom,
    els,
    observer: () => observers[observers.length - 1],
    fire(state) {
      const ob = observers[observers.length - 1]
      if (!ob) throw new Error('No observer constructed yet')
      const entries = ob.observed
        .filter((el) => el.id in state)
        .map((el) => ({ target: el, isIntersecting: state[el.id] }))
      ob.callback(entries)
    },
  }
}

function run(snippet: string, dom: JSDOM): void {
  dom.window.eval(snippet)
}

describe('REVEALS_SNIPPET (I-RUN-06)', () => {
  it('observes every [data-dtw-reveal] target with threshold 0.1', () => {
    const ctx = boot()
    run(REVEALS_SNIPPET, ctx.dom)
    const ob = ctx.observer()
    expect(ob).toBeDefined()
    expect(ob!.observed.map((el) => el.id)).toEqual(['r1', 'r2', 'r3'])
    expect(ob!.options.threshold).toBe(0.1)
  })

  it('adds .visible only to elements that intersect', () => {
    const ctx = boot()
    run(REVEALS_SNIPPET, ctx.dom)
    ctx.fire({ r1: true, r2: false, r3: false })
    expect(ctx.els[0].classList.contains('visible')).toBe(true)
    expect(ctx.els[1].classList.contains('visible')).toBe(false)
    expect(ctx.els[2].classList.contains('visible')).toBe(false)
  })

  it('unobserves each element after revealing it (one-shot)', () => {
    const ctx = boot()
    run(REVEALS_SNIPPET, ctx.dom)
    ctx.fire({ r1: true, r2: true })
    const ob = ctx.observer()!
    expect(ob.unobserved.map((el) => el.id).sort()).toEqual(['r1', 'r2'])
    // Firing the same target as not-intersecting later (scroll back up)
    // must not strip .visible — it was already unobserved.
    ctx.fire({ r1: false })
    expect(ctx.els[0].classList.contains('visible')).toBe(true)
  })

  it('reveals stay sticky on subsequent intersections of other targets', () => {
    const ctx = boot()
    run(REVEALS_SNIPPET, ctx.dom)
    ctx.fire({ r1: true })
    ctx.fire({ r2: true })
    expect(ctx.els[0].classList.contains('visible')).toBe(true)
    expect(ctx.els[1].classList.contains('visible')).toBe(true)
  })

  it('skips animation but still marks every target .visible under prefers-reduced-motion', () => {
    const ctx = boot({ reduceMotion: true })
    run(REVEALS_SNIPPET, ctx.dom)
    // Snippet should NOT have set up an observer in this branch.
    expect(ctx.observer()).toBeUndefined()
    for (const el of ctx.els) {
      expect(el.classList.contains('visible')).toBe(true)
    }
  })

  it('falls back to immediate-reveal when IntersectionObserver is unavailable', () => {
    const ctx = boot({ withIO: false })
    run(REVEALS_SNIPPET, ctx.dom)
    for (const el of ctx.els) {
      expect(el.classList.contains('visible')).toBe(true)
    }
  })

  it('does no work when the page has no [data-dtw-reveal] targets', () => {
    const ctx = boot({ html: '<main><p>Nothing to reveal</p></main>' })
    expect(() => run(REVEALS_SNIPPET, ctx.dom)).not.toThrow()
    expect(ctx.observer()).toBeUndefined()
  })

  it('survives a thrown matchMedia and degrades to observer mode (motion preference unknown)', () => {
    const ctx = boot()
    // Replace matchMedia with one that throws — snippet must still wire
    // up the observer rather than crashing on init.
    ;(ctx.dom.window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia =
      () => {
        throw new Error('blocked')
      }
    expect(() => run(REVEALS_SNIPPET, ctx.dom)).not.toThrow()
    expect(ctx.observer()).toBeDefined()
  })
})
