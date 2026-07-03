import { app, BrowserWindow, shell, Menu, session, protocol } from 'electron'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { IMAGE_ASSETS_DIRNAME } from './imagePipeline'
import { registerIpcHandlers } from './ipc'

const isDev = !app.isPackaged

/** Custom scheme that serves uploaded image variants to the editor renderer. */
const ASSET_SCHEME = 'dtw-asset'

// Privileged registration must run before `app.whenReady()` so the renderer
// can load `dtw-asset://` URLs inside <img> tags (treated as standard + secure).
protocol.registerSchemesAsPrivileged([
  { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

/**
 * Strict Content-Security-Policy for the main renderer window (I-ELE-08).
 *
 * Production locks the renderer to its own origin: no `unsafe-eval`, no
 * `unsafe-inline` on `script-src`, `object-src 'none'`, and `data:` only
 * for images (React inline `<style>` blocks need `'unsafe-inline'` on
 * `style-src`). Dev relaxes `script-src` (`unsafe-eval` + `unsafe-inline`)
 * and `connect-src` (`ws:` + the HMR origin) so Vite's HMR socket and
 * eval-based module shim can run. The policy is injected via
 * `webRequest.onHeadersReceived` rather than a `<meta>` tag so it
 * applies to every response, including IPC-driven `about:blank` writes.
 */
function attachCspHeaders(): void {
  const devOrigin = process.env['ELECTRON_RENDERER_URL'] ?? ''
  const scriptSrc = isDev ? `'self' 'unsafe-inline' 'unsafe-eval'` : `'self'`
  const connectSrc = isDev ? `'self' ws: ${devOrigin}`.trim() : `'self'`
  const policy = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${ASSET_SCHEME}:`,
    `font-src 'self'`,
    `connect-src ${connectSrc}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    })
  })
}

/** MIME type for a served asset filename. */
function assetMimeType(name: string): string {
  if (name.endsWith('.svg')) return 'image/svg+xml'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

/**
 * Serve processed image variants to the renderer over the {@link ASSET_SCHEME}
 * scheme so uploaded images preview on the canvas.
 *
 * Files live under `<userData>/<IMAGE_ASSETS_DIRNAME>/`; the editor requests
 * them as `dtw-asset://local/<filename>`. Only a bare filename inside that
 * folder is served — any path separators or `..` are rejected, so the scheme
 * cannot read arbitrary files on disk.
 */
function registerAssetProtocol(): void {
  const root = join(app.getPath('userData'), IMAGE_ASSETS_DIRNAME)
  protocol.handle(ASSET_SCHEME, async (request) => {
    let name: string
    try {
      name = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    if (name === '' || name.includes('/') || name.includes('\\') || name.includes('..')) {
      return new Response('Forbidden', { status: 403 })
    }
    try {
      const data = await readFile(join(root, name))
      return new Response(data, { headers: { 'Content-Type': assetMimeType(name) } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

/**
 * The application menu is rendered in-app (a custom dark File/Edit/View bar in
 * the renderer topbar), so the native OS menu is removed. In dev we keep an
 * F12 binding to toggle DevTools since there's no menu accelerator for it.
 */
function configureMenu(win: BrowserWindow): void {
  Menu.setApplicationMenu(null)
  if (isDev) {
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools()
    })
  }
}

function createWindow(): void {
  // Frameless: the OS title bar is replaced by a custom in-renderer bar (Task 3).
  // On macOS we keep the native traffic-light controls (titleBarStyle: 'hidden'
  // + trafficLightPosition) rather than a fully-frameless window, so users get
  // the platform-standard close/minimize/zoom buttons. Windows/Linux use
  // frame: false and render our own min/max/close controls.
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'Draw to Web',
    show: false,
    ...(isMac
      ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 12, y: 11 } }
      : { frame: false }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  configureMenu(win)

  // Forward maximize/restore transitions to the renderer so the custom title
  // bar's maximize button icon stays in sync — including OS-driven changes
  // (double-click title bar, drag-to-edge snap, keyboard shortcuts).
  const emitMaximizeState = (): void => {
    if (!win.isDestroyed()) win.webContents.send('window:maximized', win.isMaximized())
  }
  win.on('maximize', emitMaximizeState)
  win.on('unmaximize', emitMaximizeState)

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  attachCspHeaders()
  registerAssetProtocol()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
