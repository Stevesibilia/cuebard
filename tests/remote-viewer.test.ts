import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Writable } from 'stream';

// The real state singleton loads outside the electron runtime (state.js guards
// its app.isPackaged access). Real state, path-guard, and mime are used
// directly — the test steers behaviour through the real state setters. The
// /media confinement runs against a temp project on disk; the other tests
// exercise routing/guard branches that never reach the filesystem.

import { createRequire } from 'module';

// Load both electron modules through the same CJS require so they share one
// Node module cache — otherwise an ESM `import` of state and remote-viewer's
// own `require('./state')` resolve to two different singleton instances and the
// setters below wouldn't affect what the route handlers read.
const require = createRequire(import.meta.url);
const state = require('../electron/state');
const { registerRemoteViewerRoutes, broadcastDisplayState, closeAllViewers } = require('../electron/remote-viewer');

// Minimal Express app double: records route + middleware handlers.
function makeApp() {
  const gets: Record<string, Function> = {};
  const uses: Array<{ paths: string[]; handler: Function }> = [];
  return {
    get: (p: string, h: Function) => { gets[p] = h; },
    use: (paths: string[], h: Function) => { uses.push({ paths, handler: h }); },
    gets,
    uses,
  };
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    writes: [] as string[],
    body: undefined as unknown,
    ended: false,
    status(c: number) { this.statusCode = c; return this; },
    send(b: unknown) { this.body = b; this.ended = true; return this; },
    setHeader(k: string, v: unknown) { this.headers[k] = v; },
    writeHead(c: number, h: Record<string, unknown>) { this.statusCode = c; Object.assign(this.headers, h); return this; },
    write(s: string) { this.writes.push(s); return true; },
    end() { this.ended = true; return this; },
  };
}

function makeReq(query: Record<string, unknown> = {}) {
  const handlers: Record<string, Function> = {};
  return {
    query,
    on: (ev: string, cb: Function) => { handlers[ev] = cb; },
    fire: (ev: string) => handlers[ev]?.(),
  };
}

let app: ReturnType<typeof makeApp>;

beforeEach(() => {
  state.setRemoteViewerEnabled(false);
  state.setCurrentProject(null);
  state.setLastDisplayState(null);
  closeAllViewers(); // clear any client left over between tests
  app = makeApp();
  registerRemoteViewerRoutes(app as any);
});

