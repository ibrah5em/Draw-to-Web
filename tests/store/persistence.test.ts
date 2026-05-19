import { beforeEach, describe, expect, it, vi } from 'vitest'

import { documentSchema } from '../../src/document/schemas'
import type { Document } from '../../src/document/types'
import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import {
  saveProject,
  type ProjectSaveIO,
  type SaveProjectResult,
} from '../../src/store/persistence'

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

const resetStore = (doc: Document = createBlankDocument('Persistence test')): void => {
  useDocumentStore.setState({ document: doc, isDirty: true })
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
