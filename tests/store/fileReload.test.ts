import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import {
  acceptFileReload,
  declineFileReload,
  type FileReloadIO,
  type OpenByPathIpcResult,
} from '../../src/store/fileReload'
import { useHistoryStore } from '../../src/store/historyStore'
import { useSessionStore } from '../../src/store/sessionStore'

const PROJECT_PATH = '/tmp/project.dtw'

/** Build a stub IO whose `openProjectByPath` returns the given result. */
function stubIO(result: OpenByPathIpcResult): { io: FileReloadIO; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    io: {
      openProjectByPath: vi.fn(async (path: string) => {
        calls.push(path)
        return result
      }),
    },
  }
}

/** A valid on-disk payload: a blank document serialized exactly as save would. */
function diskJson(name: string): string {
  return JSON.stringify(createBlankDocument(name))
}

beforeEach(() => {
  useDocumentStore.setState({ document: createBlankDocument('In-Memory'), isDirty: true })
  useHistoryStore.setState({
    past: [{ patches: [], inversePatches: [], label: 'edit', timestamp: 0 }],
    future: [],
  })
  useSessionStore.setState({ selectedIds: ['stale-id'], currentFilePath: PROJECT_PATH })
})

describe('acceptFileReload — Y-PER-05 accept-reload', () => {
  it('reloads the disk version by path and hydrates the store', async () => {
    const { io, calls } = stubIO({
      success: true,
      filePath: PROJECT_PATH,
      json: diskJson('From-Disk'),
    })

    const result = await acceptFileReload(PROJECT_PATH, io)

    expect(result.kind).toBe('reloaded')
    expect(calls).toEqual([PROJECT_PATH])
    expect(useDocumentStore.getState().document.meta.name).toBe('From-Disk')
  })

  it('clears the dirty flag — the in-memory state now matches disk', async () => {
    const { io } = stubIO({ success: true, filePath: PROJECT_PATH, json: diskJson('Disk') })
    await acceptFileReload(PROJECT_PATH, io)
    expect(useDocumentStore.getState().isDirty).toBe(false)
  })

  it('clears the undo/redo timeline (reloaded doc is a fresh baseline)', async () => {
    const { io } = stubIO({ success: true, filePath: PROJECT_PATH, json: diskJson('Disk') })
    await acceptFileReload(PROJECT_PATH, io)
    expect(useHistoryStore.getState().past).toHaveLength(0)
    expect(useHistoryStore.getState().future).toHaveLength(0)
  })

  it('drops stale selection and keeps the session bound to the same path', async () => {
    const { io } = stubIO({ success: true, filePath: PROJECT_PATH, json: diskJson('Disk') })
    await acceptFileReload(PROJECT_PATH, io)
    expect(useSessionStore.getState().selectedIds).toEqual([])
    expect(useSessionStore.getState().currentFilePath).toBe(PROJECT_PATH)
  })

  it('reports an ipc-stage error and leaves the store untouched when the read fails', async () => {
    const { io } = stubIO({ success: false, error: 'file moved' })
    const result = await acceptFileReload(PROJECT_PATH, io)

    expect(result).toEqual({ kind: 'error', stage: 'ipc', message: 'file moved' })
    // In-memory document and history survive an error.
    expect(useDocumentStore.getState().document.meta.name).toBe('In-Memory')
    expect(useHistoryStore.getState().past).toHaveLength(1)
  })

  it('reports a parse-stage error on malformed JSON', async () => {
    const { io } = stubIO({ success: true, filePath: PROJECT_PATH, json: '{ not json' })
    const result = await acceptFileReload(PROJECT_PATH, io)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') expect(result.stage).toBe('parse')
    expect(useDocumentStore.getState().document.meta.name).toBe('In-Memory')
  })

  it('reports a migrate-stage error when the payload fails schema validation', async () => {
    const { io } = stubIO({
      success: true,
      filePath: PROJECT_PATH,
      json: JSON.stringify({ version: '0.2.0', not: 'a document' }),
    })
    const result = await acceptFileReload(PROJECT_PATH, io)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') expect(result.stage).toBe('migrate')
    expect(useDocumentStore.getState().document.meta.name).toBe('In-Memory')
  })

  it('degrades to a structured error when the preload bridge is absent', async () => {
    const result = await acceptFileReload(PROJECT_PATH)
    expect(result).toEqual({
      kind: 'error',
      stage: 'ipc',
      message: 'file-reload IPC not wired',
    })
  })
})

describe('declineFileReload — Y-PER-05 keep in-memory state', () => {
  it('keeps the in-memory document and its history, and marks it dirty', () => {
    declineFileReload()

    expect(useDocumentStore.getState().document.meta.name).toBe('In-Memory')
    expect(useDocumentStore.getState().isDirty).toBe(true)
    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(useSessionStore.getState().selectedIds).toEqual(['stale-id'])
  })
})
