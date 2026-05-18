# Roles & Ownership

Last updated: 2026-05-13

## Who owns what

| Module           | Owner   | Responsibility                                |
| ---------------- | ------- | --------------------------------------------- |
| `src/main/`      | Ibrahim | Electron shell, IPC handlers, native file ops |
| `src/preload/`   | Ibrahim | `contextBridge` typed `electronAPI` surface   |
| `src/generator/` | Ibrahim | HTML/CSS emission from the semantic tree      |
| `src/seo/`       | Ibrahim | Meta tags, ARIA, heading structure, axe gate  |
| `src/export/`    | Ibrahim | Export pipeline, ZIP bundling                 |
| `src/project/`   | Ibrahim | `.dtw` project save/load serialization        |
| `src/renderer/`  | Luf8y   | Canvas, toolbar, properties panel, dialogs    |
| `src/store/`     | Luf8y   | Zustand element store, undo/redo middleware   |
| `src/engine/`    | Yousef  | Spatial → semantic tag inference              |

Roles were swapped between Luf8y and Yousef on 2026-05-13. Anything that
still names the previous owner is stale — open a PR.

## Interface contracts (do not break these without coordinating)

These three types are the only coupling between owners. Treat them as a
public API: rename, narrowing, or restructuring requires a sync.

### `CanvasElement` — owned by Luf8y (`src/store/elementStore.ts`)

The data model the canvas writes and the engine reads. Shape is documented
in `docs/element-model.md`. Adding optional fields is safe; renaming or
removing fields is not.

### `SemanticElement` — owned by Yousef (`src/engine/index.ts`)

```ts
interface SemanticElement extends CanvasElement {
  semanticTag: SemanticTag
  children?: SemanticElement[]
}
```

What `inferSemantics(elements: CanvasElement[]): SemanticElement[]`
returns. The generator walks this tree depth-first and assumes
`semanticTag` is already resolved — it does not re-infer.

### `electronAPI` — owned by Ibrahim (`src/preload/index.ts`)

The only Node-side surface the renderer is allowed to call. Renderer code
must never reach for `ipcRenderer` directly.

## Stub fallback (no one is blocked on anyone)

`src/export/index.ts` calls `inferSemantics()` and falls back to
`src/engine/stubInfer.ts` if it throws "Not implemented". Effect:

- **Yousef** can ship `inferSemantics` incrementally. As soon as it stops
  throwing, the fallback dead-stops firing — no flag flip needed.
- **Luf8y** can build the canvas against the existing store API without
  waiting for the engine. The export pipeline will produce real output
  from any layout the canvas writes to the store.
- **Ibrahim** is done pending the real engine; the stub gets deleted when
  Yousef's implementation lands.

## Phase status (high level)

- **P1 Foundation** — Ibrahim's main/preload/IPC done. Luf8y picks up the
  canvas/toolbar/properties-panel stubs and undo/redo middleware.
- **P2 Generator** — Ibrahim's generator + live preview done. Yousef
  picks up `inferSemantics`.
- **P3 SEO/A11y** — done.
- **P4 Export** — done (running on the stub engine).
- **P5 Build/CI** — CI green, packaging config in place; clean-VM install
  test still pending.

See `docs/supervisor-report.md` for the deeper architecture write-up of
Ibrahim's modules.
