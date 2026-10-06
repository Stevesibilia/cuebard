// The recent projects list shown on the welcome screen: entries
// { path, name, openedAt }, most recent first, each path once, at most
// MAX_RECENT_PROJECTS. Pure functions; misc.js does the file reading and
// writing.

const MAX_RECENT_PROJECTS = 8;

// Keeps only well-formed entries from whatever the stored file held, in
// order, each path once.
function sanitizeRecentProjects(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of raw) {
    if (!entry || typeof entry.path !== 'string' || !entry.path) continue;
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    result.push({
      path: entry.path,
      name: typeof entry.name === 'string' ? entry.name : '',
      openedAt: typeof entry.openedAt === 'string' ? entry.openedAt : ''
    });
    if (result.length === MAX_RECENT_PROJECTS) break;
  }
  return result;
}

// Puts `filePath` at the top (moving it if already listed) and drops the
// oldest entries beyond the cap.
function addRecentProject(list, filePath, name, openedAt) {
  const rest = list.filter(entry => entry.path !== filePath);
  return [{ path: filePath, name, openedAt }, ...rest].slice(0, MAX_RECENT_PROJECTS);
}

// Drops entries whose file no longer exists. `changed` tells the caller
// whether the stored list must be rewritten.
function pruneMissingProjects(list, exists) {
  const kept = list.filter(entry => exists(entry.path));
  return { list: kept, changed: kept.length !== list.length };
}

module.exports = {
  MAX_RECENT_PROJECTS,
  sanitizeRecentProjects,
  addRecentProject,
  pruneMissingProjects
};
