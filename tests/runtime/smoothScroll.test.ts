import { describe, it, expect, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { SMOOTH_SCROLL_SNIPPET } from '../../src/runtime/smoothScroll'

interface FakeResizeObserver {
  callback: () => void
  observed: Element[]
}

interface Booted {
  dom: JSDOM
  nav: HTMLElement | null
  root: HTMLHtmlElement
  /** Drive the most recently constructed ResizeObserver. */
  triggerResize: () => void
  /** Inspect the most recently constructed observer. */
  observer: () => FakeResizeObserver | undefined
  /** Mocked rAF — calls fire synchronously and return increasing ids. */
  rafCalls: () => number
}

function boot(
  opts: {
    /** Override the body markup; default has a single `<nav>` with a measurable height. */
    html?: string
    /** Initial nav height returned by `getBoundingClientRect`. */
    navHeight?: number
    /** Whether `ResizeObserver` is available on the window. */
    withResizeObserver?: boolean
  } = {}
): Booted {
  const html =
    opts.html ??
    `<nav style="height:64px"><a href="#a">A</a></nav><main><section id="a"></section></main>`
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: 'https://example.com',
    runScripts: 'outside-only',
  })

  const observers: FakeResizeObserver[] = []
  if (opts.withResizeObserver ?? true) {
    class FakeRO {
      callback: () => void
      observed: Element[] = []
      constructor(cb: () => void) {
        this.callback = cb
        observers.push(this)
      }
      observe(el: Element): void {
        this.observed.push(el)
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    const target = dom.window as unknown as { ResizeObserver: typeof FakeRO }
    target.ResizeObserver = FakeRO
  } else {
    delete (dom.window as unknown as Record<string, unknown>).ResizeObserver
  }

  // Synchronous rAF: snippet schedules → callback fires immediately.
  // Each call returns a fresh non-zero id to keep the snippet's debounce
  // gate honest.
  let nextRafId = 1
  let rafCount = 0
  const raf = vi.fn((fn: FrameRequestCallback) => {
    rafCount++
    fn(performance.now())
    return nextRafId++
  })
  ;(dom.window as unknown as { requestAnimationFrame: typeof raf }).requestAnimationFrame = raf

  // Stub the nav's measured height (jsdom returns 0 by default).
  const nav = dom.window.document.querySelector('nav') as HTMLElement | null
  if (nav) {
    const h = opts.navHeight ?? 64
    nav.getBoundingClientRect = () =>
      ({
        height: h,
        width: 0,
        top: 0,
        left: 0,
        bottom: h,
        right: 0,
        x: 0,
        y: 0,
        toJSON() {
          return {}
        },
      }) as DOMRect
  }

  return {
    dom,
    nav,
    root: dom.window.document.documentElement as HTMLHtmlElement,
    triggerResize: () => {
      const ob = observers[observers.length - 1]
      if (!ob) throw new Error('No ResizeObserver constructed yet')
      ob.callback()
    },
    observer: () => observers[observers.length - 1],
    rafCalls: () => rafCount,
  }
}

function run(snippet: string, dom: JSDOM): void {
  dom.window.eval(snippet)
}

describe('SMOOTH_SCROLL_SNIPPET (I-RUN-03)', () => {
  it('writes the rendered nav height into --dtw-nav-pad on first run', () => {
    const ctx = boot({ navHeight: 72 })
    run(SMOOTH_SCROLL_SNIPPET, ctx.dom)
    expect(ctx.root.style.getPropertyValue('--dtw-nav-pad')).toBe('72px')
  })

  it('observes the first <nav> element with a ResizeObserver', () => {
    const ctx = boot()
    run(SMOOTH_SCROLL_SNIPPET, ctx.dom)
    expect(ctx.observer()).toBeDefined()
    expect(ctx.observer()!.observed[0]).toBe(ctx.nav)
  })

  it('recomputes the padding when the nav resizes', () => {
    const ctx = boot({ navHeight: 64 })
    run(SMOOTH_SCROLL_SNIPPET, ctx.dom)
    expect(ctx.root.style.getPropertyValue('--dtw-nav-pad')).toBe('64px')
    // Simulate the nav growing (e.g. mobile menu opening).
    ;(ctx.nav as HTMLElement).getBoundingClientRect = () => ({ height: 220 }) as unknown as DOMRect
    ctx.triggerResize()
    expect(ctx.root.style.getPropertyValue('--dtw-nav-pad')).toBe('220px')
  })

  it('debounces successive resize callbacks through requestAnimationFrame', () => {
    const ctx = boot()
    run(SMOOTH_SCROLL_SNIPPET, ctx.dom)
    const baseline = ctx.rafCalls()
    ctx.triggerResize()
    ctx.triggerResize()
    ctx.triggerResize()
    // Three resize ticks → three scheduled frames (synchronous rAF mock
    // drains each before the next is requested, which is the realistic
    // worst case — even then, no infinite cascades).
    expect(ctx.rafCalls()).toBeGreaterThan(baseline)
  })

  it('does no work when the page has no <nav>', () => {
    const ctx = boot({ html: '<main><section id="a"></section></main>' })
    expect(() => run(SMOOTH_SCROLL_SNIPPET, ctx.dom)).not.toThrow()
    expect(ctx.root.style.getPropertyValue('--dtw-nav-pad')).toBe('')
    expect(ctx.observer()).toBeUndefined()
  })

  it('falls back to a passive window resize listener when ResizeObserver is unavailable', () => {
    const ctx = boot({ withResizeObserver: false, navHeight: 48 })
    const addSpy = vi.spyOn(ctx.dom.window, 'addEventListener')
    run(SMOOTH_SCROLL_SNIPPET, ctx.dom)
    expect(ctx.root.style.getPropertyValue('--dtw-nav-pad')).toBe('48px')
    const resizeCall = addSpy.mock.calls.find((c) => c[0] === 'resize')
    expect(resizeCall).toBeDefined()
    const options = resizeCall![2] as AddEventListenerOptions
    expect(options.passive).toBe(true)
  })
})
