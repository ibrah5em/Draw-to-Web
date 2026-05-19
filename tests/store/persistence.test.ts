import { beforeEach, describe, expect, it, vi } from 'vitest'

import { documentSchema } from '../../src/document/schemas'
import type { Document } from '../../src/document/types'
import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import { useHistoryStore } from '../../src/store/historyStore'
import {
  openProject,
  saveProject,
  type OpenProjectIpcResult,
  type ProjectOpenIO,
  type ProjectSaveIO,
  type SaveProjectResult,
} from '../../src/store/persistence'
import { useSessionStore } from '../../src/store/sessionStore'

/**
 * Build a fresh save-IO stub. The `result` arg controls what the IPC
 * handler returns; the returned `calls` reference lets tests assert
 * what was sent over the wire.
 */
function stubIO(result: SaveProjectResult): {
  io: ProjectSaveIO
  calls: Array<{ json: string; suggestedName: string }>
} {
  const calls: Array<{ json: string; suggestedName: string }> = []
  return {
    calls,
    io: {
      saveProject: vi.fn(async (json: string, suggestedName: string) => {
        calls.push({ json, suggestedName })
        return result
      }),
    },
  }
}

/** Build a fresh open-IO stub returning the given canned IPC result. */
function stubOpenIO(result: OpenProjectIpcResult): ProjectOpenIO {
  return {
    openProject: vi.fn(async () => result),
  }
}

const resetStore = (doc: Document = createBlankDocument('Persistence test')): void => {
  useDocumentStore.setState({ document: doc, isDirty: true })
  useHistoryStore.setState({ past: [], future: [] })
  useSessionStore.setState({ selectedIds: [] })
}

describe('saveProject', () => {
  beforeEach(() => resetStore())

  it('serialises the current document and passes its meta.name as the suggested filename', async () => {
    const { io, calls } = stubIO({ success: true, filePath: '/tmp/Persistence test.dtw' })
    await saveProject(io)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.suggestedName).toBe('Persistence test')
    // The JSON payload must parse back to the in-memory document and
    // re-validate against the schema (round-trip parity is the DoD).
    const parsed = JSON.parse(calls[0]!.json)
    expect(() => documentSchema.parse(parsed)).not.toThrow()
    expect(parsed).toEqual(useDocumentStore.getState().document)
  })

  it('clears the dirty flag on success', async () => {
    const { io } = stubIO({ success: true, filePath: '/tmp/ok.dtw' })
    expect(useDocumentStore.getState().isDirty).toBe(true)
    const res = await saveProject(io)
    expect(res.success).toBe(true)
    expect(useDocumentStore.getState().isDirty).toBe(false)
  })

  it('keeps the dirty flag when the user cancels the dialog', async () => {
    const { io } = stubIO({ success: false })
    const res = await saveProject(io)
    expect(res.success).toBe(false)
    expect(res.error).toBeUndefined()
    expect(useDocumentStore.getState().isDirty).toBe(true)
  })

  it('keeps the dirty flag when the IPC handler reports an error', async () => {
    const { io } = stubIO({ success: false, error: 'Disk full' })
    const res = await saveProject(io)
    expect(res.success).toBe(false)
    expect(res.error).toBe('Disk full')
    expect(useDocumentStore.getState().isDirty).toBe(true)
  })

  it('round-trip preserves a byte-equal document (Y-PER-01 DoD)', async () => {
    // Mutate the store away from the initial blank shape so the round-trip
    // exercises more than the empty defaults.
    const seeded: Document = {
      ...createBlankDocument('Round trip'),
      variables: { name: 'Yousef', role: 'Engineer' },
    }
    useDocumentStore.setState({ document: seeded, isDirty: true })
    const { io, calls } = stubIO({ success: true, filePath: '/tmp/rt.dtw' })
    await saveProject(io)
    const reloaded = JSON.parse(calls[0]!.json) as Document
    // Byte-equal at the JSON level: re-serialising the parsed copy must
    // produce the exact string we sent down the IPC wire.
    expect(JSON.stringify(reloaded)).toBe(calls[0]!.json)
    expect(reloaded).toEqual(seeded)
  })
})

