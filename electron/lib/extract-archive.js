const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const yauzl = require('yauzl');

// Safe .lpa (zip) extraction into a folder that must not exist yet.
//   - only regular files and directories are written; symlinks and other
//     special entries are skipped
//   - an entry that is absolute, carries a drive letter or resolves outside
//     targetDir aborts the whole extraction
//   - the running uncompressed total is capped (zip bombs)
//   - files are created with 'wx', never overwriting
// On any failure the target folder, which this function created, is removed.

const S_IFMT = 0o170000;
const S_IFREG = 0o100000;
const S_IFDIR = 0o040000;
const ONE_GIB = 1024 * 1024 * 1024;

function openZip(archivePath) {
  return new Promise((resolve, reject) => {
    // validateEntrySizes: yauzl errors if an entry inflates beyond its
    // declared size, so the declared sizes below can be trusted for the cap.
    yauzl.open(archivePath, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true }, (err, zipfile) => {
      if (err) reject(err);
      else resolve(zipfile);
    });
  });
}

function openEntryStream(zipfile, entry) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) reject(err);
      else resolve(stream);
    });
  });
}

// Destination for an entry name, or null if it would land outside targetDir.
function entryDestination(targetDir, name) {
  if (!name || path.isAbsolute(name) || path.win32.isAbsolute(name) || /^[a-z]:/i.test(name) || name.includes('\\')) {
    return null;
  }
  const dest = path.resolve(targetDir, name);
  const rel = path.relative(targetDir, dest);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return null;
  return dest;
}

async function extractArchive(archivePath, targetDir, { onProgress, maxTotalBytes } = {}) {
  const archiveSize = (await fs.promises.stat(archivePath)).size;
  const cap = maxTotalBytes ?? Math.max(20 * archiveSize, ONE_GIB);
  const target = path.resolve(targetDir);

  // Non-recursive: fails with EEXIST rather than writing into an existing folder.
  await fs.promises.mkdir(target);

  const zipfile = await openZip(archivePath).catch(async (err) => {
    await fs.promises.rm(target, { recursive: true, force: true });
    throw err;
  });

  try {
    await new Promise((resolve, reject) => {
      let totalBytes = 0;
      let entriesDone = 0;

      const fail = (err) => {
        zipfile.close();
        reject(err);
      };

      zipfile.on('error', fail);
      zipfile.on('end', resolve);
      zipfile.on('entry', async (entry) => {
        try {
          const dest = entryDestination(target, entry.fileName);
          if (!dest) {
            throw new Error(`Archive entry outside the target folder: ${entry.fileName}`);
          }

          // Unix mode bits live in the high 16 bits; 0 means the archiver
          // recorded none (e.g. Windows tools), so fall back to the name.
          const mode = (entry.externalFileAttributes >>> 16) & S_IFMT;
          const isDir = entry.fileName.endsWith('/');
          const skip = mode !== 0 && mode !== (isDir ? S_IFDIR : S_IFREG);

          if (!skip && isDir) {
            await fs.promises.mkdir(dest, { recursive: true });
          } else if (!skip) {
            totalBytes += entry.uncompressedSize;
            if (totalBytes > cap) {
              throw new Error('Archive is larger than the allowed uncompressed size');
            }
            await fs.promises.mkdir(path.dirname(dest), { recursive: true });
            // Create the file before opening the entry: an existing file fails
            // here, not halfway through a stream.
            const handle = await fs.promises.open(dest, 'wx');
            const input = await openEntryStream(zipfile, entry).catch(async (err) => {
              await handle.close();
              throw err;
            });
            await pipeline(input, handle.createWriteStream());
          }

          entriesDone++;
          if (onProgress && zipfile.entryCount > 0) {
            onProgress(Math.round((entriesDone / zipfile.entryCount) * 100));
          }
          zipfile.readEntry();
        } catch (err) {
          fail(err);
        }
      });

      zipfile.readEntry();
    });
  } catch (err) {
    await fs.promises.rm(target, { recursive: true, force: true });
    throw err;
  }
}

module.exports = { extractArchive };
