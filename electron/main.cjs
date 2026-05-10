
const { app, BrowserWindow, ipcMain, desktopCapturer, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const projectRoot = path.join(__dirname, '..');
const generatedDir = path.join(projectRoot, 'generated');
fs.mkdirSync(generatedDir, { recursive: true });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#020706',
    title: 'Krishna Jarvis Desktop Pro',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadURL('http://localhost:5173');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('jarvis:desktop-info', async () => ({
  platform: process.platform,
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  desktop: true
}));

ipcMain.handle('jarvis:capture-screen', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 1600, height: 1000 }
  });
  if (!sources.length) throw new Error('No screen/window source found.');
  const screenSource = sources.find(s => s.name.toLowerCase().includes('screen')) || sources[0];
  const dataUrl = screenSource.thumbnail.toDataURL();
  const file = path.join(generatedDir, `desktop-screen-${Date.now()}.png`);
  fs.writeFileSync(file, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  return { imageDataUrl: dataUrl, file };
});

ipcMain.handle('jarvis:open-folder', async () => {
  await shell.openPath(projectRoot);
  return { ok: true, path: projectRoot };
});

ipcMain.handle('jarvis:choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled) return { canceled: true };
  return { path: result.filePaths[0] };
});
