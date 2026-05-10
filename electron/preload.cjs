
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jarvisDesktop', {
  info: () => ipcRenderer.invoke('jarvis:desktop-info'),
  captureScreen: () => ipcRenderer.invoke('jarvis:capture-screen'),
  openProjectFolder: () => ipcRenderer.invoke('jarvis:open-folder'),
  chooseFolder: () => ipcRenderer.invoke('jarvis:choose-folder')
});
