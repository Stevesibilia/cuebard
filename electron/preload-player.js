const { contextBridge, ipcRenderer } = require('electron');

// Sandboxed preload (sandbox: true in windows.js): only the electron module
// is available here, no Node built-ins.
contextBridge.exposeInMainWorld('playerAPI', {
  onDisplayState: (callback) => ipcRenderer.on('display-state', (event, state) => callback(state)),
  signalReady: () => ipcRenderer.send('player-ready'),
  onToggleFullscreen: (callback) => ipcRenderer.on('toggle-fullscreen', () => callback()),
  requestToggleFullscreen: () => ipcRenderer.send('player-toggle-fullscreen')
});
