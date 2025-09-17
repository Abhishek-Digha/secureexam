 
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  enableSecureMode: () => ipcRenderer.invoke('enable-secure-mode'),
  disableSecureMode: () => ipcRenderer.invoke('disable-secure-mode'),
  quitApp: () => ipcRenderer.invoke('quit-app')
});