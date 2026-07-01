/**
 * Agent flow integration — create → insert several → read → run_a11y_check →
 * export, asserting a real valid bundle and that the project invariants hold
 * (no absolute positioning, grid placement reached the output, deterministic).
 */

import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import JSZip from 'jszip'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createServer } from '../../mcp/createServer'
import { installExportShim } from '../../mcp/electronShim'
import { Workspace } from '../../mcp/session'

let client: Client
let dir: string

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dtw-mcp-int-'))
  installExportShim(dir)
  const server = createServer(new Workspace(dir))
  const [a, b] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'agent', version: '0' })
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
  if (!m) throw new Error(`no id in ${text}`)
  return m[1]!
}

describe('agent flow: build → read → check → export', () => {
  it('drives a full session through MCP and produces a valid, invariant-clean bundle', async () => {
    // 1. create
    const id = idFrom(textOf(await call('create_document', { name: 'Agent Site' })))

    // 2. insert several elements (heading + sections + a paragraph)
    expect(
      (
        await call('insert_element', {
          documentId: id,
          type: 'heading',
          tag: 'h1',
          text: 'Agent Site',
        })
      ).isError
    ).toBeFalsy()
    expect(
      (
        await call('insert_element', {
          documentId: id,
          type: 'section',
          gridColumnStart: 1,
          gridColumnSpan: 6,
        })
      ).isError
    ).toBeFalsy()
    const sectionResult = await call('insert_element', {
      documentId: id,
      type: 'section',
      gridColumnStart: 7,
      gridColumnSpan: 6,
    })
    expect(sectionResult.isError).toBeFalsy()
    expect(
      (
        await call('insert_element', {
          documentId: id,
          type: 'text',
          text: 'Built entirely through MCP tools.',
        })
      ).isError
    ).toBeFalsy()

    // 3. read the tree resource (the agent's eyes)
    const res = await client.readResource({ uri: `dtw://document/${id}/tree` })
    const treeJson = JSON.parse(res.contents[0]!.text as string) as {
      tree: { children: unknown[] }
    }
    expect(treeJson.tree.children.length).toBe(4)
    // vocabulary resource is available too
    const vocab = await client.readResource({ uri: 'dtw://vocabulary' })
    expect(vocab.contents[0]!.text).toContain('elementTypes')

    // 4. a11y check (no export)
    const a11y = await call('run_a11y_check', { documentId: id })
    expect(textOf(a11y)).toContain('A11y gate: PASS')

    // 5. export
    const exported = await call('export_site', { documentId: id, projectName: 'agent-site' })
    expect(exported.isError).toBeFalsy()
    const path = /→ (.+\.zip)/.exec(textOf(exported))?.[1]
    expect(path).toBeTruthy()

    // --- invariants hold in the generated bundle ---
    const zip = await JSZip.loadAsync(readFileSync(path!))
    const css = (await zip.file('styles.css')?.async('string')) ?? ''
    const html = (await zip.file('index.html')?.async('string')) ?? ''

    expect(css.length).toBeGreaterThan(0)
    expect(html).toContain('<!doctype html>')
    // No absolute positioning (the project's hard layout guard).
    expect(css).not.toMatch(/position:\s*absolute/i)
    // Grid placement reached the output as a grid-column string, not pixels.
    expect(css).toMatch(/grid-column:\s*\d+\s*\/\s*span\s*\d+/)
    // No inline styles / scripts / handlers in HTML.
    expect(html).not.toMatch(/\sstyle="/)
    expect(html).not.toMatch(/<script\b(?![^>]*type="application\/ld\+json")/i)
    expect(html).not.toMatch(/\son[a-z]+=/i)
    // Exactly one <h1>.
    expect((html.match(/<h1[\s>]/gi) ?? []).length).toBe(1)
  })

  it('keeps export deterministic — two exports of the same doc are byte-identical', async () => {
    const id = idFrom(textOf(await call('create_document', { name: 'Determinism' })))
    await call('insert_element', { documentId: id, type: 'heading', tag: 'h1', text: 'Same' })
    await call('insert_element', {
      documentId: id,
      type: 'section',
      gridColumnStart: 1,
      gridColumnSpan: 4,
    })

    const read = async (label: string): Promise<{ html: string; css: string }> => {
      const r = await call('export_site', { documentId: id, projectName: label })
      const path = /→ (.+\.zip)/.exec(textOf(r))![1]!
      const zip = await JSZip.loadAsync(readFileSync(path))
      return {
        html: await zip.file('index.html')!.async('string'),
        css: await zip.file('styles.css')!.async('string'),
      }
    }
    const one = await read('det-1')
    const two = await read('det-2')
    expect(one.html).toBe(two.html)
    expect(one.css).toBe(two.css)
  })
})
