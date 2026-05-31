import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import { useHistoryStore } from '../../src/store/historyStore'
import {
  acceptCrashRecovery,
  checkForCrashRecovery,
  declineCrashRecovery,
  type RecoveryIO,
} from '../../src/store/crashRecovery'
import { useSessionStore } from '../../src/store/sessionStore'

interface IOStub {
  io: RecoveryIO
  probeCalls: string[]
  readCalls: string[]
  deleteCalls: string[]
}

interface IOConfig {
  probe?: { exists: boolean; isNewer: boolean } | (() => Promise<never>)
  read?: { success: boolean; json?: string; error?: string }
  delete?: { success: boolean; error?: string }
}

/**
 * Build a fresh IO stub. Each call category is captured so tests can
 * assert which side effects fired (especially the stale-sidecar cleanup).
 */
function stubIO(config: IOConfig): IOStub {
  const probeCalls: string[] = []
  const readCalls: string[] = []
  const deleteCalls: string[] = []

  const probe = config.probe ?? { exists: false, isNewer: false }
  const read = config.read ?? { success: false, error: 'no stub' }
  const del = config.delete ?? { success: true }

  return {
    probeCalls,
    readCalls,
    deleteCalls,
    io: {
      probeAutosave: vi.fn(async (path: string) => {
        probeCalls.push(path)
        if (typeof probe === 'function') {
          return probe()
        }
        return probe
      }),
      readAutosave: vi.fn(async (path: string) => {
        readCalls.push(path)
        return read
      }),
      deleteAutosave: vi.fn(async (path: string) => {
        deleteCalls.push(path)
        return del
      }),
    },
  }
}

const PROJECT_PATH = '/tmp/project.dtw'
const SIDECAR_PATH = '/tmp/project.dtw.autosave'

beforeEach(() => {
  useDocumentStore.setState({ document: createBlankDocument('Before'), isDirty: false })
  useHistoryStore.setState({ past: [], future: [] })
  useSessionStore.setState({ selectedIds: [], currentFilePath: null })
})

