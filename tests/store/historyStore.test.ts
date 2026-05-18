import { applyPatches, produceWithPatches } from 'immer'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  COALESCE_WINDOW_MS,
  HISTORY_CAP,
  useHistoryStore,
  type HistoryEntry,
} from '../../src/store/historyStore'

interface Doc {
  count: number
  items: string[]
}

const freshDoc = (): Doc => ({ count: 0, items: [] })

/**
 * Build a history entry from a mutator run against `doc`. Returns the
 * post-mutation document plus the entry — mimics what Y-STR-03's dispatch
 * will do once it lands.
 */
const recordable = (
  doc: Doc,
  label: string,
  mutate: (draft: Doc) => void
): { next: Doc; entry: HistoryEntry } => {
  const [next, patches, inversePatches] = produceWithPatches(doc, mutate)
  return {
    next,
    entry: { patches, inversePatches, label, timestamp: Date.now() },
  }
}

const reset = () => {
  useHistoryStore.setState({ past: [], future: [] })
}

describe('historyStore', () => {
  beforeEach(reset)

  it('starts empty with no undo/redo available', () => {
    const s = useHistoryStore.getState()
    expect(s.past).toEqual([])
    expect(s.future).toEqual([])
    expect(s.canUndo()).toBe(false)
    expect(s.canRedo()).toBe(false)
    expect(s.undo()).toBeNull()
    expect(s.redo()).toBeNull()
  })

  it('record pushes onto past and exposes canUndo', () => {
    const { entry } = recordable(freshDoc(), 'inc', (d) => {
      d.count++
    })
    useHistoryStore.getState().record(entry)
    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(useHistoryStore.getState().canUndo()).toBe(true)
    expect(useHistoryStore.getState().canRedo()).toBe(false)
  })

  it('undo round-trip — inversePatches reverse the mutation', () => {
    const original = freshDoc()
    const { next, entry } = recordable(original, 'inc', (d) => {
      d.count = 5
    })
    useHistoryStore.getState().record(entry)
    const undone = useHistoryStore.getState().undo()
    expect(undone).toBe(entry)
    const restored = applyPatches(next, [...undone!.inversePatches])
    expect(restored).toEqual(original)
    expect(useHistoryStore.getState().past).toEqual([])
    expect(useHistoryStore.getState().future).toEqual([entry])
  })

  it('redo round-trip — patches re-apply the mutation', () => {
    const original = freshDoc()
    const { next, entry } = recordable(original, 'push', (d) => {
      d.items.push('a')
    })
    useHistoryStore.getState().record(entry)
    useHistoryStore.getState().undo()
    const undoneDoc = applyPatches(next, [...entry.inversePatches])
    const redone = useHistoryStore.getState().redo()
    expect(redone).toBe(entry)
    const reapplied = applyPatches(undoneDoc, [...redone!.patches])
    expect(reapplied).toEqual(next)
    expect(useHistoryStore.getState().past).toEqual([entry])
    expect(useHistoryStore.getState().future).toEqual([])
  })

  it('record after undo clears the future stack (branch)', () => {
    const { entry: a } = recordable(freshDoc(), 'a', (d) => {
      d.count++
    })
    const { entry: b } = recordable(freshDoc(), 'b', (d) => {
      d.count += 2
    })
    const { entry: c } = recordable(freshDoc(), 'c', (d) => {
      d.count += 3
    })
    const { record, undo } = useHistoryStore.getState()
    record(a)
    record(b)
    undo() // b → future
    expect(useHistoryStore.getState().future).toEqual([b])
    record(c)
    expect(useHistoryStore.getState().future).toEqual([])
    expect(useHistoryStore.getState().past).toEqual([a, c])
  })

  it('undo / redo are no-ops when their stack is empty', () => {
    const { record } = useHistoryStore.getState()
    expect(useHistoryStore.getState().redo()).toBeNull()
    const { entry } = recordable(freshDoc(), 'x', (d) => {
      d.count++
    })
    record(entry)
    useHistoryStore.getState().undo()
    useHistoryStore.getState().undo() // second undo: nothing to do
    expect(useHistoryStore.getState().past).toEqual([])
    expect(useHistoryStore.getState().future).toEqual([entry])
  })

  it('clear empties both stacks', () => {
    const { record, clear } = useHistoryStore.getState()
    const { entry } = recordable(freshDoc(), 'x', (d) => {
      d.count++
    })
    record(entry)
    useHistoryStore.getState().undo()
    expect(useHistoryStore.getState().future).toHaveLength(1)
    clear()
    expect(useHistoryStore.getState().past).toEqual([])
    expect(useHistoryStore.getState().future).toEqual([])
  })

  describe('cap of 200', () => {
    it('keeps the 200 most recent entries; recording the 201st evicts the oldest', () => {
      const { record } = useHistoryStore.getState()
      for (let i = 0; i < HISTORY_CAP; i++) {
        const { entry } = recordable(freshDoc(), `op-${i}`, (d) => {
          d.count = i
        })
        record(entry)
      }
      expect(useHistoryStore.getState().past).toHaveLength(HISTORY_CAP)
      expect(useHistoryStore.getState().past[0].label).toBe('op-0')

      const { entry: overflow } = recordable(freshDoc(), 'op-200', (d) => {
        d.count = 200
      })
      record(overflow)

      const past = useHistoryStore.getState().past
      expect(past).toHaveLength(HISTORY_CAP)
      expect(past[0].label).toBe('op-1') // op-0 evicted
      expect(past[past.length - 1].label).toBe('op-200')
    })
  })

  it('a complex undo/redo sequence preserves document state at each step', () => {
    // Simulates the dispatcher driving the history: record forward,
    // undo (apply inverses), redo (apply patches), and confirm every
    // intermediate document state is reachable.
    const states: Doc[] = [freshDoc()]
    const entries: HistoryEntry[] = []
    // Distinct labels so Y-HST-02 coalescing does not merge these into one entry.
    const steps: Array<{ label: string; mutate: (d: Doc) => void }> = [
      { label: 'set-count', mutate: (d) => void (d.count = 1) },
      { label: 'push-alpha', mutate: (d) => void d.items.push('alpha') },
      {
        label: 'set-both',
        mutate: (d) => {
          d.count = 7
          d.items.push('beta')
        },
      },
    ]
    for (const { label, mutate } of steps) {
      const { next, entry } = recordable(states[states.length - 1], label, mutate)
      states.push(next)
      entries.push(entry)
      useHistoryStore.getState().record(entry)
    }

    // Undo all three, applying inverses against the live doc.
    let live = states[states.length - 1]
    for (let i = entries.length - 1; i >= 0; i--) {
      const undone = useHistoryStore.getState().undo()
      expect(undone).toBe(entries[i])
      live = applyPatches(live, [...undone!.inversePatches])
      expect(live).toEqual(states[i])
    }
    expect(useHistoryStore.getState().canUndo()).toBe(false)
    expect(useHistoryStore.getState().canRedo()).toBe(true)

    // Redo all three.
    for (let i = 0; i < entries.length; i++) {
      const redone = useHistoryStore.getState().redo()
      expect(redone).toBe(entries[i])
      live = applyPatches(live, [...redone!.patches])
      expect(live).toEqual(states[i + 1])
    }
    expect(useHistoryStore.getState().canRedo()).toBe(false)
  })

  describe('coalescing (Y-HST-02)', () => {
    /** Build an entry whose timestamp is `t` and whose mutator runs against `doc`. */
    const at = (
      doc: Doc,
      label: string,
      t: number,
      mutate: (d: Doc) => void
    ): { next: Doc; entry: HistoryEntry } => {
      const [next, patches, inversePatches] = produceWithPatches(doc, mutate)
      return { next, entry: { patches, inversePatches, label, timestamp: t } }
    }

    it('same-label entries within the window merge into one past entry', () => {
      const d0 = freshDoc()
      const r1 = at(d0, 'type', 100, (d) => {
        d.items.push('h')
      })
      const r2 = at(r1.next, 'type', 200, (d) => {
        d.items.push('i')
      })
      useHistoryStore.getState().record(r1.entry)
      useHistoryStore.getState().record(r2.entry)
      expect(useHistoryStore.getState().past).toHaveLength(1)
    })

    it('merged entry undoes both edits in one step, restoring the pre-first state', () => {
      const d0 = freshDoc()
      const r1 = at(d0, 'type', 100, (d) => {
        d.items.push('h')
      })
      const r2 = at(r1.next, 'type', 200, (d) => {
        d.items.push('i')
      })
      useHistoryStore.getState().record(r1.entry)
      useHistoryStore.getState().record(r2.entry)

      const undone = useHistoryStore.getState().undo()
      expect(undone).not.toBeNull()
      const restored = applyPatches(r2.next, [...undone!.inversePatches])
      expect(restored).toEqual(d0)
      expect(useHistoryStore.getState().past).toEqual([])
      expect(useHistoryStore.getState().future).toHaveLength(1)
    })

    it('redoing a merged entry re-applies both edits in one step', () => {
      const d0 = freshDoc()
      const r1 = at(d0, 'type', 100, (d) => {
        d.items.push('h')
      })
      const r2 = at(r1.next, 'type', 200, (d) => {
        d.items.push('i')
      })
      useHistoryStore.getState().record(r1.entry)
      useHistoryStore.getState().record(r2.entry)
      const undone = useHistoryStore.getState().undo()
      const undoneDoc = applyPatches(r2.next, [...undone!.inversePatches])

      const redone = useHistoryStore.getState().redo()
      expect(redone).not.toBeNull()
      const reapplied = applyPatches(undoneDoc, [...redone!.patches])
      expect(reapplied).toEqual(r2.next)
    })

    it('merged entry adopts the newer timestamp (rolling window)', () => {
      const d0 = freshDoc()
      const r1 = at(d0, 'type', 100, (d) => {
        d.items.push('h')
      })
      const r2 = at(r1.next, 'type', 100 + COALESCE_WINDOW_MS, (d) => {
        d.items.push('i')
      })
      useHistoryStore.getState().record(r1.entry)
      useHistoryStore.getState().record(r2.entry)
      const top = useHistoryStore.getState().past[0]
      expect(top.timestamp).toBe(100 + COALESCE_WINDOW_MS)
      expect(top.label).toBe('type')
    })

    it('three consecutive same-label edits within window collapse to one entry', () => {
      const d0 = freshDoc()
      const r1 = at(d0, 'type', 100, (d) => {
        d.items.push('a')
      })
      const r2 = at(r1.next, 'type', 200, (d) => {
        d.items.push('b')
      })
      const r3 = at(r2.next, 'type', 300, (d) => {
        d.items.push('c')
      })
      useHistoryStore.getState().record(r1.entry)
      useHistoryStore.getState().record(r2.entry)
      useHistoryStore.getState().record(r3.entry)
      expect(useHistoryStore.getState().past).toHaveLength(1)

      const undone = useHistoryStore.getState().undo()
      const restored = applyPatches(r3.next, [...undone!.inversePatches])
      expect(restored).toEqual(d0)
    })

    it('different labels do not merge — two past entries remain', () => {
      const d0 = freshDoc()
      const r1 = at(d0, 'type', 100, (d) => {
        d.items.push('a')
      })
      const r2 = at(r1.next, 'delete', 150, (d) => {
        d.items.pop()
      })
      useHistoryStore.getState().record(r1.entry)
      useHistoryStore.getState().record(r2.entry)
      expect(useHistoryStore.getState().past).toHaveLength(2)
    })

    it('same label outside the window does not merge', () => {
      const d0 = freshDoc()
      const r1 = at(d0, 'type', 100, (d) => {
        d.items.push('a')
      })
      const r2 = at(r1.next, 'type', 100 + COALESCE_WINDOW_MS + 1, (d) => {
        d.items.push('b')
      })
      useHistoryStore.getState().record(r1.entry)
      useHistoryStore.getState().record(r2.entry)
      expect(useHistoryStore.getState().past).toHaveLength(2)
    })

    it('rolling window: each edit within 500 ms of the previous extends the chain even if total duration exceeds 500 ms', () => {
      // Five edits, each 400 ms after the previous → total 1600 ms but each
      // step is inside the rolling window, so all five must merge.
      const d0 = freshDoc()
      let live = d0
      let t = 100
      for (const ch of ['a', 'b', 'c', 'd', 'e']) {
        const r = at(live, 'type', t, (d) => {
          d.items.push(ch)
        })
        useHistoryStore.getState().record(r.entry)
        live = r.next
        t += 400
      }
      expect(useHistoryStore.getState().past).toHaveLength(1)
      const undone = useHistoryStore.getState().undo()
      const restored = applyPatches(live, [...undone!.inversePatches])
      expect(restored).toEqual(d0)
    })

    it('intervening different-label edit breaks the chain', () => {
      const d0 = freshDoc()
      const r1 = at(d0, 'type', 100, (d) => {
        d.items.push('a')
      })
      const r2 = at(r1.next, 'select', 150, (d) => {
        d.count = 1
      })
      const r3 = at(r2.next, 'type', 200, (d) => {
        d.items.push('b')
      })
      const { record } = useHistoryStore.getState()
      record(r1.entry)
      record(r2.entry)
      record(r3.entry)
      expect(useHistoryStore.getState().past).toHaveLength(3)
    })

    it('coalescing does not happen across an undo (future is in between)', () => {
      const d0 = freshDoc()
      const r1 = at(d0, 'type', 100, (d) => {
        d.items.push('a')
      })
      const r2 = at(d0, 'type', 150, (d) => {
        d.items.push('b')
      })
      useHistoryStore.getState().record(r1.entry)
      useHistoryStore.getState().undo() // r1 → future
      useHistoryStore.getState().record(r2.entry) // clears future, lands fresh
      expect(useHistoryStore.getState().past).toEqual([r2.entry])
      expect(useHistoryStore.getState().future).toEqual([])
    })
  })
})
