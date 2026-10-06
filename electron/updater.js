const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { LATEST_RELEASE_API, parseLatestRelease } = require('./lib/release-info');
const state = require('./state');

const MANUAL_CHECK_TIMEOUT_MS = 10000;

// macOS builds are not signed, and Squirrel.Mac refuses to install an
// unsigned update, so macOS users are sent to the download page instead.
const canInstallInApp = process.platform !== 'darwin';

function sendToMainWindow(channel, payload) {
  const mainWindow = state.getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send(channel, payload);
  }
}

// Configures the auto-updater and event forwarding to the renderer. The feed
// comes from the app-update.yml electron-builder writes from `build.publish`.
// Called once from main.js at startup (matches previous module-load timing).
function configure() {
  autoUpdater.autoDownload = false; // Don't auto-download, ask user first
  autoUpdater.autoInstallOnAppQuit = true;

  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    sendToMainWindow('update-available', {
      currentVersion: app.getVersion(),
      newVersion: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available. Current version is latest:', info.version);
  });

  // A failed check is handled in checkForUpdates(); this reports the rest
  // (a failed download) to the update modal.
  autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater:', err);
    sendToMainWindow('update-error', err.message);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`);
    sendToMainWindow('update-download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    sendToMainWindow('update-downloaded', {
      version: info.version
    });
  });
}

// Asks GitHub for the latest published release. Resolves to the update info
// for the modal, or null when the running version is current.
async function checkForManualUpdate() {
  const response = await fetch(LATEST_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `CueBard/${app.getVersion()}`,
    },
    signal: AbortSignal.timeout(MANUAL_CHECK_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Latest release lookup failed: HTTP ${response.status}`);
  }
  return parseLatestRelease(await response.json(), app.getVersion());
}

async function notifyManualUpdate() {
  const updateInfo = await checkForManualUpdate();
  if (updateInfo) {
    console.log('New version available:', updateInfo.newVersion);
    sendToMainWindow('manual-update-available', updateInfo);
  }
  return { isManualUpdate: true, updateInfo };
}

// The one entry point for an update check (startup and IPC). Uses the
// in-app updater where it can install; otherwise, or when that check fails,
// looks up the latest release and offers the download page. The renderer is
// notified once per check.
async function checkForUpdates() {
  if (!canInstallInApp) {
    return notifyManualUpdate();
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    return { isManualUpdate: false, updateInfo: result?.updateInfo ?? null };
  } catch (error) {
    console.error('Auto-updater check failed, looking up the latest release:', error);
    return notifyManualUpdate();
  }
}

module.exports = { configure, checkForUpdates };
