import { app, BrowserWindow, shell, Menu, session } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'

const isDev = !app.isPackaged

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
    `img-src 'self' data: blob:`,
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
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'Draw to Web',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  configureMenu(win)

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
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
