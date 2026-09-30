const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs');
const state = require('./state');
const { registerRemoteViewerRoutes } = require('./remote-viewer');
const {
  isLoopback,
  isCrossSiteBrowserRequest,
  isAllowedHost,
  parseIndexPath,
} = require('./lib/http-guards');

// Every route: the Host header must name this machine (DNS-rebinding defence
// for both the API and the remote viewer).
function hostGuard(req, res, next) {
  const hostname = os.hostname();
  if (!isAllowedHost(req.headers.host, [hostname, `${hostname}.local`])) {
    return res.status(403).json({ success: false, message: 'Host not allowed' });
  }
  next();
}

// /api: never on behalf of another web page; from the network only when the
// operator has enabled it for this session.
function apiAccessGuard(req, res, next) {
  if (isCrossSiteBrowserRequest(req.headers)) {
    return res.status(403).json({ success: false, message: 'Cross-site requests are not allowed' });
  }
  if (!isLoopback(req.socket?.remoteAddress) && !state.getApiNetworkEnabled()) {
    return res.status(403).json({ success: false, message: 'Remote control from the network is disabled' });
  }
  next();
}

// Name and top-level item count of the open project, read from its saved file.
// No filesystem paths leave the machine.
async function readProjectInfo(projectPath) {
  const fallbackName = path.basename(projectPath, '.liveplay');
  try {
    const data = JSON.parse(await fs.promises.readFile(projectPath, 'utf8'));
    return {
      name: typeof data.name === 'string' && data.name ? data.name : fallbackName,
      itemCount: Array.isArray(data.items) ? data.items.length : 0,
    };
  } catch (_) {
    return { name: fallbackName, itemCount: 0 };
  }
}

// Remote Control API routes (/api/*), behind apiAccessGuard.
function registerApiRoutes(apiApp) {
  apiApp.use('/api', apiAccessGuard);

  // Trigger item by UUID
  apiApp.get('/api/trigger/uuid/:uuid', (req, res) => {
    const { uuid } = req.params;
    const mainWindow = state.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('trigger-item', { type: 'uuid', value: uuid });
      res.json({ success: true, message: `Triggered item ${uuid}` });
    } else {
      res.status(500).json({ success: false, message: 'Window not available' });
    }
  });

  // Trigger item by index
  apiApp.get('/api/trigger/index/:index', (req, res) => {
    const { index } = req.params;
    const indexArray = parseIndexPath(index);
    if (!indexArray) {
      return res.status(400).json({ success: false, message: 'Invalid index' });
    }
    const mainWindow = state.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('trigger-item', { type: 'index', value: indexArray });
      res.json({ success: true, message: `Triggered item at index ${index}` });
    } else {
      res.status(500).json({ success: false, message: 'Window not available' });
    }
  });

  // Stop item
  apiApp.get('/api/stop/uuid/:uuid', (req, res) => {
    const { uuid } = req.params;
    const mainWindow = state.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('stop-item', { type: 'uuid', value: uuid });
      res.json({ success: true, message: `Stopped item ${uuid}` });
    } else {
      res.status(500).json({ success: false, message: 'Window not available' });
    }
  });

  // Get current project info
  apiApp.get('/api/project/info', async (req, res) => {
    const currentProject = state.getCurrentProject();
    if (currentProject) {
      res.json({ success: true, project: await readProjectInfo(currentProject) });
    } else {
      res.status(404).json({ success: false, message: 'No project loaded' });
    }
  });
}

// API Server Setup
function startAPIServer(port = 8080, maxAttempts = 10) {
  const apiApp = express();
  apiApp.use(hostGuard);
  apiApp.use(express.json());

  // Remote viewer routes (/player, /media, /events, shared renderer assets).
  registerRemoteViewerRoutes(apiApp);

  registerApiRoutes(apiApp);

  // Try to start server, incrementing port if already in use
  const tryListen = (currentPort, attemptsLeft) => {
    const server = apiApp.listen(currentPort)
      .on('listening', () => {
        state.setApiServer(server);
        state.setApiServerPort(currentPort);
        console.log(`E-LivePlay API Server running on http://localhost:${currentPort}`);
      })
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
          console.log(`Port ${currentPort} is in use, trying ${currentPort + 1}...`);
          tryListen(currentPort + 1, attemptsLeft - 1);
        } else if (err.code === 'EADDRINUSE') {
          console.error(`Failed to start API server after ${maxAttempts} attempts. Ports ${port}-${currentPort} are all in use.`);
        } else {
          console.error('Failed to start API server:', err);
        }
      });
  };

  tryListen(port, maxAttempts - 1);
}

module.exports = { startAPIServer, registerApiRoutes, hostGuard, apiAccessGuard };
