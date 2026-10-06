const { app, dialog, protocol, net } = require('electron');
const { pathToFileURL } = require('url');
const state = require('./state');
const { pathIsInProjectFolder } = require('./lib/path-guard');
const { isProjectFile, isArchiveFile } = require('./lib/file-types');
const { migrateLegacyData } = require('./lib/legacy-data');
const { createWindow } = require('./windows');
const menu = require('./menu');
const updater = require('./updater');
const { startAPIServer } = require('./api-server');
const { checkAndSetupFfmpeg } = require('./media/ffmpeg');
const filesIpc = require('./ipc/files');
const projectIpc = require('./ipc/project');
const playerIpc = require('./ipc/player');
const miscIpc = require('./ipc/misc');
const ytdlp = require('./media/ytdlp');
const waveform = require('./media/waveform');

// Register custom protocol as privileged (must be before app ready)
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
]);

// Configure auto-update feed and renderer event forwarding.
updater.configure();

let fileToOpen = null; // Store file path if app is opened with a file

// IPC handler registration — all handlers live in electron/ipc/ and
// electron/media/; registered explicitly in one ordered block.
filesIpc.register();
projectIpc.register({ rebuildMenu: menu.rebuildMenu });
playerIpc.register({ rebuildMenu: menu.rebuildMenu });
miscIpc.register({
  createMenu: menu.createMenu,
  rebuildMenu: menu.rebuildMenu,
  checkForUpdates: updater.checkForUpdates,
  getLocaleFiles: menu.getLocaleFiles,
});
waveform.register();
ytdlp.register();

// One instance only: a second launch focuses the running window
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Carry settings over from E-LivePlay before Chromium opens Local Storage,
  // and before yt-dlp looks for its binary in bin/.
  migrateLegacyData({ appData: app.getPath('appData'), userData: app.getPath('userData') });

  // ffmpeg and yt-dlp management live in electron/media/. yt-dlp starts
  // initializing now, before the app is ready.
  ytdlp.initializeYtDlp();

  app.on('second-instance', (event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window
    const mainWindow = state.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Register protocol to serve local media files safely
    // Serves only files inside the open project (symlinks resolved), and
    // nothing when no project is open.
    protocol.handle('local-media', (request) => {
      let safePath = null;
      try {
        const url = request.url.replace('local-media://', '');
        const filePath = decodeURIComponent(url);
        const projectPath = state.getCurrentProject();
        if (projectPath) safePath = pathIsInProjectFolder(filePath, projectPath);
      } catch (_) {
        safePath = null;
      }
      if (!safePath) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(safePath).href);
    });

    // Setup bundled ffmpeg before creating window
    const ffmpegReady = await checkAndSetupFfmpeg();
    if (!ffmpegReady) {
      console.error('Warning: Bundled ffmpeg failed to initialize. Audio processing may be limited.');
    }
    
    createWindow({ createMenu: menu.createMenu, startAPIServer });
    
    // If a file was opened before the app was ready, open it now
    const mainWindow = state.getMainWindow();
    if (fileToOpen && mainWindow) {
      mainWindow.once('ready-to-show', () => {
        openFile(fileToOpen);
        fileToOpen = null;
      });
    }
  });
}

// Handle file opening on Windows/Linux (when file is double-clicked)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  
  const mainWindow = state.getMainWindow();
  if (mainWindow && mainWindow.webContents) {
    // Window is ready, open the file immediately
    openFile(filePath);
  } else {
    // Window not ready yet, store the file path
    fileToOpen = filePath;
  }
});

// Handle command line arguments (Windows/Linux)
if (process.platform === 'win32' || process.platform === 'linux') {
  // Check if a file was passed as argument
  const fileArg = process.argv.find(arg => isProjectFile(arg) || isArchiveFile(arg));
  if (fileArg) {
    fileToOpen = fileArg;
  }
}

// Helper function to open a project file
function openFile(filePath) {
  const mainWindow = state.getMainWindow();
  if (!mainWindow) return;
  
  try {
    // Archives (.cbpack, legacy .lpa) go through the import flow
    if (isArchiveFile(filePath)) {
      mainWindow.webContents.send('open-lpa-file', { lpaPath: filePath });
      console.log('Triggering import for archive:', filePath);
      return;
    }
    
    // Project files (.cuebard, legacy .liveplay): the renderer opens them through
    // openProject(), the same path as File > Open (validation, migrations,
    // folderPath, setCurrentProject, cart-only items, waveforms)
    mainWindow.webContents.send('open-project-file', { filePath });
    
    console.log('Opened project file:', filePath);
  } catch (error) {
    console.error('Failed to open project file:', error);
    
    if (mainWindow) {
      dialog.showErrorBox(
        'Failed to Open Project',
        `Could not open the project file:\n${error.message}`
      );
    }
  }
}

app.on('window-all-closed', () => {
  const apiServer = state.getApiServer();
  if (apiServer) {
    apiServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (state.getMainWindow() === null) {
    createWindow({ createMenu: menu.createMenu, startAPIServer });
  }
});
