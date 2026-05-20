import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  THEME_STORAGE_KEY,
  THEME_TOGGLE_FOUC_GUARD,
  THEME_TOGGLE_SNIPPET,
} from '../../src/runtime/themeToggle'

interface BootOptions {
  storedTheme?: 'dark' | 'light' | null
  prefersDark?: boolean
  toggles?: number
}

interface Booted {
  dom: JSDOM
  toggles: HTMLButtonElement[]
  storage: Storage
  root: HTMLHtmlElement
}

function boot(opts: BootOptions = {}): Booted {
  const togglesCount = opts.toggles ?? 1
  const buttons = Array.from(
    { length: togglesCount },
    () => '<button data-dtw-theme-toggle></button>'
  ).join('')
  // `runScripts: 'outside-only'` is required for `window.eval` to resolve
  // `document` / `localStorage` against the jsdom realm rather than the
  // host Node globals.
  const dom = new JSDOM(`<!doctype html><html><body>${buttons}</body></html>`, {
    url: 'https://example.com',
    runScripts: 'outside-only',
  })

  // jsdom ≥ 22 exposes `window.localStorage`; pre-seed if requested.
  if (opts.storedTheme !== undefined && opts.storedTheme !== null) {
    dom.window.localStorage.setItem(THEME_STORAGE_KEY, opts.storedTheme)
  }

  // Stub `matchMedia` because jsdom does not implement it. Returns the
  // requested initial preference so we can drive the "no stored theme"
  // branch deterministically.
  const prefersDark = opts.prefersDark ?? false
  ;(dom.window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: q.includes('dark') ? prefersDark : false,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList

  return {
    dom,
    toggles: Array.from(dom.window.document.querySelectorAll('button')) as HTMLButtonElement[],
    storage: dom.window.localStorage,
    root: dom.window.document.documentElement as HTMLHtmlElement,
  }
}

function run(snippet: string, dom: JSDOM): void {
  // `eval` inside the jsdom window context so `document` / `window` /
  // `localStorage` resolve against the test's DOM, not the host Node.
  dom.window.eval(snippet)
}

describe('THEME_TOGGLE_SNIPPET (I-RUN-01)', () => {
  describe('initial aria-pressed reflects effective theme', () => {
    it('reads stored "dark" and reports aria-pressed="true"', () => {
      const ctx = boot({ storedTheme: 'dark' })
      run(THEME_TOGGLE_SNIPPET, ctx.dom)
      expect(ctx.toggles[0].getAttribute('aria-pressed')).toBe('true')
    })

    it('reads stored "light" and reports aria-pressed="false"', () => {
      const ctx = boot({ storedTheme: 'light' })
      run(THEME_TOGGLE_SNIPPET, ctx.dom)
      expect(ctx.toggles[0].getAttribute('aria-pressed')).toBe('false')
    })

    it('falls back to prefers-color-scheme when no theme is stored', () => {
      const ctx = boot({ prefersDark: true })
      run(THEME_TOGGLE_SNIPPET, ctx.dom)
      expect(ctx.toggles[0].getAttribute('aria-pressed')).toBe('true')
    })
  })

  describe('click cycles dark ↔ light and persists', () => {
    it('first click on a light page applies dark and writes localStorage', () => {
      const ctx = boot({ prefersDark: false })
      run(THEME_TOGGLE_SNIPPET, ctx.dom)
      ctx.toggles[0].click()
      expect(ctx.root.getAttribute('data-theme')).toBe('dark')
      expect(ctx.storage.getItem(THEME_STORAGE_KEY)).toBe('dark')
      expect(ctx.toggles[0].getAttribute('aria-pressed')).toBe('true')
    })

    it('second click flips back to light', () => {
      const ctx = boot({ prefersDark: false })
      run(THEME_TOGGLE_SNIPPET, ctx.dom)
      ctx.toggles[0].click()
      ctx.toggles[0].click()
      expect(ctx.root.getAttribute('data-theme')).toBe('light')
      expect(ctx.storage.getItem(THEME_STORAGE_KEY)).toBe('light')
      expect(ctx.toggles[0].getAttribute('aria-pressed')).toBe('false')
    })

    it('mirrors state across multiple toggle buttons', () => {
      const ctx = boot({ toggles: 3 })
      run(THEME_TOGGLE_SNIPPET, ctx.dom)
      ctx.toggles[0].click()
      for (const btn of ctx.toggles) {
        expect(btn.getAttribute('aria-pressed')).toBe('true')
      }
    })
  })

  it('does no work when no toggle buttons are present', () => {
    const ctx = boot({ toggles: 0 })
    expect(() => run(THEME_TOGGLE_SNIPPET, ctx.dom)).not.toThrow()
    expect(ctx.root.getAttribute('data-theme')).toBeNull()
  })

  it('survives a thrown localStorage (sandboxed iframe / private browsing)', () => {
    const ctx = boot()
    // Replace localStorage with a stub whose `setItem` throws — the snippet
    // must catch and continue so the click handler still updates the DOM.
    Object.defineProperty(ctx.dom.window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('denied')
        },
        removeItem: () => {
          throw new Error('denied')
        },
      },
    })
    run(THEME_TOGGLE_SNIPPET, ctx.dom)
    expect(() => ctx.toggles[0].click()).not.toThrow()
    expect(ctx.root.getAttribute('data-theme')).toBe('dark')
  })
})

describe('THEME_TOGGLE_FOUC_GUARD (I-RUN-01)', () => {
  it('stamps data-theme synchronously when localStorage carries dark', () => {
    const ctx = boot({ storedTheme: 'dark' })
    run(THEME_TOGGLE_FOUC_GUARD, ctx.dom)
    expect(ctx.root.getAttribute('data-theme')).toBe('dark')
  })

  it('leaves data-theme unset when storage is empty', () => {
    const ctx = boot()
    run(THEME_TOGGLE_FOUC_GUARD, ctx.dom)
    expect(ctx.root.getAttribute('data-theme')).toBeNull()
  })

  it('ignores a corrupt storage value rather than stamping garbage', () => {
    const ctx = boot()
    ctx.storage.setItem(THEME_STORAGE_KEY, 'not-a-theme')
    run(THEME_TOGGLE_FOUC_GUARD, ctx.dom)
    expect(ctx.root.getAttribute('data-theme')).toBeNull()
  })

  it('does not throw when localStorage access is denied', () => {
    const ctx = boot()
    Object.defineProperty(ctx.dom.window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      },
    })
    expect(() => run(THEME_TOGGLE_FOUC_GUARD, ctx.dom)).not.toThrow()
    expect(ctx.root.getAttribute('data-theme')).toBeNull()
  })
})