describe('openProject', () => {
  beforeEach(() => resetStore())

  it('hydrates the document store on success and clears history + selection', async () => {
    // Seed history + selection on the *previous* document so we can prove
    // they get reset after load.
    useHistoryStore.setState({
      past: [{ patches: [], inversePatches: [], label: 'stale', timestamp: 0 }],
      future: [],
    })
    useSessionStore.setState({ selectedIds: ['stale-element-id'] })

    const newDoc = createBlankDocument('Loaded from disk')
    const ipc = stubOpenIO({
      success: true,
      filePath: '/tmp/loaded.dtw',
      json: JSON.stringify(newDoc),
    })

    const res = await openProject(ipc)
    expect(res.kind).toBe('success')
    if (res.kind === 'success') {
      expect(res.filePath).toBe('/tmp/loaded.dtw')
      expect(res.document).toEqual(newDoc)
    }

    const state = useDocumentStore.getState()
    expect(state.document).toEqual(newDoc)
    expect(state.isDirty).toBe(false)
    expect(useHistoryStore.getState().past).toEqual([])
    expect(useSessionStore.getState().selectedIds).toEqual([])
  })

  it('save → open round-trip restores the exact in-memory document', async () => {
    const seeded: Document = {
      ...createBlankDocument('Round trip'),
      variables: { name: 'Yousef' },
    }
    useDocumentStore.setState({ document: seeded, isDirty: true })

    // Save: capture the JSON the renderer would have written.
    const save = stubIO({ success: true, filePath: '/tmp/rt.dtw' })
    await saveProject(save.io)

    // Open: feed the captured JSON back in.
    useDocumentStore.setState({ document: createBlankDocument('Different'), isDirty: false })
    const open = stubOpenIO({
      success: true,
      filePath: '/tmp/rt.dtw',
      json: save.calls[0]!.json,
    })
    const res = await openProject(open)
    expect(res.kind).toBe('success')
    expect(useDocumentStore.getState().document).toEqual(seeded)
  })

  it('returns kind: "cancelled" when the user dismisses the open dialog', async () => {
    const before = useDocumentStore.getState().document
    const ipc = stubOpenIO({ success: false })
    const res = await openProject(ipc)
    expect(res.kind).toBe('cancelled')
    // No store mutation on cancel.
    expect(useDocumentStore.getState().document).toBe(before)
  })

  it('returns kind: "error" with stage "ipc" when the main process reports an error', async () => {
    const before = useDocumentStore.getState().document
    const ipc = stubOpenIO({ success: false, error: 'Project file exceeds size limit' })
    const res = await openProject(ipc)
    expect(res.kind).toBe('error')
    if (res.kind === 'error') {
      expect(res.stage).toBe('ipc')
      expect(res.message).toBe('Project file exceeds size limit')
    }
    expect(useDocumentStore.getState().document).toBe(before)
  })

  it('returns kind: "error" with stage "parse" on malformed JSON', async () => {
    const before = useDocumentStore.getState().document
    const ipc = stubOpenIO({
      success: true,
      filePath: '/tmp/bad.dtw',
      json: '{ "version": "0.2.0", ',
    })
    const res = await openProject(ipc)
    expect(res.kind).toBe('error')
    if (res.kind === 'error') {
      expect(res.stage).toBe('parse')
    }
    expect(useDocumentStore.getState().document).toBe(before)
  })

  it('returns kind: "error" with stage "migrate" when the payload fails schema validation', async () => {
    const before = useDocumentStore.getState().document
    // Valid JSON, wrong shape — version is current so migrate short-circuits
    // straight to documentSchema.parse which will reject the structure.
    const ipc = stubOpenIO({
      success: true,
      filePath: '/tmp/wrong-shape.dtw',
      json: JSON.stringify({ version: '0.2.0', not: 'a document' }),
    })
    const res = await openProject(ipc)
    expect(res.kind).toBe('error')
    if (res.kind === 'error') {
      expect(res.stage).toBe('migrate')
    }
    expect(useDocumentStore.getState().document).toBe(before)
  })

  it('returns kind: "error" with stage "migrate" when the version field has no migration path', async () => {
    const before = useDocumentStore.getState().document
    const ipc = stubOpenIO({
      success: true,
      filePath: '/tmp/unknown-version.dtw',
      json: JSON.stringify({ version: '9.9.9', anything: 'here' }),
    })
    const res = await openProject(ipc)
    expect(res.kind).toBe('error')
    if (res.kind === 'error') {
      expect(res.stage).toBe('migrate')
      expect(res.message).toMatch(/migration/i)
    }
    expect(useDocumentStore.getState().document).toBe(before)
  })

  it('returns kind: "error" with stage "ipc" when success is true but payload is missing', async () => {
    const before = useDocumentStore.getState().document
    const ipc = stubOpenIO({ success: true })
    const res = await openProject(ipc)
    expect(res.kind).toBe('error')
    if (res.kind === 'error') {
      expect(res.stage).toBe('ipc')
    }
    expect(useDocumentStore.getState().document).toBe(before)
  })
})
