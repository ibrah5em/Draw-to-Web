/**
 * Bridges the persisted {@link useAppSettings} store to the live editor stores
 * (Task 4). Kept out of `appSettings.ts` so that module stays persist-only and
 * free of live-store coupling.
 *
 * On mount, {@link applyAppSettings} pushes the saved theme + hover-preview
 * defaults into the session / view-prefs stores. {@link subscribeAppSettings}
 * then mirrors later live changes (topbar theme toggle, View menu, hover
 * button) back into the persisted store so they survive a relaunch. The
 * persisted setters never call the live stores, so the round-trip cannot loop.
 */

import { useEffect } from 'react'

import { useSessionStore } from '@store/sessionStore'

import { useAppSettings } from './appSettings'
import { useViewPrefs } from './viewPrefs'

/** Apply the persisted defaults to the live editor stores. */
export function applyAppSettings(): void {
  const settings = useAppSettings.getState()
  useSessionStore.getState().setTheme(settings.theme)
  useViewPrefs.getState().setHoverPreview(settings.hoverPreview)
}

/** Mirror live theme / hover-preview changes back into the persisted store. */
export function subscribeAppSettings(): () => void {
  const unsubTheme = useSessionStore.subscribe((state, prev) => {
    if (state.theme !== prev.theme) useAppSettings.getState().setTheme(state.theme)
  })
  const unsubHover = useViewPrefs.subscribe((state, prev) => {
    if (state.hoverPreview !== prev.hoverPreview) {
      useAppSettings.getState().setHoverPreview(state.hoverPreview)
    }
  })
  return () => {
    unsubTheme()
    unsubHover()
  }
}

/** Mount-once hook: apply persisted settings, then keep them in sync. */
export function useAppSettingsSync(): void {
  useEffect(() => {
    applyAppSettings()
    return subscribeAppSettings()
  }, [])
}
