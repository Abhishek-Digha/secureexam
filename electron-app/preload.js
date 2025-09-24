 const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  enableSecureMode: () => ipcRenderer.invoke('enable-secure-mode'),
  disableSecureMode: () => ipcRenderer.invoke('disable-secure-mode'),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // Add these for sending messages and listening for replies
  send: (channel, data) => {
    const validChannels = ['set-session-id', 'terminate-session'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, callback) => {
    const validChannels = ['some-reply-channel'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  }
});
