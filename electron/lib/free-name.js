const path = require('path');
const fs = require('fs');

// Candidate file name for the n-th import attempt of `baseName`:
// n = 1 is the name itself, then "name (2).ext", "name (3).ext", ...
function nextFreeName(baseName, n) {
  if (n <= 1) return baseName;
  const ext = path.extname(baseName);
  const stem = baseName.slice(0, baseName.length - ext.length);
  return `${stem} (${n})${ext}`;
}

// Copies `source` to `destination` without ever replacing an existing file.
// COPYFILE_EXCL fails atomically on EEXIST (no check-then-copy race); each
// clash retries with the next free name in the same directory. Resolves to
// the path actually written.
async function copyFileNoOverwrite(source, destination, maxAttempts = 999) {
  const dir = path.dirname(destination);
  const baseName = path.basename(destination);
  for (let n = 1; n <= maxAttempts; n++) {
    const candidate = path.join(dir, nextFreeName(baseName, n));
    try {
      await fs.promises.copyFile(source, candidate, fs.constants.COPYFILE_EXCL);
      return candidate;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('No free file name');
}

module.exports = { nextFreeName, copyFileNoOverwrite };
