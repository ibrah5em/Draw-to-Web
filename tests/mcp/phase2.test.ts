/**
 * Phase 2 tools — update / move / remove (wrapping the existing update,
 * reorder, delete ops), match_layout + apply_template (reusing the matcher
 * and the template builder), and the templates resource + save/load tools.
 * Each returns resulting state or a structured error.
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
  dir = mkdtempSync(join(tmpdir(), 'dtw-mcp-p2-'))
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
  isError?: boolean
}
const textOf = (r: ToolCallResult): string => r.content.map((c) => c.text ?? '').join('\n')
const call = (name: string, args: Record<string, unknown>): Promise<ToolCallResult> =>
  client.callTool({ name, arguments: args }) as Promise<ToolCallResult>
const idFrom = (t: string): string => {
  const m = /\(id: ([\w-]+)\)/.exec(t)
  if (!m) throw new Error(`no id in ${t}`)
  return m[1]!
}
const nodeIdFrom = (t: string, label: string): string => {
  const m = new RegExp(`Inserted ${label} #([\\w-]+)`).exec(t)
  if (!m) throw new Error(`no node id in ${t}`)
  return m[1]!
}

async function docWithH1(): Promise<{ docId: string; h1Id: string }> {
  const docId = idFrom(textOf(await call('create_document', { name: 'P2' })))
  const r = await call('insert_element', {
    documentId: docId,
    type: 'heading',
    tag: 'h1',
    text: 'Title',
  })
  return { docId, h1Id: nodeIdFrom(textOf(r), 'heading') }
}

describe('update_element', () => {
  it('updates text content', async () => {
    const { docId, h1Id } = await docWithH1()
    const r = await call('update_element', { documentId: docId, id: h1Id, text: 'Renamed' })
    expect(r.isError).toBeFalsy()
    expect(textOf(r)).toContain('"Renamed"')
  })

  it('rejects a field that does not apply to the element type', async () => {
    const { docId, h1Id } = await docWithH1()
    const r = await call('update_element', { documentId: docId, id: h1Id, href: 'https://x.com' })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toMatch(/not applicable|href/i)
  })

  it('rejects a grid update that does not fit', async () => {
    const docId = idFrom(textOf(await call('create_document', { name: 'g' })))
    const ins = await call('insert_element', {
      documentId: docId,
      type: 'section',
      gridColumnStart: 1,
      gridColumnSpan: 2,
    })
    const secId = nodeIdFrom(textOf(ins), 'section')
    const r = await call('update_element', {
      documentId: docId,
      id: secId,
      gridColumnStart: 9,
      gridColumnSpan: 8,
    })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toMatch(/does not fit|grid/i)
  })
})

describe('move_element', () => {
  it('reorders a child to a new index', async () => {
    const docId = idFrom(textOf(await call('create_document', { name: 'm' })))
    await call('insert_element', { documentId: docId, type: 'section', name: 'A' })
    const b = await call('insert_element', { documentId: docId, type: 'section', name: 'B' })
    const bId = nodeIdFrom(textOf(b), 'section')
    const r = await call('move_element', { documentId: docId, id: bId, toIndex: 0 })
    expect(r.isError).toBeFalsy()
    expect(textOf(r)).toContain('Moved')
  })
})

describe('remove_element', () => {
  it('removes an element', async () => {
    const docId = idFrom(textOf(await call('create_document', { name: 'r' })))
    const s = await call('insert_element', { documentId: docId, type: 'section' })
    const sId = nodeIdFrom(textOf(s), 'section')
    const r = await call('remove_element', { documentId: docId, id: sId })
    expect(r.isError).toBeFalsy()
  })

  it('refuses to delete the page root', async () => {
    const text = textOf(await call('create_document', { name: 'r2' }))
    const docId = idFrom(text)
    const rootId =
      /#([\w-]+) \(Page\)/.exec(text)?.[1] ?? /- \[container[^\]]*\] #([\w-]+)/.exec(text)![1]!
    const r = await call('remove_element', { documentId: docId, id: rootId })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toMatch(/root/i)
  })

  it('refuses to remove the only <h1> (would invalidate the page)', async () => {
    const { docId, h1Id } = await docWithH1()
    const r = await call('remove_element', { documentId: docId, id: h1Id })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toMatch(/h1/i)
  })
})

describe('match_layout + apply_template', () => {
  it('ranks bundled templates against a document', async () => {
    const { docId } = await docWithH1()
    await call('insert_element', { documentId: docId, type: 'section' })
    const r = await call('match_layout', { documentId: docId })
    expect(r.isError).toBeFalsy()
    const text = textOf(r)
    expect(text).toContain('Ranked template matches')
    expect(text).toMatch(/landing-saas|portfolio-split|agency/)
  })

  it('applies a known template into a new document', async () => {
    const r = await call('apply_template', { templateId: 'landing-saas', name: 'My SaaS' })
    expect(r.isError).toBeFalsy()
    const text = textOf(r)
    expect(text).toContain('Applied template "landing-saas"')
    expect(text).toMatch(/\(id: [\w-]+\)/)
  })

  it('returns a structured error for an unknown template', async () => {
    const r = await call('apply_template', { templateId: 'nope' })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toMatch(/Choose one of:/)
  })
})

describe('resources + persistence tools', () => {
  it('lists available templates as a resource', async () => {
    const res = await client.readResource({ uri: 'dtw://templates' })
    const list = JSON.parse(res.contents[0]!.text as string) as Array<{ id: string }>
    expect(list.some((p) => p.id === 'landing-saas')).toBe(true)
  })

  it('save_document then load_document round-trips through tools', async () => {
    const { docId } = await docWithH1()
    const saved = await call('save_document', { documentId: docId, filePath: 'roundtrip.dtw' })
    expect(saved.isError).toBeFalsy()
    const path = /to (.+\.dtw)/.exec(textOf(saved))![1]!
    const loaded = await call('load_document', { filePath: path })
    expect(loaded.isError).toBeFalsy()
    expect(textOf(loaded)).toContain('Loaded document')
  })
})
