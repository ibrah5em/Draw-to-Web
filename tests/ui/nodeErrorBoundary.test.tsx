// @vitest-environment jsdom
import { act, type JSX } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NodeErrorFallback } from '@ui/canvas/NodeErrorFallback'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

function Boom(): never {
  throw new Error('render failed')
}

describe('Per-element error boundary (L-CAN-09)', () => {
  it('isolates a throwing node and keeps siblings interactive', () => {
    // React logs the caught error; silence it for a clean test run.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let clicks = 0
    act(() =>
      root.render(
        <>
          <ErrorBoundary FallbackComponent={NodeErrorFallback} resetKeys={[1]}>
            <Boom />
          </ErrorBoundary>
          <button onClick={() => (clicks += 1)}>sibling</button>
        </>
      )
    )
    // The throwing node is replaced by the fallback…
    expect(container.textContent).toContain('Element failed to render')
    expect(container.textContent).toContain('render failed')
    // …and the sibling still rendered and responds to interaction.
    const sibling = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'sibling'
    )
    expect(sibling).toBeTruthy()
    act(() => sibling!.click())
    expect(clicks).toBe(1)
  })

  it('fallback Retry resets the boundary', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldThrow = true
    function Maybe(): JSX.Element {
      if (shouldThrow) throw new Error('boom')
      return <span>recovered</span>
    }
    act(() =>
      root.render(
        <ErrorBoundary FallbackComponent={NodeErrorFallback}>
          <Maybe />
        </ErrorBoundary>
      )
    )
    expect(container.textContent).toContain('Element failed to render')
    shouldThrow = false
    const retry = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Retry')
    )
    act(() => retry!.click())
    expect(container.textContent).toContain('recovered')
  })
})