describe('remote viewer gate', () => {
  it('404s every remote route when the viewer is disabled', () => {
    const { handler } = app.uses[0];
    const res = makeRes();
    const next = vi.fn();
    handler(makeReq(), res, next);
    expect(res.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when the viewer is enabled', () => {
    state.setRemoteViewerEnabled(true);
    const { handler } = app.uses[0];
    const res = makeRes();
    const next = vi.fn();
    handler(makeReq(), res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('/events SSE stream', () => {
  it('opens the stream and replays the buffered display state on connect', () => {
    state.setLastDisplayState({ layers: [{ id: 'a' }] });
    const res = makeRes();
    app.gets['/events'](makeReq(), res);

    expect(res.headers['Content-Type']).toBe('text/event-stream');
    const joined = res.writes.join('');
    expect(joined).toContain('event: display-state');
    expect(joined).toContain('"id":"a"');
  });

  it('broadcasts subsequent display states to connected clients', () => {
    const res = makeRes();
    app.gets['/events'](makeReq(), res);
    const before = res.writes.length;

    broadcastDisplayState({ layers: [{ id: 'b' }] });
    const joined = res.writes.slice(before).join('');
    expect(joined).toContain('event: display-state');
    expect(joined).toContain('"id":"b"');
  });

  it('drops clients and stops broadcasting after closeAllViewers', () => {
    const res = makeRes();
    app.gets['/events'](makeReq(), res);
    closeAllViewers();
    expect(res.ended).toBe(true);

    const before = res.writes.length;
    broadcastDisplayState({ layers: [] });
    expect(res.writes.length).toBe(before); // no longer receiving
  });

  it('removes a client when its request closes', () => {
    const res = makeRes();
    const req = makeReq();
    app.gets['/events'](req, res);
    req.fire('close');

    const before = res.writes.length;
    broadcastDisplayState({ layers: [] });
    expect(res.writes.length).toBe(before);
  });
});

describe('/media file streaming guard', () => {
  it('400s when no path is given', () => {
    const res = makeRes();
    app.gets['/media'](makeReq({}), res);
    expect(res.statusCode).toBe(400);
  });

  it('404s when no project is loaded', () => {
    state.setCurrentProject(null);
    const res = makeRes();
    app.gets['/media'](makeReq({ path: '/p/media/x.jpg' }), res);
    expect(res.statusCode).toBe(404);
  });

  it('403s a path outside the project folder', () => {
    state.setCurrentProject('/p/show.liveplay');
    const res = makeRes();
    app.gets['/media'](makeReq({ path: '/etc/passwd' }), res);
    expect(res.statusCode).toBe(403);
  });
});

describe('/media confinement to <project>/media', () => {
  // Real files: the route resolves symlinks and checks existence on disk.
  let root: string;
  let projectFile: string;

  // A writable double that createReadStream can pipe into.
  function makeStreamRes() {
    const chunks: Buffer[] = [];
    const res: any = new Writable({
      write(chunk, _enc, cb) { chunks.push(Buffer.from(chunk)); cb(); },
    });
    res.statusCode = 200;
    res.headers = {} as Record<string, unknown>;
    res.headersSent = false;
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.send = (b: unknown) => { res.body = b; res.end(); return res; };
    res.setHeader = (k: string, v: unknown) => { res.headers[k] = v; };
    res.text = () => Buffer.concat(chunks).toString();
    return res;
  }

  async function getMedia(p: string) {
    const res = makeStreamRes();
    const done = new Promise((resolve) => res.on('finish', resolve));
    app.gets['/media'](makeReq({ path: p }), res);
    await done;
    return res;
  }

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-media-'));
    const project = path.join(root, 'show');
    fs.mkdirSync(path.join(project, 'media', 'visuals'), { recursive: true });
    fs.mkdirSync(path.join(root, 'outside'));
    projectFile = path.join(project, 'show.liveplay');
    fs.writeFileSync(projectFile, '{"name":"Show"}');
    fs.writeFileSync(path.join(project, 'media', 'visuals', 'map.png'), 'PNGDATA');
    fs.writeFileSync(path.join(project, 'media', 'visuals', 'icon.svg'), '<svg/>');
    fs.writeFileSync(path.join(project, 'media', 'notes.txt'), 'text');
    fs.writeFileSync(path.join(root, 'outside', 'secret.png'), 'SECRET');
    fs.symlinkSync(path.join(root, 'outside'), path.join(project, 'media', 'escape'), 'dir');
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  beforeEach(() => {
    state.setCurrentProject(projectFile);
  });

  it('streams a visual by project-relative path, with nosniff', async () => {
    const res = await getMedia('media/visuals/map.png');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/png');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.text()).toBe('PNGDATA');
  });

  it('sandboxes SVG documents', async () => {
    const res = await getMedia('media/visuals/icon.svg');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Security-Policy']).toBe('sandbox');
  });

  it('403s the project file and anything else outside media/', async () => {
    expect((await getMedia('show.liveplay')).statusCode).toBe(403);
    expect((await getMedia('media/../show.liveplay')).statusCode).toBe(403);
    expect((await getMedia('../outside/secret.png')).statusCode).toBe(403);
  });

  it('403s absolute paths, even to a real media file', async () => {
    const abs = path.join(path.dirname(projectFile), 'media', 'visuals', 'map.png');
    expect((await getMedia(abs)).statusCode).toBe(403);
    expect((await getMedia('C:\\Users\\x\\map.png')).statusCode).toBe(403);
  });

  it('403s a symlink inside media/ that points outside', async () => {
    expect((await getMedia('media/escape/secret.png')).statusCode).toBe(403);
  });

  it('403s a file type the player cannot display', async () => {
    expect((await getMedia('media/notes.txt')).statusCode).toBe(403);
  });

  it('404s a missing visual', async () => {
    expect((await getMedia('media/visuals/missing.png')).statusCode).toBe(404);
  });
});

describe('remote display state uses project-relative paths', () => {
  const folder = path.join(path.sep, 'Users', 'me', 'shows', 'show');

  beforeEach(() => {
    state.setCurrentProject(path.join(folder, 'show.liveplay'));
  });

  it('rewrites layer paths in broadcasts', () => {
    const res = makeRes();
    app.gets['/events'](makeReq(), res);
    const before = res.writes.length;

    broadcastDisplayState({
      layers: [
        { id: 'a', mediaPath: path.join(folder, 'media', 'visuals', 'x.png') },
        { id: 'b', mediaPath: path.join(path.sep, 'etc', 'passwd') },
      ],
    });
    const joined = res.writes.slice(before).join('');
    expect(joined).toContain('"mediaPath":"media/visuals/x.png"');
    expect(joined).toContain('"mediaPath":""');
    expect(joined).not.toContain(folder.split(path.sep).join('/'));
    expect(joined).not.toContain('passwd');
  });

  it('rewrites the replayed state on connect and leaves the buffered state alone', () => {
    const abs = path.join(folder, 'media', 'visuals', 'y.png');
    const original = { layers: [{ id: 'c', mediaPath: abs }] };
    state.setLastDisplayState(original);
    const res = makeRes();
    app.gets['/events'](makeReq(), res);
    expect(res.writes.join('')).toContain('"mediaPath":"media/visuals/y.png"');
    expect(original.layers[0].mediaPath).toBe(abs);
  });
});
