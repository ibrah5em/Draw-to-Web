/**
 * Global application settings (Task 4).
 *
 * Editor-wide preferences that persist across projects and launches — distinct
 * from per-document settings (`document.settings`, surfaced in the Document
 * Settings dialog). Persisted to `localStorage` under {@link STORAGE_KEY},
 * matching the app's existing renderer-persistence pattern (see the
 * `dtw.layout.*` panel layouts in `App.tsx`); no second mechanism is
 * introduced.
 *
 * The setters here are **persist-only**: they write the saved value and update
 * this store, but never call the live stores. Live application is explicit —
 * {@link applyAppSettings} pushes saved values into the session / view-prefs
 * stores on launch, and {@link subscribeAppSettings} mirrors later live changes
 * back into this store so a theme toggled from the topbar still persists. This
 * one-way persist path keeps the two directions loop-free.
 */

import { create } from 'zustand'

import type { ThemeMode } from '@store/sessionStore'

import type { ExportOptionValues } from '../dialogs/ExportOptions'

/** The persisted default export options (everything but the per-export filename). */
export type ExportDefaults = Omit<ExportOptionValues, 'projectName'>

/** The persisted global settings payload. */
export interface AppSettings {
  /** Default canvas preview theme, applied on launch. */
  readonly theme: ThemeMode
  /** Default hover-preview render mode, applied on launch. */
  readonly hoverPreview: boolean
  /** Seed values for the Export Options dialog. */
  readonly exportDefaults: ExportDefaults
}

/** localStorage key for the persisted settings blob. */
export const STORAGE_KEY = 'dtw.settings'

/** Factory defaults. Theme defaults to dark per product preference. */
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  hoverPreview: false,
  exportDefaults: {
    minify: true,
    inlineJS: false,
    selfHostFonts: false,
    includeSourceComments: false,
    theme: 'auto',
  },
}

/** Narrow an unknown value to a valid {@link ExportDefaults['theme']}. */
function isExportTheme(value: unknown): value is ExportDefaults['theme'] {
  return value === 'auto' || value === 'light' || value === 'dark'
}

/** Read persisted settings, falling back field-by-field to the defaults. */
function loadSettings(): AppSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (raw === null) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings> & {
      exportDefaults?: Partial<ExportDefaults>
    }
    const ed: Partial<ExportDefaults> = parsed.exportDefaults ?? {}
    return {
      theme:
        parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : DEFAULT_SETTINGS.theme,
      hoverPreview:
        typeof parsed.hoverPreview === 'boolean'
          ? parsed.hoverPreview
          : DEFAULT_SETTINGS.hoverPreview,
      exportDefaults: {
        minify: typeof ed.minify === 'boolean' ? ed.minify : DEFAULT_SETTINGS.exportDefaults.minify,
        inlineJS:
          typeof ed.inlineJS === 'boolean' ? ed.inlineJS : DEFAULT_SETTINGS.exportDefaults.inlineJS,
        selfHostFonts:
          typeof ed.selfHostFonts === 'boolean'
            ? ed.selfHostFonts
            : DEFAULT_SETTINGS.exportDefaults.selfHostFonts,
        includeSourceComments:
          typeof ed.includeSourceComments === 'boolean'
            ? ed.includeSourceComments
            : DEFAULT_SETTINGS.exportDefaults.includeSourceComments,
        theme: isExportTheme(ed.theme) ? ed.theme : DEFAULT_SETTINGS.exportDefaults.theme,
      },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** Persist the data fields (ignores the action methods on the store). */
function persist(settings: AppSettings): void {
  try {
    const payload: AppSettings = {
      theme: settings.theme,
      hoverPreview: settings.hoverPreview,
      exportDefaults: settings.exportDefaults,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Storage unavailable (private mode / quota) — non-fatal.
  }
}

interface AppSettingsActions {
  /** Persist the default theme (does not touch the live session store). */
  setTheme: (theme: ThemeMode) => void
  /** Persist the default hover-preview mode (does not touch the live store). */
  setHoverPreview: (on: boolean) => void
  /** Persist a single export-default field. */
  setExportDefault: <K extends keyof ExportDefaults>(key: K, value: ExportDefaults[K]) => void
}

export type AppSettingsStore = AppSettings & AppSettingsActions

/** Global app-settings store, hydrated from localStorage on first import. */
export const useAppSettings = create<AppSettingsStore>()((set, get) => ({
  ...loadSettings(),
  setTheme: (theme) => {
    set({ theme })
    persist(get())
  },
  setHoverPreview: (on) => {
    set({ hoverPreview: on })
    persist(get())
  },
  setExportDefault: (key, value) => {
    set((s) => ({ exportDefaults: { ...s.exportDefaults, [key]: value } }))
    persist(get())
  },
}))