describe('checkForCrashRecovery', () => {
  it('returns "none" when no sidecar exists', async () => {
    const stub = stubIO({ probe: { exists: false, isNewer: false } })
    const result = await checkForCrashRecovery(PROJECT_PATH, stub.io)
    expect(result.kind).toBe('none')
    expect(stub.probeCalls).toEqual([PROJECT_PATH])
    expect(stub.readCalls).toEqual([])
    expect(stub.deleteCalls).toEqual([])
  })

  it('deletes a stale sidecar and returns "none"', async () => {
    const stub = stubIO({
      probe: { exists: true, isNewer: false },
      delete: { success: true },
    })
    const result = await checkForCrashRecovery(PROJECT_PATH, stub.io)
    expect(result.kind).toBe('none')
    expect(stub.deleteCalls).toEqual([SIDECAR_PATH])
    expect(stub.readCalls).toEqual([])
  })

  it('still returns "none" when stale-sidecar cleanup fails (best-effort)', async () => {
    const stub = stubIO({
      probe: { exists: true, isNewer: false },
      delete: { success: false, error: 'EBUSY' },
    })
    const result = await checkForCrashRecovery(PROJECT_PATH, stub.io)
    expect(result.kind).toBe('none')
    expect(stub.deleteCalls).toEqual([SIDECAR_PATH])
  })

  it('returns "available" with a parsed document when the sidecar is newer and valid', async () => {
    const recovered = createBlankDocument('Recovered')
    const stub = stubIO({
      probe: { exists: true, isNewer: true },
      read: { success: true, json: JSON.stringify(recovered) },
    })
    const result = await checkForCrashRecovery(PROJECT_PATH, stub.io)
    expect(result.kind).toBe('available')
    if (result.kind === 'available') {
      expect(result.sidecarPath).toBe(SIDECAR_PATH)
      expect(result.document).toEqual(recovered)
    }
    expect(stub.deleteCalls).toEqual([])
  })

  it('returns error stage "probe" when the probe throws', async () => {
    const stub = stubIO({
      probe: async () => {
        throw new Error('disk offline')
      },
    })
    const result = await checkForCrashRecovery(PROJECT_PATH, stub.io)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.stage).toBe('probe')
      expect(result.message).toBe('disk offline')
      expect(result.sidecarPath).toBe(SIDECAR_PATH)
    }
  })

  it('returns error stage "read" when the sidecar read fails', async () => {
    const stub = stubIO({
      probe: { exists: true, isNewer: true },
      read: { success: false, error: 'EACCES' },
    })
    const result = await checkForCrashRecovery(PROJECT_PATH, stub.io)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.stage).toBe('read')
      expect(result.message).toBe('EACCES')
    }
  })

  it('returns error stage "parse" on malformed JSON', async () => {
    const stub = stubIO({
      probe: { exists: true, isNewer: true },
      read: { success: true, json: '{ "version": "0.2.0", ' },
    })
    const result = await checkForCrashRecovery(PROJECT_PATH, stub.io)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.stage).toBe('parse')
    }
  })

  it('returns error stage "migrate" when the payload fails schema validation', async () => {
    const stub = stubIO({
      probe: { exists: true, isNewer: true },
      read: { success: true, json: JSON.stringify({ version: '0.2.0', not: 'a document' }) },
    })
    const result = await checkForCrashRecovery(PROJECT_PATH, stub.io)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.stage).toBe('migrate')
    }
  })

  it('returns error stage "migrate" when the version has no migration path', async () => {
    const stub = stubIO({
      probe: { exists: true, isNewer: true },
      read: { success: true, json: JSON.stringify({ version: '9.9.9' }) },
    })
    const result = await checkForCrashRecovery(PROJECT_PATH, stub.io)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.stage).toBe('migrate')
      expect(result.message).toMatch(/migration/i)
    }
  })

  it('treats a missing version field as the current version (drops into schema parse)', async () => {
    // Valid current-schema doc serialized without its version field — the
    // probe should fall through to migrate's current-version schema parse
    // and reject for the missing required field.
    const stub = stubIO({
      probe: { exists: true, isNewer: true },
      read: { success: true, json: JSON.stringify({ noVersion: true }) },
    })
    const result = await checkForCrashRecovery(PROJECT_PATH, stub.io)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.stage).toBe('migrate')
    }
  })
})

describe('acceptCrashRecovery', () => {
  it('hydrates the document, marks dirty, clears history + selection, binds the file path', async () => {
    // Seed prior state we expect to be reset.
    useHistoryStore.setState({
      past: [{ patches: [], inversePatches: [], label: 'stale', timestamp: 0 }],
      future: [],
    })
    useSessionStore.setState({ selectedIds: ['ghost'], currentFilePath: null })

    const recovered = createBlankDocument('Recovered')
    acceptCrashRecovery(recovered, PROJECT_PATH)

    const docState = useDocumentStore.getState()
    expect(docState.document).toEqual(recovered)
    // The sidecar's content has not been written to the canonical .dtw yet
    // — dirty must be true so the topbar indicator nags the user to save.
    expect(docState.isDirty).toBe(true)

    expect(useHistoryStore.getState().past).toEqual([])
    expect(useSessionStore.getState().selectedIds).toEqual([])
    expect(useSessionStore.getState().currentFilePath).toBe(PROJECT_PATH)
  })
})

describe('declineCrashRecovery', () => {
  it('deletes the sidecar and returns "deleted" on success', async () => {
    const stub = stubIO({ delete: { success: true } })
    const result = await declineCrashRecovery(SIDECAR_PATH, stub.io)
    expect(result.kind).toBe('deleted')
    expect(stub.deleteCalls).toEqual([SIDECAR_PATH])
  })

  it('returns an error outcome when deletion fails', async () => {
    const stub = stubIO({ delete: { success: false, error: 'EPERM' } })
    const result = await declineCrashRecovery(SIDECAR_PATH, stub.io)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toBe('EPERM')
    }
  })

  it('returns a generic error message when the IO reports failure without a reason', async () => {
    const stub = stubIO({ delete: { success: false } })
    const result = await declineCrashRecovery(SIDECAR_PATH, stub.io)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toBe('Failed to delete autosave sidecar')
    }
  })
})
