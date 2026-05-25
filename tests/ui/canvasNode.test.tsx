import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CanvasNode } from '@ui/canvas/CanvasNode'

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
})
