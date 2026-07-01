/**
 * Phase 3 — presets & composition (insert_preset, batch_insert, wrap_elements,
 * duplicate_element), document-level tools (set_tokens, set_seo, set_runtime,
 * set_theme), preview_html, and machine-readable structuredContent on results.
 */

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createServer } from '../../mcp/createServer'
import { installExportShim } from '../../mcp/electronShim'
import { Workspace } from '../../mcp/session'

let client: Client
let dir: string

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dtw-mcp-p3-'))
  installExportShim(dir)
  const server = createServer(new Workspace(dir))
  const [a, b] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'test', version: '0' })
  await Promise.all([server.connect(b), client.connect(a)])
})
afterEach(async () => {
  await client.close()
})

interface ToolCallResult {
  content: Array<{ type: string; text?: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}
const textOf = (r: ToolCallResult): string => r.content.map((c) => c.text ?? '').join('\n')
const call = (name: string, args: Record<string, unknown>): Promise<ToolCallResult> =>
  client.callTool({ name, arguments: args }) as Promise<ToolCallResult>
const idFrom = (t: string): string => /\(id: ([\w-]+)\)/.exec(t)![1]!
const nodeIdFrom = (t: string, label: string): string =>
  new RegExp(`Inserted ${label} #([\\w-]+)`).exec(t)![1]!

const newDoc = async (): Promise<string> =>
  idFrom(textOf(await call('create_document', { name: 'P3' })))

describe('machine-readable structuredContent', () => {
  it('every mutating result carries a parseable document state', async () => {
    const r = await call('create_document', { name: 'Structured' })
    const sc = r.structuredContent as {
      documentId: string
      nodes: unknown[]
      validation: { errors: unknown[] }
    }
    expect(typeof sc.documentId).toBe('string')
    expect(Array.isArray(sc.nodes)).toBe(true)
    expect(Array.isArray(sc.validation.errors)).toBe(true)
  })

  it('insert reflects the new node + grid placement in structuredContent', async () => {
    const id = await newDoc()
    const r = await call('insert_element', {
      documentId: id,
      type: 'section',
      gridColumnStart: 1,
      gridColumnSpan: 6,
    })
    const sc = r.structuredContent as { nodes: Array<{ type: string; gridColumn?: string }> }
    const section = sc.nodes.find((n) => n.type === 'container' && n.gridColumn === '1 / span 6')
    expect(section).toBeTruthy()
  })
})

describe('insert_preset', () => {
  it('materialises a preset subtree (reusing presetsRegistry)', async () => {
    const id = await newDoc()
    const r = await call('insert_preset', { documentId: id, presetId: 'hero-centered' })
    expect(r.isError).toBeFalsy()
    const sc = r.structuredContent as { nodeCount: number }
    expect(sc.nodeCount).toBeGreaterThan(2) // hero spawns multiple primitives
  })

  it('rejects an unknown preset with the id list', async () => {
    const id = await newDoc()
    const r = await call('insert_preset', { documentId: id, presetId: 'nope' })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toMatch(/Choose one of:/)
  })

  it('lists presets as a resource', async () => {
    const res = await client.readResource({ uri: 'dtw://presets' })
    const ids = JSON.parse(res.contents[0]!.text as string) as string[]
    expect(ids).toContain('hero-centered')
  })
})

describe('batch_insert', () => {
  it('inserts several elements atomically', async () => {
    const id = await newDoc()
    const r = await call('batch_insert', {
      documentId: id,
      elements: [
        { type: 'heading', tag: 'h1', text: 'Title' },
        { type: 'text', text: 'Intro' },
        { type: 'section', gridColumnStart: 1, gridColumnSpan: 12 },
      ],
    })
    expect(r.isError).toBeFalsy()
    const sc = r.structuredContent as { nodes: unknown[] }
    expect(sc.nodes.length).toBe(4) // page + 3
  })

  it('applies none when one element has a bad grid span', async () => {
    const id = await newDoc()
    const r = await call('batch_insert', {
      documentId: id,
      elements: [
        { type: 'text', text: 'ok' },
        { type: 'section', gridColumnStart: 10, gridColumnSpan: 8 },
      ],
    })
    expect(r.isError).toBe(true)
    // nothing applied: the tree still has just the page root
    const res = await client.readResource({ uri: `dtw://document/${id}/tree` })
    const doc = JSON.parse(res.contents[0]!.text as string) as { tree: { children: unknown[] } }
    expect(doc.tree.children.length).toBe(0)
  })
})

describe('duplicate_element + wrap_elements', () => {
  it('duplicates an element after the original', async () => {
    const id = await newDoc()
    const sId = nodeIdFrom(
      textOf(await call('insert_element', { documentId: id, type: 'section' })),
      'section'
    )
    const r = await call('duplicate_element', { documentId: id, id: sId })
    expect(r.isError).toBeFalsy()
    const sc = r.structuredContent as { nodes: Array<{ type: string; parentId?: string }> }
    expect(sc.nodes.filter((n) => n.type === 'container' && n.parentId).length).toBe(2)
  })

  it('wraps two siblings in a group', async () => {
    const id = await newDoc()
    const a = nodeIdFrom(
      textOf(await call('insert_element', { documentId: id, type: 'text', text: 'a' })),
      'text'
    )
    const b = nodeIdFrom(
      textOf(await call('insert_element', { documentId: id, type: 'text', text: 'b' })),
      'text'
    )
    const r = await call('wrap_elements', { documentId: id, ids: [a, b], name: 'Row' })
    expect(r.isError).toBeFalsy()
    expect(textOf(r)).toMatch(/Wrapped 2/)
  })
})

describe('document-level tools', () => {
  it('set_tokens adds a color token', async () => {
    const id = await newDoc()
    const r = await call('set_tokens', {
      documentId: id,
      tokens: [{ category: 'color', id: 'brand', light: '#ff0000', dark: '#aa0000' }],
    })
    expect(r.isError).toBeFalsy()
    const res = await client.readResource({ uri: `dtw://document/${id}/tree` })
    const doc = JSON.parse(res.contents[0]!.text as string) as {
      tokens: { color: Array<{ id: string }> }
    }
    expect(doc.tokens.color.some((c) => c.id === 'brand')).toBe(true)
  })

  it('set_seo updates the page title', async () => {
    const id = await newDoc()
    await call('set_seo', { documentId: id, title: 'My Page', description: 'A nice page' })
    const res = await client.readResource({ uri: `dtw://document/${id}/tree` })
    const doc = JSON.parse(res.contents[0]!.text as string) as {
      seo: { title: string; description: string }
    }
    expect(doc.seo.title).toBe('My Page')
    expect(doc.seo.description).toBe('A nice page')
  })

  it('set_runtime enabling theme toggle emits a <script> in preview HTML', async () => {
    const id = await newDoc()
    await call('set_runtime', { documentId: id, themeToggle: true })
    const r = await call('preview_html', { documentId: id })
    const sc = r.structuredContent as { html: string }
    expect(sc.html).toMatch(/<script/i)
  })

  it('set_theme pins the default theme', async () => {
    const id = await newDoc()
    const r = await call('set_theme', { documentId: id, defaultTheme: 'dark' })
    expect(r.isError).toBeFalsy()
    const res = await client.readResource({ uri: `dtw://document/${id}/tree` })
    const doc = JSON.parse(res.contents[0]!.text as string) as {
      settings: { defaultTheme: string }
    }
    expect(doc.settings.defaultTheme).toBe('dark')
  })
})

describe('preview_html', () => {
  it('returns generated html/css without exporting', async () => {
    const id = await newDoc()
    await call('insert_element', { documentId: id, type: 'heading', tag: 'h1', text: 'Hi' })
    const r = await call('preview_html', { documentId: id })
    const sc = r.structuredContent as { html: string; css: string }
    expect(sc.html).toContain('<!doctype html>')
    expect(sc.css.length).toBeGreaterThan(0)
  })
})
