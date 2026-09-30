const { ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathIsInProjectFolder } = require('../lib/path-guard');
const { isSafeExternalUrl } = require('../lib/http-guards');
const { copyFileNoOverwrite } = require('../lib/free-name');
const state = require('../state');

// Filesystem and dialog IPC handlers. Called once from main.js.
function register() {
  ipcMain.handle('select-project-folder', async () => {
    const result = await dialog.showOpenDialog(state.getMainWindow(), {
      properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('select-project-file', async () => {
    const result = await dialog.showOpenDialog(state.getMainWindow(), {
      properties: ['openFile'],
      filters: [{ name: 'E-LivePlay Project', extensions: ['liveplay'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('select-audio-files', async () => {
    const result = await dialog.showOpenDialog(state.getMainWindow(), {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths;
    }
    return null;
  });

  ipcMain.handle('select-visual-media-files', async () => {
    const result = await dialog.showOpenDialog(state.getMainWindow(), {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Visual Media', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'pdf'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths;
    }
    return null;
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const safe = pathIsInProjectFolder(filePath, state.getCurrentProject());
      if (!safe) return { success: false, error: 'Path outside project folder' };
      const data = await fs.promises.readFile(safe, 'utf8');
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('write-file', async (event, filePath, data) => {
    try {
      const safe = pathIsInProjectFolder(filePath, state.getCurrentProject());
      if (!safe) return { success: false, error: 'Path outside project folder' };
      await fs.promises.writeFile(safe, data, 'utf8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('copy-file', async (event, source, destination, options) => {
    try {
      // Source may be outside the project (user-selected via native dialog) — only guard destination
      const safeSrc = path.resolve(source);
      const safeDst = pathIsInProjectFolder(destination, state.getCurrentProject());
      if (!safeDst) return { success: false, error: 'Destination outside project folder' };
      // Ensure destination directory exists
      const destDir = path.dirname(safeDst);
      await fs.promises.mkdir(destDir, { recursive: true });
      if (options && options.noOverwrite) {
        // Never replace an existing file: a clash is stored as "name (2).ext"
        // in the same (already guarded) directory. Returns the path written.
        const destPath = await copyFileNoOverwrite(safeSrc, safeDst);
        return { success: true, destPath };
      }
      await fs.promises.copyFile(safeSrc, safeDst);
      return { success: true, destPath: safeDst };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ensure-directory', async (event, dirPath) => {
    try {
      const safe = pathIsInProjectFolder(dirPath, state.getCurrentProject());
      if (!safe) return { success: false, error: 'Path outside project folder' };
      await fs.promises.mkdir(safe, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Only existing directories: shell.openPath on a file would launch it.
  ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
      const stats = await fs.promises.stat(folderPath);
      if (!stats.isDirectory()) return { success: false, error: 'Not a folder' };
      shell.openPath(folderPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Open external URL in default browser
  ipcMain.handle('open-external', async (event, url) => {
    try {
      if (!isSafeExternalUrl(url)) return { success: false, error: 'URL not allowed' };
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Clipboard
  ipcMain.handle('write-clipboard-text', (event, text) => {
    clipboard.writeText(text);
    return { success: true };
  });
}

module.exports = { register };
