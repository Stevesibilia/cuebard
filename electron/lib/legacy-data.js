const path = require('path');
const nodeFs = require('fs');

// Data folders E-LivePlay used: packaged builds use the product name, dev
// runs the npm name. They are the same folder on case-insensitive disks.
const LEGACY_FOLDER_NAMES = ['E-LivePlay', 'e-liveplay'];

// What is worth carrying over: the saved language lives in Local Storage,
// the MIDI mapping in midi-config.json, and bin/ holds the downloaded yt-dlp.
const LEGACY_ITEMS = ['Local Storage', 'midi-config.json', 'bin'];

const MARKER = '.legacy-data-migrated';

const sameFolder = (fs, a, b) => {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return false;
  }
};

// Copies E-LivePlay's settings into CueBard's data folder, once. Each item is
// copied only when the target does not have it; the E-LivePlay folder is
// never changed. Never throws: start-up must not depend on it.
// Returns the names of the copied items.
function migrateLegacyData({ appData, userData, fs = nodeFs, log = console }) {
  const copied = [];
  try {
    if (fs.existsSync(path.join(userData, MARKER))) return copied;

    const source = LEGACY_FOLDER_NAMES
      .map((name) => path.join(appData, name))
      .find((folder) => fs.existsSync(folder) && !sameFolder(fs, folder, userData));

    if (source) {
      fs.mkdirSync(userData, { recursive: true });
      for (const item of LEGACY_ITEMS) {
        const from = path.join(source, item);
        const to = path.join(userData, item);
        if (!fs.existsSync(from) || fs.existsSync(to)) continue;
        try {
          fs.cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
          copied.push(item);
        } catch (error) {
          log.error(`Could not copy ${item} from ${source}:`, error);
        }
      }
      if (copied.length > 0) log.log(`Copied E-LivePlay settings from ${source}:`, copied.join(', '));
    }

    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, MARKER), new Date().toISOString());
  } catch (error) {
    log.error('E-LivePlay settings migration failed:', error);
  }
  return copied;
}

module.exports = { migrateLegacyData, LEGACY_FOLDER_NAMES, LEGACY_ITEMS, MARKER };
