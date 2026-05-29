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
    // Skip-to-content link (I-GEN-19) is always first; the rendered
    // tree starts on the next line.
    expect(html).toMatch(/\n<div\b/)
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

  describe('skip-to-content link (I-GEN-19)', () => {
    it('emits the skip link as the first line of body content', () => {
      const html = emitHtml(PORTFOLIO_DOCUMENT)
      expect(html.startsWith('<a class="dtw-skip-link" href="#root">Skip to content</a>')).toBe(
        true
      )
    })

    it('targets the document tree root id', () => {
      const doc = makeDoc({
        id: 'page-root',
        type: 'container',
        semanticRole: 'main',
        style: { base: {} },
        layout: { base: { mode: 'flex' } },
        children: [],
      })
      const html = emitHtml(doc)
      expect(html).toContain('href="#page-root"')
      // Root container also carries id="page-root" so the anchor resolves.
      expect(html).toMatch(/<main[^>]*id="page-root"/)
    })

    it('respects an author-supplied id on the root container', () => {
      const doc = makeDoc({
        id: 'autogen',
        type: 'container',
        semanticRole: 'main',
        style: { base: {} },
        layout: { base: { mode: 'flex' } },
        attributes: { id: 'custom-main' },
        children: [],
      })
      const html = emitHtml(doc)
      // The skip link still targets the document id (predictable), but
      // the author-supplied id wins on the rendered tag.
      expect(html).toMatch(/<main[^>]*id="custom-main"/)
      expect(html).not.toMatch(/<main[^>]*id="autogen"/)
    })
  })

  describe('img srcset + sizes + width/height from manifest (I-GEN-12)', () => {
    function withAsset(): Document {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      const mutableDoc = doc as unknown as {
        assets: Record<string, unknown>
        tree: { children: Array<{ id: string; type: string }> }
      }
      mutableDoc.assets = {
        avatar: {
          id: 'avatar',
          mimeType: 'image/webp',
          originalFilename: 'avatar.png',
          width: 1600,
          height: 1200,
          srcset: {
            400: 'assets/avatar-400.webp',
            800: 'assets/avatar-800.webp',
            1200: 'assets/avatar-1200.webp',
            1600: 'assets/avatar-1600.webp',
          },
        },
      }
      mutableDoc.tree.children.unshift({
        id: 'av',
        type: 'image',
        // @ts-expect-error -- partial test node, generator only reads img-relevant fields
        alt: 'Headshot',
        assetId: 'avatar',
        style: { base: {} },
      })
      return doc
    }

    it('emits srcset with every variant width', () => {
      const html = emitHtml(withAsset())
      const img = html.match(/<img class="dtw-el-av"[^>]*\/>/)?.[0] ?? ''
      expect(img).toContain(
        'srcset="assets/avatar-400.webp 400w, assets/avatar-800.webp 800w, assets/avatar-1200.webp 1200w, assets/avatar-1600.webp 1600w"'
      )
    })

    it('uses the largest variant as the fallback `src`', () => {
      const html = emitHtml(withAsset())
      const img = html.match(/<img class="dtw-el-av"[^>]*\/>/)?.[0] ?? ''
      expect(img).toContain('src="assets/avatar-1600.webp"')
    })

    it('emits intrinsic width + height (CLS guard)', () => {
      const html = emitHtml(withAsset())
      const img = html.match(/<img class="dtw-el-av"[^>]*\/>/)?.[0] ?? ''
      expect(img).toContain('width="1600"')
      expect(img).toContain('height="1200"')
    })

    it('falls back to a sensible default `sizes` when the author has no hint', () => {
      const html = emitHtml(withAsset())
      const img = html.match(/<img class="dtw-el-av"[^>]*\/>/)?.[0] ?? ''
      expect(img).toContain('sizes="(max-width: 768px) 100vw, 50vw"')
    })

    it('honours an author-supplied sizesHint', () => {
      const doc = withAsset()
      const mutable = doc as unknown as { tree: { children: Array<Record<string, unknown>> } }
      const img = mutable.tree.children[0]
      img.sizesHint = '(min-width: 1280px) 480px, 100vw'
      const html = emitHtml(doc)
      const tag = html.match(/<img class="dtw-el-av"[^>]*\/>/)?.[0] ?? ''
      expect(tag).toContain('sizes="(min-width: 1280px) 480px, 100vw"')
    })

    it('does not emit srcset/sizes when only externalUrl is set (escape hatch)', () => {
      const doc = makeDoc({
        id: 'r',
        type: 'container',
        semanticRole: 'main',
        style: { base: {} },
        layout: { base: { mode: 'flex' } },
        children: [
          {
            id: 'ext',
            type: 'image',
            alt: 'External',
            externalUrl: 'https://example.com/photo.jpg',
            style: { base: {} },
          } satisfies ImageNode,
        ],
      })
      const html = emitHtml(doc)
      const img = html.match(/<img class="dtw-el-ext"[^>]*\/>/)?.[0] ?? ''
      expect(img).toContain('src="https://example.com/photo.jpg"')
      expect(img).not.toContain('srcset=')
      expect(img).not.toContain('sizes=')
      expect(img).not.toContain('width=')
    })
  })

  describe('animation gating hook (I-RUN-07)', () => {
    it('stamps data-dtw-gate-anim on elements whose animation has gateOnView: true', () => {
      const doc = makeDoc({
        id: 'r',
        type: 'container',
        semanticRole: 'main',
        style: { base: {} },
        layout: { base: { mode: 'flex' } },
        children: [
          {
            id: 'gated',
            type: 'text',
            tag: 'p',
            content: 'Hi',
            style: { base: {} },
            animation: { name: 'fadeUp', gateOnView: true },
          } satisfies TextNode,
        ],
      })
      const html = emitHtml(doc)
      expect(html).toMatch(/<p class="dtw-el-gated"[^>]*data-dtw-gate-anim=""/)
    })

    it('does not stamp the attribute when the animation is not gated', () => {
      const doc = makeDoc({
        id: 'r',
        type: 'container',
        semanticRole: 'main',
        style: { base: {} },
        layout: { base: { mode: 'flex' } },
        children: [
          {
            id: 'plain',
            type: 'text',
            tag: 'p',
            content: 'Hi',
            style: { base: {} },
            animation: { name: 'fadeUp' },
          } satisfies TextNode,
        ],
      })
      const html = emitHtml(doc)
      expect(html).not.toContain('data-dtw-gate-anim')
    })

    it('does not stamp the attribute when there is no animation at all', () => {
      const html = emitHtml(PORTFOLIO_DOCUMENT)
      expect(html).not.toContain('data-dtw-gate-anim')
    })
  })

  describe('mailto helper (I-GEN-18)', () => {
    function makeLink(href: string): Document {
      return makeDoc({
        id: 'r',
        type: 'container',
        semanticRole: 'main',
        style: { base: {} },
        layout: { base: { mode: 'flex' } },
        children: [
          {
            id: 'mail',
            type: 'link',
            href,
            content: 'Email me',
            style: { base: {} },
          },
        ],
      })
    }

    it('URL-encodes a plain-text subject and body', () => {
      const html = emitHtml(
        makeLink('mailto:ada@example.com?subject=Hello there!&body=How are you?')
      )
      const link = html.match(/<a class="dtw-el-mail"[^>]*>/)?.[0] ?? ''
      // The HTML attribute encoder maps `&` → `&amp;`; the percent encoding
      // must therefore appear inside the &amp;-joined query params.
      expect(link).toContain('href="mailto:ada@example.com?')
      expect(link).toContain('subject=Hello%20there!')
      expect(link).toContain('body=How%20are%20you%3F')
    })

    it('leaves already-encoded values intact (idempotent)', () => {
      const original = 'mailto:ada@example.com?subject=Hello%20there&body=line1%0Aline2'
      const html = emitHtml(makeLink(original))
      const link = html.match(/<a class="dtw-el-mail"[^>]*>/)?.[0] ?? ''
      expect(link).toContain('subject=Hello%20there')
      expect(link).toContain('body=line1%0Aline2')
    })

    it('passes through hrefs with no query string unchanged', () => {
      const html = emitHtml(makeLink('mailto:ada@example.com'))
      const link = html.match(/<a class="dtw-el-mail"[^>]*>/)?.[0] ?? ''
      expect(link).toContain('href="mailto:ada@example.com"')
    })

    it('does not rewrite non-mailto schemes', () => {
      const html = emitHtml(makeLink('https://example.com/path?q=hello world'))
      const link = html.match(/<a class="dtw-el-mail"[^>]*>/)?.[0] ?? ''
      // The space is escaped by the attribute encoder (not the mailto helper);
      // the helper leaves the URL otherwise untouched.
      expect(link).toContain('href="https://example.com/path?q=hello world"')
    })
  })
})
