---
paths:
  - 'src/ui/canvas/**'
  - 'src/ui/layers/**'
  - 'src/store/**'
---

# Canvas & Store Rules

Source of truth: `docs/0.2.0v/plan.md` Sections 10.9 (canvas), 10.10 (layers), 10.17–10.20 (store, history, persistence, perf). Contracts touched: `C5` (`useDocumentStore` / `useHistoryStore` / `useSessionStore`), `C10` (`inferSemantics`), `C3` (`applyOperation`).

- The Zustand document store is the single source of truth. **The canvas renders the tree; it never owns state.**
- All canvas interactions (insert, select, drag, resize, reorder) dispatch document operations to the store via `dispatch(op)` (Y-STR-03), which runs `produceWithPatches` and records `{ patches, inversePatches, label, timestamp }` to history.
- State mutations go through `immer` drafts inside operations in `src/document/operations.ts`. Never mutate the document directly in a component.
- Undo/Redo uses `immer` patches — every operation is one history entry. A single user action = a single history entry, even if it touches many elements (e.g. token rename rewrites every binding inside one draft).
- The canvas renderer is **recursive React** over `ElementNode[]` (`src/ui/canvas/CanvasNode.tsx`, L-CAN-02). No Konva, no canvas-element library, no `position: absolute`.
- Three stores, three responsibilities (Y-STR-01..02):
  - `documentStore` — the document + `isDirty` flag.
  - `historyStore` — past / future patch stacks, capped at 200 entries (Y-HST-01).
  - `sessionStore` — UI-only state (selection, `activeBreakpoint`, `activeState`, panel sizes). Selecting an element must **not** mark the document dirty.
- Drag & drop for the canvas uses `@dnd-kit/*` with a `DragOverlay` showing the preset preview (L-CAN-12). Drag & drop inside the layers tree uses `react-arborist`'s built-in DnD (L-LYR-02). The two contexts must remain isolated.
- Preset insertion (`Y-STR-04`) materializes the whole subtree inside one `produceWithPatches` call so undo removes the subtree in one step.
- Multi-element selection and group moves apply atomically — one operation, one history entry (Y-HST-03).
- Per-breakpoint and per-state edits are routed by `sessionStore`: when `activeBreakpoint !== 'base'`, writes go to `element.responsive[bp]` (Y-STR-07); when `activeState !== 'default'`, writes go to `element.states[state]` (Y-STR-06). The base values are never silently overwritten.
- Live token resolution: canvas styles call `resolveToken` (C9) so token edits reflect within <100 ms (L-CAN-03, performance budget Section 14).
- `inferSemantics` (C10, L-CAN-04) walks the tree post-mutation and attaches `semanticRole` hints; these survive copy/paste so the generator emits the right tag.
- Subscriber API (Y-STR-08): fine-grained selectors return stable references so editing a leaf does not re-render siblings. `React.memo` on leaf nodes is required to hit the 100-element 60 fps drag budget (Y-PRF-01, R03).
- Persistence: `.dtw` save/load goes through `electronAPI.saveProject` / `openProject` (C4) → Zod parse → migrate → hydrate. Autosave debounces 5 s after last edit and writes `<project>.dtw.autosave`.
