import { app, BrowserWindow, shell, Menu } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'

const isDev = !app.isPackaged

function buildMenu(win: BrowserWindow): void {
  const viewSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Toggle Grid',
      accelerator: 'CmdOrCtrl+G',
      click: () => win.webContents.send('menu:action', 'toggle-grid'),
    },
  ]

  if (isDev) {
    viewSubmenu.push(
      { type: 'separator' },
      {
        label: 'Toggle Developer Tools',
        accelerator: 'F12',
        click: () => win.webContents.toggleDevTools(),
      }
    )
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Export…',
          accelerator: 'CmdOrCtrl+E',
          click: () => win.webContents.send('menu:action', 'export'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => win.webContents.send('menu:action', 'undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => win.webContents.send('menu:action', 'redo'),
        },
      ],
    },
    { label: 'View', submenu: viewSubmenu },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
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

  buildMenu(win)

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
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
