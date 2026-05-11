# Architecture

## Data Flow

```
Canvas Editor → Element Store → Inference Engine → Code Generator → SEO Injector → Export (ZIP)
```

1. User draws on the Konva canvas (renderer process)
2. Actions write to the Zustand store (`src/store/elementStore.ts`)
3. Canvas reads from the store — never owns state
4. Generator reads the element tree and emits HTML + CSS strings
5. SEO injector post-processes HTML with meta tags and ARIA
6. Export engine packages the result into a ZIP via `jszip`
7. IPC bridge saves the ZIP to disk via native dialog

## Process Boundaries

### Main Process (`src/main/`)
- Electron lifecycle, native file dialogs, `fs` writes
- IPC handlers only — no business logic

### Renderer Process (`src/renderer/`, `src/store/`, `src/engine/`, `src/generator/`, `src/seo/`, `src/export/`)
- All UI and business logic
- Communicates to main via `window.electronAPI` (preload bridge)

### Preload (`src/preload/`)
- Exposes a typed `window.electronAPI` via `contextBridge`
- No raw `ipcRenderer` access in renderer

## Module Ownership

| Module | Owner | Responsibility |
|--------|-------|----------------|
| `src/main/` | Ibrahim | Electron shell, IPC, native file ops |
| `src/renderer/` | Yousef | Canvas UI, toolbar, properties panel |
| `src/store/` | Yousef | Zustand element store, undo/redo |
| `src/engine/` | Luf8y | Spatial → semantic tag inference |
| `src/generator/` | Ibrahim | HTML/CSS emission from element tree |
| `src/seo/` | Ibrahim | SEO meta tags, ARIA, heading structure |
| `src/export/` | Ibrahim | ZIP bundling, export pipeline |

## Key Invariants

- Canvas never owns state; it only reads from the store
- Main process never contains business logic
- Generated HTML never contains JavaScript
- All layout uses CSS Grid/Flexbox — no `position: absolute`
- Generated HTML must pass axe-core with zero violations before export is allowed
