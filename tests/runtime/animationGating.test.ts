import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { ANIMATION_GATING_SNIPPET } from '../../src/runtime/animationGating'

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
  fire: (state: Record<string, boolean>) => void
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
    <div data-dtw-gate-anim id="g1" style="animation-play-state: paused"></div>
    <div data-dtw-gate-anim id="g2" style="animation-play-state: paused"></div>
  `
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: 'https://example.com',
    runScripts: 'outside-only',
  })

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

  const els = Array.from(
    dom.window.document.querySelectorAll('[data-dtw-gate-anim]')
  ) as HTMLElement[]

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

describe('ANIMATION_GATING_SNIPPET (I-RUN-07)', () => {
  it('observes every [data-dtw-gate-anim] target at threshold 0.1', () => {
    const ctx = boot()
    run(ANIMATION_GATING_SNIPPET, ctx.dom)
    const ob = ctx.observer()
    expect(ob).toBeDefined()
    expect(ob!.observed.map((el) => el.id)).toEqual(['g1', 'g2'])
    expect(ob!.options.threshold).toBe(0.1)
  })

  it('flips animation-play-state to "running" only for elements that intersect', () => {
    const ctx = boot()
    run(ANIMATION_GATING_SNIPPET, ctx.dom)
    ctx.fire({ g1: true, g2: false })
    expect(ctx.els[0].style.animationPlayState).toBe('running')
    // g2 is still paused.
    expect(ctx.els[1].style.animationPlayState).toBe('paused')
  })

  it('unobserves each element after un-pausing (one-shot)', () => {
    const ctx = boot()
    run(ANIMATION_GATING_SNIPPET, ctx.dom)
    ctx.fire({ g1: true })
    const ob = ctx.observer()!
    expect(ob.unobserved.map((el) => el.id)).toEqual(['g1'])
  })

  it('un-pauses every target immediately under prefers-reduced-motion (no observer)', () => {
    const ctx = boot({ reduceMotion: true })
    run(ANIMATION_GATING_SNIPPET, ctx.dom)
    expect(ctx.observer()).toBeUndefined()
    for (const el of ctx.els) {
      expect(el.style.animationPlayState).toBe('running')
    }
  })

  it('un-pauses every target immediately when IntersectionObserver is unavailable', () => {
    const ctx = boot({ withIO: false })
    run(ANIMATION_GATING_SNIPPET, ctx.dom)
    for (const el of ctx.els) {
      expect(el.style.animationPlayState).toBe('running')
    }
  })

  it('does no work when there are no [data-dtw-gate-anim] targets', () => {
    const ctx = boot({ html: '<main><p>Nothing gated</p></main>' })
    expect(() => run(ANIMATION_GATING_SNIPPET, ctx.dom)).not.toThrow()
    expect(ctx.observer()).toBeUndefined()
  })

  it('survives a thrown matchMedia and proceeds to the observer path', () => {
    const ctx = boot()
    ;(ctx.dom.window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia =
      () => {
        throw new Error('blocked')
      }
    expect(() => run(ANIMATION_GATING_SNIPPET, ctx.dom)).not.toThrow()
    expect(ctx.observer()).toBeDefined()
  })
})
