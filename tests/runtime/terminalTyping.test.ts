import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { TERMINAL_TYPING_SNIPPET } from '../../src/runtime/terminalTyping'

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
    <pre>
      <code data-dtw-terminal-type id="line1" style="animation-play-state: paused">npm install</code>
      <code data-dtw-terminal-type id="line2" style="animation-play-state: paused">npm run dev</code>
    </pre>
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
    dom.window.document.querySelectorAll('[data-dtw-terminal-type]')
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

describe('TERMINAL_TYPING_SNIPPET (I-RUN-08)', () => {
  it('observes every [data-dtw-terminal-type] target at threshold 0.5', () => {
    const ctx = boot()
    run(TERMINAL_TYPING_SNIPPET, ctx.dom)
    const ob = ctx.observer()
    expect(ob).toBeDefined()
    expect(ob!.observed.map((el) => el.id)).toEqual(['line1', 'line2'])
    expect(ob!.options.threshold).toBe(0.5)
  })

  it('flips animation-play-state to "running" on intersection', () => {
    const ctx = boot()
    run(TERMINAL_TYPING_SNIPPET, ctx.dom)
    ctx.fire({ line1: true, line2: false })
    expect(ctx.els[0].style.animationPlayState).toBe('running')
    expect(ctx.els[1].style.animationPlayState).toBe('paused')
  })

  it('unobserves each line after starting it (one-shot)', () => {
    const ctx = boot()
    run(TERMINAL_TYPING_SNIPPET, ctx.dom)
    ctx.fire({ line1: true, line2: true })
    const ob = ctx.observer()!
    expect(ob.unobserved.map((el) => el.id).sort()).toEqual(['line1', 'line2'])
  })

  it('starts every line immediately under prefers-reduced-motion (no observer)', () => {
    const ctx = boot({ reduceMotion: true })
    run(TERMINAL_TYPING_SNIPPET, ctx.dom)
    expect(ctx.observer()).toBeUndefined()
    for (const el of ctx.els) {
      expect(el.style.animationPlayState).toBe('running')
    }
  })

  it('starts every line immediately when IntersectionObserver is unavailable', () => {
    const ctx = boot({ withIO: false })
    run(TERMINAL_TYPING_SNIPPET, ctx.dom)
    for (const el of ctx.els) {
      expect(el.style.animationPlayState).toBe('running')
    }
  })

  it('does no work when there are no terminal lines on the page', () => {
    const ctx = boot({ html: '<main><p>No terminal</p></main>' })
    expect(() => run(TERMINAL_TYPING_SNIPPET, ctx.dom)).not.toThrow()
    expect(ctx.observer()).toBeUndefined()
  })

  it('survives a thrown matchMedia and proceeds to the observer path', () => {
    const ctx = boot()
    ;(ctx.dom.window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia =
      () => {
        throw new Error('blocked')
      }
    expect(() => run(TERMINAL_TYPING_SNIPPET, ctx.dom)).not.toThrow()
    expect(ctx.observer()).toBeDefined()
  })
})
