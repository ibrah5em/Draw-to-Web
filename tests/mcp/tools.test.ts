/**
 * Tool behaviour — driven through a real MCP Client over the in-memory
 * transport. Each tool wraps the right operation, returns the resulting state
 * (perception), and returns a STRUCTURED error (not a throw) on invalid input
 * — including the second-`<h1>` and bad-grid-span cases.
 */

import { mkdtempSync, readdirSync } from 'node:fs'
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
  dir = mkdtempSync(join(tmpdir(), 'dtw-mcp-'))
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

const idFrom = (text: string): string => {
  const m = /\(id: ([\w-]+)\)/.exec(text)
  if (!m) throw new Error(`no document id in:\n${text}`)
  return m[1]!
}

async function newDoc(): Promise<string> {
  const r = await call('create_document', { name: 'Test' })
  expect(r.isError).toBeFalsy()
  return idFrom(textOf(r))
}

describe('create_document', () => {
  it('creates a document and returns its id + tree summary', async () => {
    const r = await call('create_document', { name: 'Hello' })
    expect(r.isError).toBeFalsy()
    const text = textOf(r)
    expect(text).toContain('Created document')
    expect(text).toMatch(/\(id: [\w-]+\)/)
    expect(text).toContain('Page')
  })
})

describe('insert_element', () => {
  it('inserts a section and returns the updated tree', async () => {
    const id = await newDoc()
    const r = await call('insert_element', {
      documentId: id,
      type: 'section',
      gridColumnStart: 1,
      gridColumnSpan: 6,
    })
    expect(r.isError).toBeFalsy()
    const text = textOf(r)
    expect(text).toContain('Inserted section')
    expect(text).toContain('col 1 / span 6')
  })

  it('returns a structured error (not a throw) for an unknown document', async () => {
    const r = await call('insert_element', { documentId: 'nope', type: 'section' })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toMatch(/not found/i)
  })

  it('rejects a second <h1> with a recoverable, structured error', async () => {
    const id = await newDoc()
    const first = await call('insert_element', {
      documentId: id,
      type: 'heading',
      tag: 'h1',
      text: 'Title',
    })
    expect(first.isError).toBeFalsy()

    const second = await call('insert_element', {
      documentId: id,
      type: 'heading',
      tag: 'h1',
      text: 'Another',
    })
    expect(second.isError).toBe(true)
    const text = textOf(second)
    expect(text).toMatch(/h1/i)
    expect(text).toMatch(/fix:/i) // carries an actionable fix
    // The rejected insert did not corrupt the doc — still exactly one h1.
    const a11y = await call('run_a11y_check', { documentId: id })
    expect(textOf(a11y)).not.toMatch(/More than one <h1>/)
  })

  it('rejects a grid span that does not fit with a structured error', async () => {
    const id = await newDoc()
    const r = await call('insert_element', {
      documentId: id,
      type: 'section',
      gridColumnStart: 10,
      gridColumnSpan: 6, // 10 + 6 - 1 = 15 > 12
    })
    expect(r.isError).toBe(true)
    const text = textOf(r)
    expect(text).toMatch(/does not fit|grid/i)
    expect(text).toMatch(/fix:/i)
  })
})

describe('run_a11y_check', () => {
  it('reports the missing <h1> validation error on a blank document', async () => {
    const id = await newDoc()
    const r = await call('run_a11y_check', { documentId: id })
    expect(r.isError).toBeFalsy()
    expect(textOf(r)).toMatch(/missing an <h1>|<h1>/i)
  })

  it('passes once the page has a heading', async () => {
    const id = await newDoc()
    await call('insert_element', { documentId: id, type: 'heading', tag: 'h1', text: 'Welcome' })
    const r = await call('run_a11y_check', { documentId: id })
    expect(textOf(r)).toContain('A11y gate: PASS')
  })
})

describe('export_site', () => {
  it('blocks export of an invalid document (missing <h1>) with a staged error', async () => {
    const id = await newDoc()
    const r = await call('export_site', { documentId: id })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toMatch(/stage "validate"/)
  })

  it('exports a valid document to a real bundle on disk', async () => {
    const id = await newDoc()
    await call('insert_element', { documentId: id, type: 'heading', tag: 'h1', text: 'Welcome' })
    const r = await call('export_site', { documentId: id, projectName: 'mysite' })
    expect(r.isError).toBeFalsy()
    expect(textOf(r)).toContain('Accessibility gate: passed')
    expect(readdirSync(dir).some((f) => f.endsWith('.zip'))).toBe(true)
  })
})
