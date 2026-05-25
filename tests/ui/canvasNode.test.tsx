import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { isTokenRef, resolveToken } from '@document/tokens'
import type { StyleResolver } from '@ui/canvas/buildStyle'
import { CanvasNode } from '@ui/canvas/CanvasNode'
import { StyleResolverProvider } from '@ui/canvas/resolverContext'

import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

describe('CanvasNode', () => {
  it('renders the portfolio fixture tree without errors', () => {
    const html = renderToStaticMarkup(<CanvasNode node={PORTFOLIO_DOCUMENT.tree} />)
    expect(html).toMatchSnapshot()
  })

  it('emits semantic tags for container roles', () => {
    const html = renderToStaticMarkup(<CanvasNode node={PORTFOLIO_DOCUMENT.tree} />)
    expect(html).toContain('<main')
    expect(html).toContain('<header')
    expect(html).toContain('<footer')
    expect(html).toContain('<h1')
  })

  it('renders list items and an image with alt text', () => {
    const html = renderToStaticMarkup(<CanvasNode node={PORTFOLIO_DOCUMENT.tree} />)
    expect(html).toContain('<li>TypeScript</li>')
    expect(html).toContain('alt="A photo of the author at their desk"')
  })

  it('resolves token-bound values through a provided resolver (L-CAN-03)', () => {
    const resolve: StyleResolver = (value) =>
      isTokenRef(value)
        ? (resolveToken(PORTFOLIO_DOCUMENT.tokens, value, 'light') ?? undefined)
        : value
    const html = renderToStaticMarkup(
      <StyleResolverProvider value={resolve}>
        <CanvasNode node={PORTFOLIO_DOCUMENT.tree} />
      </StyleResolverProvider>
    )
    expect(html).toContain('background-color:#ffffff')
    expect(html).toContain('#0066ff')
  })

  it('switches color tokens with the active theme (L-CAN-03)', () => {
    const resolve: StyleResolver = (value) =>
      isTokenRef(value)
        ? (resolveToken(PORTFOLIO_DOCUMENT.tokens, value, 'dark') ?? undefined)
        : value
    const html = renderToStaticMarkup(
      <StyleResolverProvider value={resolve}>
        <CanvasNode node={PORTFOLIO_DOCUMENT.tree} />
      </StyleResolverProvider>
    )
    expect(html).toContain('background-color:#0b0b10')
  })
})
