import { describe, it, expect } from 'vitest'
import { emitHtml } from '../../src/generator/htmlEmitter'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'
import type { Document, ImageNode, TextNode } from '../../src/document/types'

function makeDoc(tree: Document['tree']): Document {
  return { ...PORTFOLIO_DOCUMENT, tree }
}

describe('emitHtml(document)', () => {
  it('picks the container tag from element.semanticRole', () => {
    const html = emitHtml(PORTFOLIO_DOCUMENT)
    expect(html).toContain('<main')
    expect(html).toContain('<header')
    expect(html).toContain('<footer')
  })

  it('falls back to <div> when a container has no semanticRole', () => {
    const doc = makeDoc({
      id: 'wrapper',
      type: 'container',
      style: { base: {} },
      layout: { base: { mode: 'flex' } },
      children: [],
    })
    const html = emitHtml(doc)
    expect(html).toMatch(/^<div\b/)
  })

  it('uses TextNode.tag for the text element', () => {
    const doc = makeDoc({
      id: 'r',
      type: 'container',
      semanticRole: 'main',
      style: { base: {} },
      layout: { base: { mode: 'flex' } },
      children: [
        {
          id: 't',
          type: 'text',
          tag: 'h2',
          content: 'Subheading',
          style: { base: {} },
        } satisfies TextNode,
      ],
    })
    const html = emitHtml(doc)
    expect(html).toMatch(/<h2[^>]*>Subheading<\/h2>/)
  })

  it('escapes HTML-special characters in text content', () => {
    const doc = makeDoc({
      id: 'r',
      type: 'container',
      semanticRole: 'main',
      style: { base: {} },
      layout: { base: { mode: 'flex' } },
      children: [
        {
          id: 't',
          type: 'text',
          tag: 'p',
          content: '<script>alert("xss")</script> & "quotes"',
          style: { base: {} },
        } satisfies TextNode,
      ],
    })
    const html = emitHtml(doc)
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
  })

  it('emits <img> as a self-closing tag with alt always present (including empty for decorative)', () => {
    const doc = makeDoc({
      id: 'r',
      type: 'container',
      style: { base: {} },
      layout: { base: { mode: 'flex' } },
      children: [
        {
          id: 'deco',
          type: 'image',
          alt: '',
          externalUrl: 'bg.png',
          style: { base: {} },
        } satisfies ImageNode,
      ],
    })
    const html = emitHtml(doc)
    expect(html).toMatch(/<img[^>]*alt=""/)
    expect(html).toMatch(/<img[^>]*\/>/)
    expect(html).not.toContain('</img>')
  })

  it('interpolates {{variable}} from document.variables', () => {
    const html = emitHtml(PORTFOLIO_DOCUMENT)
    expect(html).toContain('Welcome, Ada Lovelace')
    expect(html).not.toContain('{{name}}')
  })

  it('auto-adds rel="noopener noreferrer" to target="_blank" links', () => {
    const html = emitHtml(PORTFOLIO_DOCUMENT)
    expect(html).toMatch(/<a [^>]*rel="noopener noreferrer"/)
  })

  it('emits the unordered list as <ul><li> items', () => {
    const html = emitHtml(PORTFOLIO_DOCUMENT)
    expect(html).toMatch(
      /<ul[^>]*>[\s\S]*<li>TypeScript<\/li>[\s\S]*<li>React<\/li>[\s\S]*<li>Electron<\/li>[\s\S]*<\/ul>/
    )
  })

  it('emits the horizontal divider as <hr/>', () => {
    const html = emitHtml(PORTFOLIO_DOCUMENT)
    expect(html).toMatch(/<hr[^>]*\/>/)
  })

  it('attaches the dtw-el-{id} class to every element', () => {
    const html = emitHtml(PORTFOLIO_DOCUMENT)
    for (const id of ['root', 'header', 'title', 'cta', 'hero', 'divider', 'skills', 'footer']) {
      expect(html).toContain(`dtw-el-${id}`)
    }
  })
})
