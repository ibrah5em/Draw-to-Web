/**
 * Live preview bridge (renderer side).
 *
 * The main process owns a separate BrowserWindow that renders the generator
 * output (`openPreviewWindow` IPC). This module runs the generator against
 * the current document, debounced, and ships HTML + CSS into that window
 * through the `updatePreview` IPC. Opening, closing, and the start / stop
 * of the push loop are all the renderer's responsibility.
 */

import { generate } from '@generator/index'
import { useDocumentStore } from '@store/documentStore'
import type { Document } from '@document/types'

const DEBOUNCE_MS = 300

let unsubscribeStore: (() => void) | null = null
let unsubscribeClose: (() => void) | null = null
let pendingTimer: ReturnType<typeof setTimeout> | null = null
let isOpen = false

function getApi(): Window['electronAPI'] | undefined {
  return (globalThis as { electronAPI?: Window['electronAPI'] }).electronAPI
}

async function pushOnce(doc: Document): Promise<void> {
  const api = getApi()
  if (!api?.updatePreview) return
  try {
    const out = await generate(doc)
    if (!isOpen) return
    await api.updatePreview(out.html, out.css)
  } catch {
    // Generator hiccup (e.g. missing token) — leave the previous frame on
    // screen, don't tear the window down.
  }
}

function schedulePush(doc: Document): void {
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    void pushOnce(doc)
  }, DEBOUNCE_MS)
}

function attachStoreListener(): void {
  if (unsubscribeStore) return
  unsubscribeStore = useDocumentStore.subscribe((state, prev) => {
    if (state.document === prev.document) return
    schedulePush(state.document)
  })
}

function detachStoreListener(): void {
  unsubscribeStore?.()
  unsubscribeStore = null
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = null
}

/** Tear the bridge down — wired both to user-initiated close and IPC close. */
function stopBridge(): void {
  isOpen = false
  detachStoreListener()
  unsubscribeClose?.()
  unsubscribeClose = null
}

/**
 * Open the live preview window and begin pushing generator output to it.
 * Subsequent calls while the window is already open are no-ops (the IPC
 * focuses the existing window). Returns `false` when the IPC isn't
 * available in this build so callers can show a friendly hint.
 */
export async function openLivePreview(): Promise<boolean> {
  const api = getApi()
  if (!api?.openPreviewWindow) return false
  await api.openPreviewWindow()
  if (isOpen) return true
  isOpen = true
  attachStoreListener()
  if (api.onPreviewClosed) {
    unsubscribeClose = api.onPreviewClosed(() => stopBridge())
  }
  void pushOnce(useDocumentStore.getState().document)
  return true
}

/** Whether the bridge currently thinks the preview window is open. */
export function isLivePreviewOpen(): boolean {
  return isOpen
}
