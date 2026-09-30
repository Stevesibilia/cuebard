import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

// Same CJS-require pattern as remote-viewer.test.ts: state and api-server must
// share one module cache so the setters below reach the route handlers.
const require = createRequire(import.meta.url);
const state = require('../electron/state');
const { registerApiRoutes, hostGuard, apiAccessGuard } = require('../electron/api-server');

function makeApp() {
  const gets: Record<string, Function> = {};
  const uses: Array<{ path: string; handler: Function }> = [];
  return {
    get: (p: string, h: Function) => { gets[p] = h; },
    use: (p: string, h: Function) => { uses.push({ path: p, handler: h }); },
    gets,
    uses,
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; },
  };
}

function makeReq({ headers = {}, remoteAddress = '127.0.0.1', params = {} }: {
  headers?: Record<string, string>; remoteAddress?: string; params?: Record<string, string>;
} = {}) {
  return { headers, params, socket: { remoteAddress } };
}

function runGuard(guard: Function, req: unknown) {
  const res = makeRes();
  const next = vi.fn();
  guard(req, res, next);
  return { res, next };
}

beforeEach(() => {
  state.setApiNetworkEnabled(false);
  state.setCurrentProject(null);
  state.setMainWindow(null);
});

describe('/api access guard', () => {
  it('is mounted on /api', () => {
    const app = makeApp();
    registerApiRoutes(app);
    expect(app.uses).toEqual([{ path: '/api', handler: apiAccessGuard }]);
  });

  it('lets loopback curl through', () => {
    expect(runGuard(apiAccessGuard, makeReq()).next).toHaveBeenCalledOnce();
    expect(runGuard(apiAccessGuard, makeReq({ remoteAddress: '::ffff:127.0.0.1' })).next).toHaveBeenCalledOnce();
  });

  it('refuses a LAN client while the network toggle is off', () => {
    const { res, next } = runGuard(apiAccessGuard, makeReq({ remoteAddress: '192.168.1.50' }));
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets a LAN client through once the toggle is on', () => {
    state.setApiNetworkEnabled(true);
    expect(runGuard(apiAccessGuard, makeReq({ remoteAddress: '192.168.1.50' })).next).toHaveBeenCalledOnce();
  });

  it('refuses cross-site browser requests even from loopback with the toggle on', () => {
    state.setApiNetworkEnabled(true);
    const withOrigin = runGuard(apiAccessGuard, makeReq({ headers: { origin: 'https://evil.example' } }));
    expect(withOrigin.res.statusCode).toBe(403);
    expect(withOrigin.next).not.toHaveBeenCalled();
    const imgTag = runGuard(apiAccessGuard, makeReq({ headers: { 'sec-fetch-site': 'cross-site' } }));
    expect(imgTag.res.statusCode).toBe(403);
  });
});

describe('Host guard', () => {
  it('refuses a foreign host name', () => {
    const { res, next } = runGuard(hostGuard, makeReq({ headers: { host: 'evil.example:8080' } }));
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows the LAN IP, localhost and this machine name', () => {
    for (const host of ['192.168.1.42:8080', 'localhost:8080', `${os.hostname()}.local:8080`]) {
      expect(runGuard(hostGuard, makeReq({ headers: { host } })).next).toHaveBeenCalledOnce();
    }
  });
});

describe('/api routes', () => {
  let app: ReturnType<typeof makeApp>;
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-api-'));
    fs.writeFileSync(path.join(root, 'show.liveplay'), JSON.stringify({ name: 'My Show', items: [{}, {}, {}] }));
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  beforeEach(() => {
    app = makeApp();
    registerApiRoutes(app);
  });

  it('400s an invalid index path without triggering', () => {
    const send = vi.fn();
    state.setMainWindow({ webContents: { send } });
    const res = makeRes();
    app.gets['/api/trigger/index/:index'](makeReq({ params: { index: '-1' } }), res);
    expect(res.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('triggers a valid index path', () => {
    const send = vi.fn();
    state.setMainWindow({ webContents: { send } });
    const res = makeRes();
    app.gets['/api/trigger/index/:index'](makeReq({ params: { index: '1,0' } }), res);
    expect(res.statusCode).toBe(200);
    expect(send).toHaveBeenCalledWith('trigger-item', { type: 'index', value: [1, 0] });
  });

  it('returns project name and item count, no paths', async () => {
    state.setCurrentProject(path.join(root, 'show.liveplay'));
    const res = makeRes();
    await app.gets['/api/project/info'](makeReq(), res);
    expect(res.body).toEqual({ success: true, project: { name: 'My Show', itemCount: 3 } });
    expect(JSON.stringify(res.body)).not.toContain(root);
  });

  it('404s project info with no project', async () => {
    const res = makeRes();
    await app.gets['/api/project/info'](makeReq(), res);
    expect(res.statusCode).toBe(404);
  });
});
