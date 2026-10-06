const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const state = require('../state');
const { enterMinimalMode, exitMinimalMode } = require('../windows');

const { sanitizeRecentProjects, addRecentProject, pruneMissingProjects } = require('../lib/recent-projects');

const midiConfigPath = path.join(app.getPath('userData'), 'midi-config.json');
const recentProjectsPath = path.join(app.getPath('userData'), 'recent-projects.json');

// Locale, update, dev-mode, minimal-mode, ffmpeg-status, MIDI-config and
// recent-projects IPC handlers.
// deps: { createMenu, rebuildMenu, checkForUpdates, getLocaleFiles } — provided by
// main.js.
function register(deps) {
  // Update menu language from renderer
  ipcMain.handle('update-menu-language', async (event, locale) => {
    deps.createMenu(locale, state.isDevMode);
    return { success: true };
  });

  // Auto-updater IPC handlers
  ipcMain.handle('check-for-updates', async () => {
    try {
      console.log('Manual update check requested');
      const { isManualUpdate, updateInfo } = await deps.checkForUpdates();
      return { success: true, isManualUpdate, updateInfo };
    } catch (error) {
      console.error('Check for updates error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('Download update error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-system-locale', () => {
    // Get the system locale from Electron
    const systemLocale = app.getLocale(); // Returns locale like 'en-US', 'es-ES', 'fr-FR', etc.
  
    // Extract just the language code (e.g., 'en' from 'en-US')
    const languageCode = systemLocale.split('-')[0].toLowerCase();
  
    return languageCode;
  });

  ipcMain.handle('get-available-locales', () => {
    // Return list of available locale codes and metadata
    return Object.keys(deps.getLocaleFiles()).map(code => ({
      code,
      name: deps.getLocaleFiles()[code]._metadata.nativeName,
      direction: deps.getLocaleFiles()[code]._metadata.direction
    }));
  });

  ipcMain.handle('get-locale-data', (event, localeCode) => {
    // Return the full locale data for a specific locale
    if (localeCode in deps.getLocaleFiles()) {
      return deps.getLocaleFiles()[localeCode];
    }
    // Fallback to English if locale not found
    return deps.getLocaleFiles().en;
  });

  // Check if dev mode is enabled
  ipcMain.handle('set-current-theme', async (event, themeId) => {
    state.setCurrentTheme(themeId);
    // Rebuild so the View > Theme radio reflects the renderer's state
    deps.rebuildMenu();
    return { success: true };
  });

  ipcMain.handle('is-dev-mode', () => {
    return state.isDevMode;
  });

  // Minimal mode — logic lives in windows.js
  ipcMain.handle('enter-minimal-mode', () => enterMinimalMode());

  ipcMain.handle('exit-minimal-mode', () => exitMinimalMode());

  // MIDI Config Handlers

  ipcMain.handle('read-midi-config', async () => {
    try {
      if (fs.existsSync(midiConfigPath)) {
        const data = fs.readFileSync(midiConfigPath, 'utf-8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error('Failed to read MIDI config:', error);
      return {};
    }
  });

  ipcMain.handle('write-midi-config', async (event, config) => {
    try {
      fs.writeFileSync(midiConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to write MIDI config:', error);
      throw new Error('Failed to save MIDI configuration');
    }
  });

  // Recent projects (welcome screen)

  ipcMain.handle('get-recent-projects', async () => {
    const stored = readRecentProjects();
    const { list, changed } = pruneMissingProjects(stored, (p) => fs.existsSync(p));
    if (changed) writeRecentProjects(list);
    return list;
  });

  ipcMain.handle('add-recent-project', async (event, filePath, name) => {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
      return { success: false };
    }
    const projectName = typeof name === 'string' ? name : path.basename(filePath, path.extname(filePath));
    const list = addRecentProject(readRecentProjects(), filePath, projectName, new Date().toISOString());
    writeRecentProjects(list);
    app.addRecentDocument(filePath);
    return { success: true };
  });
}

function readRecentProjects() {
  try {
    if (!fs.existsSync(recentProjectsPath)) return [];
    return sanitizeRecentProjects(JSON.parse(fs.readFileSync(recentProjectsPath, 'utf-8')));
  } catch (error) {
    console.error('Failed to read recent projects:', error);
    return [];
  }
}

function writeRecentProjects(list) {
  try {
    fs.writeFileSync(recentProjectsPath, JSON.stringify(list, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write recent projects:', error);
  }
}

module.exports = { register };
