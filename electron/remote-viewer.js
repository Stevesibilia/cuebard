const path = require('path');
const fs = require('fs');
const state = require('./state');
const { getMimeType } = require('./lib/mime');
const { pathIsInFolder } = require('./lib/path-guard');

// Remote viewer: serves the player display to LAN browsers (e.g. an Android
// tablet) over HTTP, mirroring the local Electron player window.
//
//   GET /player              -> browser build of the shared player renderer
//   GET /player-renderer.js  -> shared renderer script (same file the Electron
//   GET /player-renderer.css    player window loads)
//   GET /media?path=<rel>    -> streams a displayable file from <project>/media
//   GET /events              -> Server-Sent Events stream of displayState pushes
//
// All routes are gated behind the operator toggle (state.remoteViewerEnabled,
// default off): when off they 404 and no media is streamed. File streaming is
// additionally confined to the project's media/ folder (symlinks resolved) and
// to the image/PDF types the player displays. Viewers only ever see paths
// relative to the project folder.

// Open SSE connections. Each is an Express `res` we write display-state events to.
const sseClients = new Set();

// Gate: reject remote viewer traffic unless the operator has enabled it.
function remoteViewerGate(req, res, next) {
  if (!state.getRemoteViewerEnabled()) {
    return res.status(404).send('Remote viewer disabled');
  }
  next();
}

// Drop all live viewers — called when the operator disables remote viewing so
// connected tablets stop receiving updates immediately.
function closeAllViewers() {
  for (const res of sseClients) {
    try { res.end(); } catch (_) {}
  }
  sseClients.clear();
}

function sseSend(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Absolute media path -> project-relative with '/' separators ('' when it is
// not inside the project, which /media refuses anyway).
function toProjectRelative(mediaPath, projectFolder) {
  if (typeof mediaPath !== 'string' || !mediaPath || !projectFolder) return '';
  const rel = path.relative(projectFolder, path.resolve(mediaPath));
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return '';
  return rel.split(path.sep).join('/');
}

// Copy of a displayState for remote viewers: media paths made relative to the
// project folder, so absolute paths (and the username in them) never leave the
// machine. The local player window keeps receiving the original.
function toRemoteDisplayState(displayState) {
  if (!displayState || typeof displayState !== 'object') return displayState;
  const projectPath = state.getCurrentProject();
  const projectFolder = projectPath ? path.dirname(projectPath) : null;
  const out = { ...displayState };
  if (Array.isArray(displayState.layers)) {
    out.layers = displayState.layers.map((layer) => ({
      ...layer,
      mediaPath: toProjectRelative(layer.mediaPath, projectFolder),
    }));
  }
  // Legacy single-item payload (see player-renderer.js renderState).
  if (typeof displayState.mediaPath === 'string') {
    out.mediaPath = toProjectRelative(displayState.mediaPath, projectFolder);
  }
  return out;
}

// Push a displayState to every connected remote viewer. Called from the same
// choke point that feeds the local player window (ipc/player.js push-to-player)
// so both outputs stay in lockstep.
function broadcastDisplayState(displayState) {
  if (sseClients.size === 0) return;
  const remoteState = toRemoteDisplayState(displayState);
  for (const res of sseClients) {
    try {
      sseSend(res, 'display-state', remoteState);
    } catch (err) {
      // Broken pipe — drop it; the 'close' handler will also clean up.
      sseClients.delete(res);
    }
  }
}

function registerRemoteViewerRoutes(app) {
  // Every remote viewer route is gated behind the operator toggle.
  app.use(['/player', '/player-renderer.js', '/player-renderer.css', '/media', '/events'], remoteViewerGate);

  // Shared renderer assets (identical files the Electron player window loads).
  app.get('/player-renderer.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'player-renderer.js'));
  });
  app.get('/player-renderer.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'player-renderer.css'));
  });

  // Browser viewer page (browser transport shim + shared renderer).
  app.get('/player', (req, res) => {
    res.sendFile(path.join(__dirname, 'player-browser.html'));
  });

  // Stream a displayable file from the project's media/ folder, by path
  // relative to the project folder (as sent in the remote display state).
  app.get('/media', (req, res) => {
    const requested = req.query.path;
    if (typeof requested !== 'string' || !requested) {
      return res.status(400).send('Missing path');
    }
    const projectPath = state.getCurrentProject();
    if (!projectPath) {
      // No project loaded: nothing legitimate to serve remotely.
      return res.status(404).send('No project loaded');
    }
    // Relative paths only (either separator style, no drive letters).
    if (path.isAbsolute(requested) || path.win32.isAbsolute(requested) || /^[a-z]:/i.test(requested)) {
      return res.status(403).send('Forbidden');
    }
    const projectFolder = path.dirname(projectPath);
    const safePath = pathIsInFolder(path.resolve(projectFolder, requested), path.join(projectFolder, 'media'));
    if (!safePath) {
      return res.status(403).send('Forbidden');
    }
    const mimeType = getMimeType(safePath);
    if (mimeType === 'application/octet-stream') {
      return res.status(403).send('Forbidden');
    }
    if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
      return res.status(404).send('Not found');
    }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (mimeType === 'image/svg+xml') {
      // Opened directly, an SVG is a document that could run script.
      res.setHeader('Content-Security-Policy', 'sandbox');
    }
    fs.createReadStream(safePath)
      .on('error', () => {
        if (!res.headersSent) res.status(500);
        res.end();
      })
      .pipe(res);
  });

  // Live displayState stream. On connect, replay the buffered state so a
  // viewer joining (or reconnecting) mid-session shows the current visual.
  app.get('/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n'); // flush headers

    sseClients.add(res);

    const last = state.getLastDisplayState();
    if (last) sseSend(res, 'display-state', toRemoteDisplayState(last));

    req.on('close', () => {
      sseClients.delete(res);
    });
  });
}

module.exports = { registerRemoteViewerRoutes, broadcastDisplayState, closeAllViewers };
