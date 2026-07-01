/**
 * Session store (`Workspace`) — documents persist across calls, operations
 * commit through the validated mutate path, and `.dtw` save/load round-trips.
 */

import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { InsertElementOp } from '../../src/document/operations'
import { buildNode } from '../../mcp/nodeFactory'
import { SessionError, Workspace } from '../../mcp/session'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'dtw-mcp-'))

const h1 = () =>
  buildNode('heading', { text: 'Hi', tag: 'h1' }, { pageHasH1: false, breakpoint: 'base' })

describe('Workspace — session store', () => {
  it('creates documents and retrieves them by id across calls', () => {
    const ws = new Workspace(tmp())
    const { id } = ws.create('My site')
    expect(ws.has(id)).toBe(true)
    expect(ws.get(id).meta.name).toBe('My site')
    // A later, separate call still sees it (state persists across tool calls).
    expect(ws.get(id).meta.name).toBe('My site')
  })

  it('throws a SessionError for an unknown id', () => {
    const ws = new Workspace(tmp())
    expect(() => ws.get('missing')).toThrow(SessionError)
  })

  it('commits a successful operation to the session', () => {
    const ws = new Workspace(tmp())
    const { id, document } = ws.create('x')
    const op: InsertElementOp = { kind: 'insertElement', parentId: document.tree.id, node: h1() }
    const res = ws.applyOperation(id, op)
    expect(res.ok).toBe(true)
    expect(ws.get(id).tree.type === 'container' && ws.get(id).tree.children.length).toBe(1)
  })

  it('does not commit (and returns a structured error) on an invalid operation', () => {
    const ws = new Workspace(tmp())
    const { id } = ws.create('x')
    const badOp: InsertElementOp = {
      kind: 'insertElement',
      parentId: 'no-such-parent',
      node: h1(),
    }
    const res = ws.applyOperation(id, badOp)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.kind).toBe('operation')
    // session unchanged
    expect((ws.get(id).tree as { children: unknown[] }).children.length).toBe(0)
  })

  it('round-trips a document to .dtw and back, deep-equal', () => {
    const dir = tmp()
    const ws = new Workspace(dir)
    const { id, document } = ws.create('Round trip')
    ws.applyOperation(id, { kind: 'insertElement', parentId: document.tree.id, node: h1() })
    const saved = ws.get(id)

    const path = ws.save(id)
    expect(existsSync(path)).toBe(true)

    const ws2 = new Workspace(dir)
    const { document: loaded } = ws2.load(path)
    expect(loaded).toEqual(saved)
  })

  it('rejects a malformed .dtw file with a SessionError', () => {
    const dir = tmp()
    const ws = new Workspace(dir)
    const path = join(dir, 'broken.dtw')
    writeFileSync(path, '{ not json')
    expect(() => ws.load(path)).toThrow(SessionError)
  })
})
