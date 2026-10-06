const { contextBridge, ipcRenderer } = require('electron');

// Try to import webUtils, but it may not be available in all Electron versions
let webUtils;
try {
  webUtils = require('electron').webUtils;
} catch (e) {
  console.warn('webUtils not available:', e);
}

// Subscribe to a main-process event. Returns a function that removes exactly
// this subscription; it is built here, in the preload world, so it removes
// the very function that was added (a callback handed back across the
// context bridge would not be the same object).
const subscribe = (channel, callback) => {
  ipcRenderer.on(channel, callback);
  return () => ipcRenderer.removeListener(channel, callback);
};

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),
  selectProjectFile: () => ipcRenderer.invoke('select-project-file'),
  selectAudioFiles: () => ipcRenderer.invoke('select-audio-files'),
  selectVisualMediaFiles: () => ipcRenderer.invoke('select-visual-media-files'),

  // File operations
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  copyFile: (source, destination, options) => ipcRenderer.invoke('copy-file', source, destination, options),
  ensureDirectory: (dirPath) => ipcRenderer.invoke('ensure-directory', dirPath),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  
  // Get file path from dropped file
  getFilePath: (file) => {
    try {
      if (webUtils && webUtils.getPathForFile) {
        return webUtils.getPathForFile(file);
      }
      // Fallback: try to get path from file object directly (may not work in all cases)
      return file.path || null;
    } catch (error) {
      console.error('Error getting file path:', error);
      return null;
    }
  },

  // Project management
  setCurrentProject: (projectPath) => ipcRenderer.invoke('set-current-project', projectPath),
  exportProject: (projectFolderPath, projectName) => ipcRenderer.invoke('export-project', projectFolderPath, projectName),
  importProject: () => ipcRenderer.invoke('import-project'),
  importLpaFile: (lpaPath) => ipcRenderer.invoke('import-lpa-file', lpaPath),
  onExportProgress: (callback) => subscribe('export-progress', callback),
  onImportProgress: (callback) => subscribe('import-progress', callback),

  // Waveform generation
  generateWaveform: (audioPath, outputPath) => ipcRenderer.invoke('generate-waveform', audioPath, outputPath),

  // FFmpeg check

  // YouTube features
  searchYouTube: (query) => ipcRenderer.invoke('search-youtube', query),
  downloadYouTubeAudio: (videoId, title, projectFolderPath, progressCallback) => {
    // Set up progress listener
    const progressListener = (event, progress) => {
      if (progress.videoId === videoId && progressCallback) {
        progressCallback(progress);
      }
    };
    ipcRenderer.on('youtube-download-progress', progressListener);
    
    // Start download and clean up listener when done
    return ipcRenderer.invoke('download-youtube-audio', videoId, title, projectFolderPath)
      .finally(() => {
        ipcRenderer.removeListener('youtube-download-progress', progressListener);
      });
  },

  // Menu events
  onMenuNewProject: (callback) => subscribe('menu-new-project', callback),
  onMenuOpenProject: (callback) => subscribe('menu-open-project', callback),
  onMenuSaveProject: (callback) => subscribe('menu-save-project', callback),
  onMenuExportProject: (callback) => subscribe('menu-export-project', callback),
  onMenuImportProject: (callback) => subscribe('menu-import-project', callback),
  onMenuCloseProject: (callback) => subscribe('menu-close-project', callback),
  onMenuOpenProjectFolder: (callback) => subscribe('menu-open-project-folder', callback),
  onMenuSetTheme: (callback) => subscribe('menu-set-theme', callback),
  onMenuChangeAccentColor: (callback) => subscribe('menu-change-accent-color', callback),
  onMenuChangeLanguage: (callback) => subscribe('menu-change-language', callback),
  onMenuShowAbout: (callback) => subscribe('menu-show-about', callback),
  onMenuToggleMinimalMode: (callback) => subscribe('menu-toggle-minimal-mode', callback),
  onMenuToggleVisualDisplay: (callback) => subscribe('menu-toggle-visual-display', callback),
  setVisualDisplayEnabled: (enabled) => ipcRenderer.invoke('set-visual-display-enabled', enabled),
  setCurrentTheme: (themeId) => ipcRenderer.invoke('set-current-theme', themeId),

  // Minimal mode
  enterMinimalMode: () => ipcRenderer.invoke('enter-minimal-mode'),
  exitMinimalMode: () => ipcRenderer.invoke('exit-minimal-mode'),

  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Update menu language
  updateMenuLanguage: (locale) => ipcRenderer.invoke('update-menu-language', locale),
  
  // Get system locale
  getSystemLocale: () => ipcRenderer.invoke('get-system-locale'),
  
  // Get available locales and locale data
  getAvailableLocales: () => ipcRenderer.invoke('get-available-locales'),
  getLocaleData: (localeCode) => ipcRenderer.invoke('get-locale-data', localeCode),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateAvailable: (callback) => subscribe('update-available', callback),
  onUpdateDownloadProgress: (callback) => subscribe('update-download-progress', callback),
  onUpdateDownloaded: (callback) => subscribe('update-downloaded', callback),
  onUpdateError: (callback) => subscribe('update-error', callback),
  onManualUpdateAvailable: (callback) => subscribe('manual-update-available', callback),

  // API triggers
  onTriggerItem: (callback) => subscribe('trigger-item', callback),
  onStopItem: (callback) => subscribe('stop-item', callback),
  
  // File association - opening project files
  onOpenProjectFile: (callback) => subscribe('open-project-file', callback),
  onOpenLpaFile: (callback) => subscribe('open-lpa-file', callback),

  // Close handshake - main holds the window close until the renderer has
  // flushed its pending save and called notifyFlushed()
  onBeforeClose: (callback) => subscribe('app-before-close', callback),
  notifyFlushed: () => ipcRenderer.send('renderer-flushed'),
  
  // State viewer - send state updates to main process
  updateAppState: (state) => ipcRenderer.send('update-app-state', state),
  
  // Check if dev mode is enabled
  isDevMode: () => ipcRenderer.invoke('is-dev-mode'),

  // MIDI config
  readMidiConfig: () => ipcRenderer.invoke('read-midi-config'),
  writeMidiConfig: (config) => ipcRenderer.invoke('write-midi-config', config),

  // Clipboard
  writeClipboardText: (text) => ipcRenderer.invoke('write-clipboard-text', text),

  // Visual media
  importVisualMedia: (projectFolderPath, sourceFilePath, uuid) => ipcRenderer.invoke('import-visual-media', projectFolderPath, sourceFilePath, uuid),
  readVisualMedia: (projectFolderPath, mediaPath) => ipcRenderer.invoke('read-visual-media', projectFolderPath, mediaPath),
  deleteVisualMedia: (projectFolderPath, mediaPath) => ipcRenderer.invoke('delete-visual-media', projectFolderPath, mediaPath),

  // Player window
  pushToPlayer: (displayState) => ipcRenderer.invoke('push-to-player', displayState),
  onPlayerWindowStatusChanged: (callback) => subscribe('player-window-status-changed', (event, isOpen) => callback(isOpen)),

  // Remote viewer (LAN browser)
  setRemoteViewerEnabled: (enabled) => ipcRenderer.invoke('set-remote-viewer-enabled', enabled),
  getRemoteViewerStatus: () => ipcRenderer.invoke('get-remote-viewer-status'),
  // Remote Control API from the network (off = loopback only)
  setApiNetworkEnabled: (enabled) => ipcRenderer.invoke('set-api-network-enabled', enabled),
  getApiNetworkEnabled: () => ipcRenderer.invoke('get-api-network-enabled'),
  // Local viewer (second-monitor player window) toggle
  setLocalViewerEnabled: (enabled) => ipcRenderer.invoke('set-local-viewer-enabled', enabled)
});
