const path = require('path');
const fs = require('fs');

// Case-insensitive comparison on win32 and darwin. On darwin this assumes the
// default case-insensitive APFS volume; a case-sensitive volume only makes the
// guard accept a differently-cased twin inside the same folder.
const CASE_INSENSITIVE = process.platform === 'win32' || process.platform === 'darwin';

// Resolve symlinks on `p` (absolute). For a path that does not exist yet (a
// write target), resolve its nearest existing ancestor and append the rest.
// Returns null for a dangling symlink: writing through it would land wherever
// it points.
function realpathOrAncestor(p) {
  const rest = [];
  let current = p;
  for (;;) {
    let exists = true;
    try {
      fs.lstatSync(current);
    } catch (_) {
      exists = false;
    }
    if (exists) {
      try {
        return path.join(fs.realpathSync.native(current), ...rest.reverse());
      } catch (_) {
        return null;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      // Nothing along the chain exists (e.g. a missing drive on win32).
      return path.join(current, ...rest.reverse());
    }
    rest.push(path.basename(current));
    current = parent;
  }
}

// Guard: resolve a path and verify it lives inside `folder`, after resolving
// symbolic links on both. Returns the resolved (lexical) path on success, or
// null if outside the folder.
function pathIsInFolder(requestedPath, folder) {
  const resolved = path.resolve(requestedPath);
  const realFolder = realpathOrAncestor(path.resolve(folder));
  const realTarget = realpathOrAncestor(resolved);
  if (!realFolder || !realTarget) return null;
  const rel = CASE_INSENSITIVE
    ? path.relative(realFolder.toLowerCase(), realTarget.toLowerCase())
    : path.relative(realFolder, realTarget);
  const escapes = rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel);
  if (!escapes) {
    return resolved;
  }
  return null;
}

// Guard: resolve a path and verify it lives inside the active project folder.
// Returns the resolved path on success, or null if outside the project.
// If no project is open yet, allows access (user is selecting files via native dialogs).
function pathIsInProjectFolder(requestedPath, projectPath) {
  if (!projectPath) return path.resolve(requestedPath);
  return pathIsInFolder(requestedPath, path.dirname(projectPath));
}

module.exports = { pathIsInProjectFolder, pathIsInFolder };
