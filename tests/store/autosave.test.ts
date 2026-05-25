import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Document } from '../../src/document/types'
import {
  AUTOSAVE_DELAY_MS,
  autosavePathFor,
  createAutosaveController,
  type AutosaveIO,
  type AutosaveWriteResult,
} from '../../src/store/autosave'
import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import { useSessionStore } from '../../src/store/sessionStore'

/**
 * Build a writer stub. `result` controls what the silent-write IO returns;
 * `calls` records each `(path, json)` pair so tests can assert what was
 * written and how many times.
 */
function stubIO(result: AutosaveWriteResult = { success: true }): {
  io: AutosaveIO
  calls: Array<{ path: string; json: string }>
} {
  const calls: Array<{ path: string; json: string }> = []
  return {
    calls,
    io: {
      writeAutosave: vi.fn(async (path: string, json: string) => {
        calls.push({ path, json })
        return result
      }),
    },
  }
}

describe('autosavePathFor', () => {
  it('appends the .autosave suffix to the project path', () => {
    expect(autosavePathFor('/home/yousef/site.dtw')).toBe('/home/yousef/site.dtw.autosave')
  })
})

describe('createAutosaveController — debounced scheduling', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const dirtyDoc = createBlankDocument('Autosave test')

  it('writes once, after the debounce window, when dirty and a path is set', async () => {
    const { io, calls } = stubIO()
    const controller = createAutosaveController({
      io,
      getDocument: () => dirtyDoc,
      getIsDirty: () => true,
      getProjectPath: () => '/tmp/site.dtw',
    })

    controller.schedule()
    expect(calls).toHaveLength(0) // nothing yet — still inside the window

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.path).toBe('/tmp/site.dtw.autosave')
    expect(JSON.parse(calls[0]!.json)).toEqual(dirtyDoc)
  })

  it('coalesces a burst of edits into a single write (≤ 5 s of work at risk)', async () => {
    const { io, calls } = stubIO()
    const controller = createAutosaveController({
      io,
      getDocument: () => dirtyDoc,
      getIsDirty: () => true,
      getProjectPath: () => '/tmp/site.dtw',
    })

    // Five edits, each 1 s apart — all inside one rolling 5 s window.
    for (let i = 0; i < 5; i++) {
      controller.schedule()
      await vi.advanceTimersByTimeAsync(1000)
    }
    expect(calls).toHaveLength(0) // window keeps resetting

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(calls).toHaveLength(1) // collapsed into a single write
  })

  it('cancel() prevents a pending scheduled write from firing', async () => {
    const { io, calls } = stubIO()
    const controller = createAutosaveController({
      io,
      getDocument: () => dirtyDoc,
      getIsDirty: () => true,
      getProjectPath: () => '/tmp/site.dtw',
    })

    controller.schedule()
    controller.cancel()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(calls).toHaveLength(0)
  })
})

describe('createAutosaveController — guards', () => {
  const doc = createBlankDocument('Guards')

  it('skips with reason "clean" when the document is not dirty', async () => {
    const { io, calls } = stubIO()
    const controller = createAutosaveController({
      io,
      getDocument: () => doc,
      getIsDirty: () => false,
      getProjectPath: () => '/tmp/site.dtw',
    })
    const outcome = await controller.flush()
    expect(outcome).toEqual({ status: 'skipped', reason: 'clean' })
    expect(calls).toHaveLength(0)
  })

  it('skips with reason "no-path" for a never-saved project', async () => {
    const { io, calls } = stubIO()
    const controller = createAutosaveController({
      io,
      getDocument: () => doc,
      getIsDirty: () => true,
      getProjectPath: () => null,
    })
    const outcome = await controller.flush()
    expect(outcome).toEqual({ status: 'skipped', reason: 'no-path' })
    expect(calls).toHaveLength(0)
  })
})

describe('createAutosaveController — flush', () => {
  const doc = createBlankDocument('Flush')

  it('writes immediately, bypassing the debounce, and reports the path', async () => {
    const { io, calls } = stubIO()
    const controller = createAutosaveController({
      io,
      getDocument: () => doc,
      getIsDirty: () => true,
      getProjectPath: () => '/tmp/flush.dtw',
    })
    const outcome = await controller.flush()
    expect(outcome).toEqual({ status: 'written', path: '/tmp/flush.dtw.autosave' })
    expect(calls).toHaveLength(1)
  })

  it('surfaces a "failed" outcome when the IO reports an error', async () => {
    const { io } = stubIO({ success: false, error: 'Disk full' })
    const controller = createAutosaveController({
      io,
      getDocument: () => doc,
      getIsDirty: () => true,
      getProjectPath: () => '/tmp/flush.dtw',
    })
    const outcome = await controller.flush()
    expect(outcome).toEqual({ status: 'failed', error: 'Disk full' })
  })
})

describe('createAutosaveController — live store defaults', () => {
  beforeEach(() => {
    useDocumentStore.setState({ document: createBlankDocument('Live'), isDirty: true })
    useSessionStore.setState({ currentFilePath: '/tmp/live.dtw' })
  })

  it('reads document, dirty flag, and path from the stores when seams are omitted', async () => {
    const { io, calls } = stubIO()
    const controller = createAutosaveController({ io })
    const outcome = await controller.flush()
    expect(outcome.status).toBe('written')
    expect(calls[0]!.path).toBe('/tmp/live.dtw.autosave')
    const liveDoc = useDocumentStore.getState().document
    expect(JSON.parse(calls[0]!.json) as Document).toEqual(liveDoc)
  })

  it('skips when the live document is clean', async () => {
    useDocumentStore.getState().markClean()
    const { io, calls } = stubIO()
    const controller = createAutosaveController({ io })
    const outcome = await controller.flush()
    expect(outcome).toEqual({ status: 'skipped', reason: 'clean' })
    expect(calls).toHaveLength(0)
  })
})

describe('default IO — graceful degradation before the IPC lands', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns a structured "not wired" failure when electronAPI.writeAutosave is absent', async () => {
    vi.stubGlobal('window', { electronAPI: {} })
    const controller = createAutosaveController({
      getDocument: () => createBlankDocument('NoIPC'),
      getIsDirty: () => true,
      getProjectPath: () => '/tmp/no-ipc.dtw',
    })
    const outcome = await controller.flush()
    expect(outcome).toEqual({ status: 'failed', error: 'autosave IPC not wired' })
  })
})
