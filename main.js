const { app, BrowserWindow } = require('electron/main')

function createWindow () {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      webSecurity: false,
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webviewTag: true,
    }
  })

  window.loadFile('index.html')
  window.webContents.setDevToolsWebContents(new BrowserWindow().webContents);
  window.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})