// Takes the README screenshots from the running dev app.
//
//   node scripts/take-screenshots.mjs
//
// Builds a demo project in a temp folder (tones made with the bundled
// ffmpeg, plain coloured placeholder images), starts Nuxt and Electron in
// dev mode, drives the app over the Chrome DevTools Protocol and writes
// PNGs to docs/screenshots/: 1440x900, except minimal mode, which is kept
// at twice the size of its small window. Run by hand, not in CI. It takes
// about two minutes, and the cues it plays are audible.
//
// Needs ports 3000 (Nuxt), 8080 (API), 9222 and 9229 (DevTools) free, so
// no other dev app or CueBard may be running. Leaves no trace: the temp
// folder is deleted, the dev app's recent-projects.json and its language
// setting are put back as they were.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path;
const WIDTH = 1440;
const HEIGHT = 900;
const PORTS = { nuxt: 3000, renderer: 9222, main: 9229, api: 8080 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(`[screenshots] ${message}`);

// ---------------------------------------------------------------------------
// Demo project

// Cue audio: tones and noise shaped so the waveforms are not flat bars.
// [name, seconds, ffmpeg lavfi source]
const tone = (hz, seconds, wobble = 0.15) =>
  `sine=frequency=${hz}:duration=${seconds},tremolo=f=${wobble}:d=0.7,afade=t=in:d=2,afade=t=out:st=${seconds - 3}:d=3`;
const noise = (colour, seconds, amplitude = 0.4) =>
  `anoisesrc=color=${colour}:amplitude=${amplitude}:duration=${seconds},tremolo=f=0.12:d=0.6,afade=t=in:d=3`;
const sting = (hz, seconds) =>
  `sine=frequency=${hz}:duration=${seconds},afade=t=out:st=0:d=${seconds}`;

const ACTS = [
  {
    name: 'Act 1 · The Citadel',
    color: '#0F62FE',
    cues: [
      { name: 'Tavern ambience', seconds: 180, source: noise('pink', 180, 0.3), end: 'loop' },
      { name: 'Rain on cobblestones', seconds: 240, source: noise('brown', 240, 0.5), end: 'loop' },
      { name: 'Market square', seconds: 150, source: tone(330, 150, 0.4) },
      { name: 'Council chamber', seconds: 120, source: tone(262, 120, 0.25) },
    ],
  },
  {
    name: 'Act 2 · The Crypt',
    color: '#8A3FFC',
    cues: [
      { name: 'Dripping cavern', seconds: 200, source: tone(196, 200, 0.6) },
      { name: 'Skeletons rise', seconds: 45, source: tone(147, 45, 2) },
      { name: 'The Bone Tyrant', seconds: 210, source: tone(98, 210, 1.2) },
      { name: 'Victory fanfare', seconds: 14, source: tone(523, 14, 3) },
    ],
  },
];

const STINGS = [
  { name: 'Door creak', seconds: 3, source: sting(180, 3) },
  { name: 'Thunder', seconds: 6, source: `anoisesrc=color=brown:amplitude=0.9:duration=6,afade=t=out:st=0.5:d=5.5` },
  { name: 'Sword clash', seconds: 2, source: sting(1200, 2) },
  { name: 'Coin pouch', seconds: 2, source: sting(880, 2) },
  { name: 'Wolf howl', seconds: 5, source: tone(440, 5, 0.5) },
];

// [display name, folder, background colour, accent colour]
const IMAGES = [
  ['Citadel map', 'Maps', '#2B3A2E', '#A7C080'],
  ['Crypt map', 'Maps', '#2A2433', '#B39DDB'],
  ['Sealed letter', 'Handouts', '#4A3B28', '#E6C38A'],
  ['The Bone Tyrant', 'Characters', '#3A1F1F', '#FF8389'],
];

function makeAudio(mediaDir, cue) {
  const fileName = `${cue.name}.mp3`;
  execFileSync(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', cue.source,
    '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k',
    path.join(mediaDir, fileName),
  ]);
  return fileName;
}

function audioItem(cue, fileName, index, overrides = {}) {
  const uuid = randomUUID();
  return {
    uuid,
    index,
    displayName: cue.name,
    color: '#6b7280',
    type: 'audio',
    mediaFileName: fileName,
    mediaPath: `media/${fileName}`,
    waveformPath: `${uuid}.json`,
    inPoint: 0,
    outPoint: cue.seconds,
    volume: 1,
    endBehavior: { action: cue.end === 'loop' ? 'loop' : 'next' },
    startBehavior: { action: 'nothing' },
    customActions: [],
    duckingBehavior: { mode: 'stop-all', duckFadeIn: 0.25, duckFadeOut: 1 },
    duration: cue.seconds,
    fadeOutDuration: 1,
    playFade: 0,
    stopFade: 0,
    crossFade: 0,
    ...overrides,
  };
}

function emptyProject(name, schemaVersion) {
  const now = new Date().toISOString();
  return {
    name,
    version: '1.0.0',
    schemaVersion,
    folderPath: '',
    items: [],
    cartItems: [],
    cartSlotKeys: Object.fromEntries(
      Array.from({ length: 16 }, (_, slot) => [slot, {
        key: String((slot < 10 ? slot + 1 : slot - 9) % 10),
        ctrlKey: slot >= 10,
        shiftKey: false,
        altKey: false,
      }]),
    ),
    cartOnlyItems: [],
    visualMedia: [],
    visualFolders: [],
    visualDisplayEnabled: true,
    theme: { mode: 'cobalt', accentColor: '' },
    createdAt: now,
    lastModified: now,
  };
}

function schemaVersion() {
  // CURRENT_SCHEMA_VERSION is migrations.length in app/utils/migrations.ts
  const source = fs.readFileSync(path.join(ROOT, 'app', 'utils', 'migrations.ts'), 'utf8');
  const registry = source.match(/const migrations\b[^\n]*\[\n([\s\S]*?)\n\];/);
  if (!registry) throw new Error('Cannot find the migration registry in app/utils/migrations.ts');
  return registry[1].split('\n').filter((line) => /^\s*migrate\w+,?/.test(line)).length;
}

function buildDemoProject(tempDir) {
  const version = schemaVersion();
  const folder = path.join(tempDir, 'The Bone Tyrant');
  const mediaDir = path.join(folder, 'media');
  fs.mkdirSync(path.join(mediaDir, 'visuals'), { recursive: true });
  fs.mkdirSync(path.join(folder, 'waveforms'), { recursive: true });

  const project = emptyProject('Session 12 · The Bone Tyrant', version);
  const cues = {};

  ACTS.forEach((act, actIndex) => {
    const groupUuid = randomUUID();
    const children = act.cues.map((cue, cueIndex) => {
      const item = audioItem(cue, makeAudio(mediaDir, cue), [actIndex, cueIndex]);
      cues[cue.name] = item;
      return item;
    });
    project.items.push({
      uuid: groupUuid,
      index: [actIndex],
      displayName: act.name,
      color: act.color,
      type: 'group',
      children,
      startBehavior: { action: 'play-first' },
      endBehavior: { action: 'nothing' },
      isExpanded: true,
    });
  });

  // Behaviours worth showing in the properties drawer
  const rise = cues['Skeletons rise'];
  rise.color = '#DA1E28';
  rise.endBehavior = { action: 'goto-item', targetUuid: cues['The Bone Tyrant'].uuid };
  rise.duckingBehavior = { mode: 'duck-others', duckLevel: 0.2, duckFadeIn: 0.25, duckFadeOut: 1 };
  rise.playFade = 1.5;
  cues['The Bone Tyrant'].color = '#DA1E28';
  cues['Victory fanfare'].color = '#F1C21B';
  cues['Victory fanfare'].endBehavior = { action: 'nothing' };
  cues['Tavern ambience'].color = '#24A148';
  cues['Rain on cobblestones'].color = '#1192E8';

  STINGS.forEach((cue, slot) => {
    const item = audioItem(cue, makeAudio(mediaDir, cue), [-1, slot], {
      endBehavior: { action: 'nothing' },
      duckingBehavior: { mode: 'duck-others', duckLevel: 0.2, duckFadeIn: 0.25, duckFadeOut: 1 },
    });
    project.cartOnlyItems.push(item);
    project.cartItems.push({ slot, itemUuid: item.uuid, index: [-1, slot] });
  });

  project.visualFolders = [...new Set(IMAGES.map(([, folderTag]) => folderTag))];
  for (const [name, folderTag] of IMAGES) {
    const uuid = randomUUID();
    const fileName = `${uuid}_${name}.png`;
    project.visualMedia.push({
      uuid,
      displayName: name,
      mediaFileName: fileName,
      mediaPath: `media/visuals/${fileName}`,
      mediaType: 'image',
      folder: folderTag,
      linkDelay: 0,
      fadeIn: 1,
      fadeOut: 1,
    });
  }
  project.visualMedia.find((item) => item.displayName === 'The Bone Tyrant').linkedCueUuid =
    cues['The Bone Tyrant'].uuid;

  project.folderPath = folder;
  const projectFile = path.join(folder, `${project.name}.cuebard`);
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
  return { folder, projectFile, project, cues };
}

// Other projects for the recent list: they must exist on disk, or the
// welcome screen drops them.
function buildRecentProjects(tempDir, version) {
  const day = 24 * 60 * 60 * 1000;
  const others = [
    ['Session 11 · Market day', 1],
    ['One-shot · The Lighthouse', 3],
    ['Session 10 · Into the citadel', 8],
    ['Wedding reception', 30],
  ];
  return others.map(([name, daysAgo]) => {
    const folder = path.join(tempDir, name);
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, `${name}.cuebard`);
    fs.writeFileSync(file, JSON.stringify(emptyProject(name, version), null, 2));
    return { path: file, name, openedAt: new Date(Date.now() - daysAgo * day).toISOString() };
  });
}

// Placeholder pictures, drawn by Chromium in the app's main process
function placeholderSvg(label, background, accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="${background}"/>
  <rect x="60" y="60" width="1480" height="880" fill="none" stroke="${accent}" stroke-width="6" stroke-dasharray="24 16" opacity="0.6"/>
  <circle cx="800" cy="430" r="150" fill="none" stroke="${accent}" stroke-width="10" opacity="0.8"/>
  <text x="800" y="720" text-anchor="middle" font-family="Georgia, serif" font-size="96" fill="${accent}">${label}</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// Chrome DevTools Protocol

class Cdp {
  static async connect(port, pick) {
    const deadline = Date.now() + 60_000;
    for (;;) {
      try {
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const target = targets.find(pick);
        if (target) return new Cdp(await openSocket(target.webSocketDebuggerUrl));
      } catch { /* not up yet */ }
      if (Date.now() > deadline) throw new Error(`No DevTools target on port ${port}`);
      await sleep(500);
    }
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) {
        // Keep the caller's stack: the socket handler's own says nothing
        waiter.callsite.message = `${message.error.message} (${waiter.method})`;
        waiter.reject(waiter.callsite);
      }
      else waiter.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    const callsite = new Error(method);
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method, callsite }));
  }

  // Evaluates an async function body and returns its JSON result. The body
  // runs detached and its outcome is polled: DevTools holds an awaited
  // promise weakly and can report it "collected" before it settles.
  async run(body) {
    const id = `run${this.nextId}`;
    await this.evaluate(`
      globalThis.__screenshotRuns ??= {};
      globalThis.__screenshotRuns[${JSON.stringify(id)}] = { done: false };
      (async () => { ${body} })().then(
        (value) => { globalThis.__screenshotRuns[${JSON.stringify(id)}] = { done: true, value }; },
        (error) => { globalThis.__screenshotRuns[${JSON.stringify(id)}] = { done: true, error: String(error?.stack ?? error) }; },
      );
    `);
    const deadline = Date.now() + 120_000;
    for (;;) {
      if (Date.now() > deadline) throw new Error('A step did not finish within 120 s');
      const outcome = await this.evaluate(`globalThis.__screenshotRuns?.[${JSON.stringify(id)}] ?? { lost: true }`);
      if (outcome.lost) throw new Error('The page reloaded while a step was running');
      if (outcome.done) {
        await this.evaluate(`delete globalThis.__screenshotRuns[${JSON.stringify(id)}]`);
        if (outcome.error) throw new Error(outcome.error);
        return outcome.value;
      }
      await sleep(100);
    }
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => resolve(socket), { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
}

// ---------------------------------------------------------------------------
// Dev app

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* not up yet */ }
    await sleep(1000);
  }
  throw new Error(`${url} did not answer within ${timeoutMs / 1000} s`);
}

function startProcess(command, args, logFile) {
  const child = spawn(command, args, { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const stream = fs.createWriteStream(logFile);
  child.stdout.pipe(stream);
  child.stderr.pipe(stream);
  child.logFile = logFile;
  return child;
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
}

function waitForExit(child, timeoutMs) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(timeoutMs),
  ]);
}

// Where the dev app keeps recent-projects.json: Electron's userData for an
// app named after package.json (no top-level productName, so "cuebard").
function devUserData() {
  const { name, productName } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const appName = productName ?? name;
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', appName);
  if (process.platform === 'win32') return path.join(process.env.APPDATA, appName);
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), appName);
}

// ---------------------------------------------------------------------------
// Steps run in the app

// Renderer helpers, prepended to every renderer evaluation
const RENDERER_PRELUDE = `
  const nuxtApp = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt;
  const state = (key) => nuxtApp.payload.state['$s' + key];
  const use = async (name) => {
    const module = await import('/_nuxt/composables/' + name + '.ts');
    return nuxtApp.runWithContext(() => module[name]());
  };
  const waitFor = async (check, what, timeoutMs = 20000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await check();
      if (value) return value;
      if (Date.now() > deadline) throw new Error('Timed out waiting for ' + what);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  };
  const byText = (selector, text) =>
    [...document.querySelectorAll(selector)].find((el) => el.textContent.trim().includes(text));
  const click = async (selector, text, what) => {
    const el = await waitFor(() => (text ? byText(selector, text) : document.querySelector(selector)), what);
    el.click();
  };
`;

// Main process helpers, prepended to every main evaluation
const MAIN_PRELUDE = `
  const electron = process.mainModule.require('electron');
  const cache = process.mainModule.constructor._cache;
  const loaded = (suffix) => cache[Object.keys(cache).find((f) => f.endsWith(suffix))].exports;
  const appState = loaded('/electron/state.js');
  const mainWindow = appState.getMainWindow();
`;

async function renderPlaceholders(main, project) {
  const jobs = project.visualMedia.map((item) => {
    const [, , background, accent] = IMAGES.find(([name]) => name === item.displayName);
    return {
      svg: placeholderSvg(item.displayName, background, accent),
      out: path.join(project.folderPath, item.mediaPath),
    };
  });
  await main.run(`${MAIN_PRELUDE}
    const fs = process.mainModule.require('fs');
    for (const job of ${JSON.stringify(jobs)}) {
      const win = new electron.BrowserWindow({
        width: 1600, height: 1000, show: false, frame: false, useContentSize: true,
        webPreferences: { offscreen: true },
      });
      win.webContents.setFrameRate(1);
      const painted = new Promise((resolve) => {
        win.webContents.on('paint', (_event, _dirty, image) => {
          const { width, height } = image.getSize();
          if (width === 1600 && height === 1000) resolve(image);
        });
      });
      const html = '<!doctype html><body style="margin:0"><img style="display:block" src="data:image/svg+xml;base64,'
        + Buffer.from(job.svg).toString('base64') + '"></body>';
      await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
      win.webContents.invalidate();
      fs.writeFileSync(job.out, (await painted).toPNG());
      win.destroy();
    }
  `);
}

// Captures a page at 2x and stores it `width` px wide (1440 by default)
async function capture(page, main, tempDir, name, { width = WIDTH } = {}) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const raw = path.join(tempDir, `${name}@2x.png`);
  fs.writeFileSync(raw, Buffer.from(data, 'base64'));
  const out = path.join(OUT, `${name}.png`);
  await main.run(`${MAIN_PRELUDE}
    const fs = process.mainModule.require('fs');
    const image = electron.nativeImage.createFromBuffer(fs.readFileSync(${JSON.stringify(raw)}), { scaleFactor: 1 });
    const resized = image.resize({ width: ${width}, quality: 'best' });
    fs.writeFileSync(${JSON.stringify(out)}, resized.toPNG({ scaleFactor: 1 }));
  `);
  // Size from the PNG header, not from what nativeImage reports
  const png = fs.readFileSync(out);
  const kb = Math.round(png.length / 1024);
  log(`${path.relative(ROOT, out)}  ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}  ${kb} KB`);
}

async function setViewport(page, width = WIDTH, height = HEIGHT) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
}

async function takeScreenshots({ main, page, tempDir, demo, apiPort }) {
  const { projectFile, cues } = demo;
  const trigger = (uuid) => fetch(`http://localhost:${apiPort}/api/trigger/uuid/${uuid}`).then((r) => r.json());

  await setViewport(page);
  await sleep(1500);

  // Welcome screen with the recent list
  await page.run(`${RENDERER_PRELUDE}
    await waitFor(() => document.querySelectorAll('.recent-entry').length >= 4, 'the recent list');
  `);
  await sleep(500);
  await capture(page, main, tempDir, 'welcome');

  // Open the demo project the way a file association does
  await main.run(`${MAIN_PRELUDE}
    mainWindow.webContents.send('open-project-file', { filePath: ${JSON.stringify(projectFile)} });
  `);
  await page.run(`${RENDERER_PRELUDE}
    await waitFor(() => state('currentProject')?.name, 'the project to open');
    // Waveforms are generated by the app on first open
    await waitFor(() => {
      const project = state('currentProject');
      const audio = [...project.items.flatMap((group) => group.children), ...project.cartOnlyItems];
      return audio.every((item) => item.waveform?.peaks?.length);
    }, 'the waveforms', 60000);
    // No player window on screen: the remote viewer is the output we show
    await window.electronAPI.setLocalViewerEnabled(false);
  `);
  await sleep(1000);

  // Audio workspace: one cue playing, another selected
  await trigger(cues['Tavern ambience'].uuid);
  await page.run(`${RENDERER_PRELUDE}
    await click('.playlist-item.is-audio .item-content', 'Skeletons rise', 'the Skeletons rise row');
    await waitFor(() => document.querySelector('.drawer-tabs'), 'the properties drawer');
  `);
  await sleep(8000);
  await capture(page, main, tempDir, 'audio');

  // Properties drawer, Behaviour tab
  await page.run(`${RENDERER_PRELUDE}
    await click('.drawer-tabs .tab-btn', ${JSON.stringify('Behaviour')}, 'the Behaviour tab');
  `);
  await sleep(800);
  await capture(page, main, tempDir, 'properties');

  // Visuals: a published background and a draft layer
  await page.run(`${RENDERER_PRELUDE}
    await click('.drawer-header [aria-label="Close properties"]', null, 'the drawer close button');
    await click('.workspace-switch .switch-btn', 'Visuals', 'the Visuals tab');
    const display = await use('useVisualDisplay');
    const { syncIfReady } = await use('useCompositionActions');
    const media = state('currentProject').visualMedia;
    const find = (name) => media.find((item) => item.displayName === name);
    const background = display.addLayer(find('Citadel map'));
    display.setBackground(background.id, true);
    await syncIfReady();
    const draft = display.addLayer(find('Sealed letter'), { x: 60, y: 10, width: 32, height: 36 });
    display.selectLayer(draft.id);
  `);
  await sleep(2000);
  await capture(page, main, tempDir, 'visuals');

  // Remote viewer page, as a tablet browser shows it, with both layers live
  await page.run(`${RENDERER_PRELUDE}
    const { publishAll } = await use('useCompositionActions');
    publishAll();
    await window.electronAPI.setRemoteViewerEnabled(true);
  `);
  await main.run(`${MAIN_PRELUDE}
    const viewer = new electron.BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, useContentSize: true, show: true });
    await viewer.loadURL('http://localhost:${apiPort}/player');
  `);
  const viewer = await Cdp.connect(PORTS.renderer, (t) => t.type === 'page' && t.url.endsWith('/player'));
  await setViewport(viewer);
  await sleep(2500);
  await capture(viewer, main, tempDir, 'remote-viewer');
  viewer.close();
  await main.run(`${MAIN_PRELUDE}
    for (const win of electron.BrowserWindow.getAllWindows()) {
      if (win.webContents.getURL().endsWith('/player')) win.destroy();
    }
  `);
  await page.run(`${RENDERER_PRELUDE}
    await window.electronAPI.setRemoteViewerEnabled(false);
  `);

  // Minimal mode, at the size the app gives its window
  await page.run(`${RENDERER_PRELUDE}
    await click('.workspace-switch .switch-btn', 'Audio', 'the Audio tab');
  `);
  await trigger(demo.project.cartOnlyItems.find((item) => item.displayName === 'Thunder').uuid);
  await page.send('Emulation.clearDeviceMetricsOverride');
  await main.run(`${MAIN_PRELUDE}
    mainWindow.webContents.send('menu-toggle-minimal-mode');
  `);
  await sleep(2000);
  // Long slot names scroll; hold them still, showing the start of the name
  await page.run(`
    for (const inner of document.querySelectorAll('.slot-name.marquee .slot-name-inner')) {
      inner.style.animation = 'none';
      inner.style.paddingLeft = '0';
    }
  `);
  await sleep(300);
  const minimal = await page.run('return { width: window.innerWidth, height: window.innerHeight };');
  await capture(page, main, tempDir, 'minimal', { width: minimal.width * 2 });
  await main.run(`${MAIN_PRELUDE}
    mainWindow.webContents.send('menu-toggle-minimal-mode');
  `);
  await sleep(1000);
}

// ---------------------------------------------------------------------------

async function main() {
  for (const [what, port] of Object.entries(PORTS)) {
    if (await portInUse(port)) {
      throw new Error(`Port ${port} (${what}) is in use: stop the running dev app or CueBard first`);
    }
  }

  // A short path: the welcome screen shows it under each recent project
  const tempBase = process.platform === 'win32' ? os.tmpdir() : '/tmp';
  const tempDir = fs.mkdtempSync(path.join(tempBase, 'cuebard-demo-'));
  const userData = devUserData();
  const recentFile = path.join(userData, 'recent-projects.json');
  const recentBackup = fs.existsSync(recentFile) ? fs.readFileSync(recentFile) : null;
  let nuxt = null;
  let electron = null;
  let main = null;
  let page = null;
  let savedLocale = null;

  let failed = false;
  try {
    log(`demo project in ${tempDir}`);
    const demo = buildDemoProject(tempDir);
    const others = buildRecentProjects(tempDir, demo.project.schemaVersion);
    // The recent list the welcome screen shows: the demo project first
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(recentFile, JSON.stringify([
      { path: demo.projectFile, name: demo.project.name, openedAt: new Date().toISOString() },
      ...others,
    ], null, 2));

    log('starting Nuxt');
    nuxt = startProcess('npx', ['nuxt', 'dev', '--port', String(PORTS.nuxt)], path.join(tempDir, 'nuxt.log'));
    await waitForHttp(`http://localhost:${PORTS.nuxt}`, 180_000);

    log('starting Electron');
    electron = startProcess('npx', [
      'electron', `--inspect=${PORTS.main}`, '.', `--remote-debugging-port=${PORTS.renderer}`,
    ], path.join(tempDir, 'electron.log'));

    main = await Cdp.connect(PORTS.main, (t) => t.type === 'node');
    await main.send('Runtime.enable');
    const appInfo = await main.run(`
      const electron = process.mainModule.require('electron');
      const deadline = Date.now() + 60000;
      const cache = process.mainModule.constructor._cache;
      const loaded = () => Object.keys(cache).find((f) => f.endsWith('/electron/state.js'));
      while (!(loaded() && cache[loaded()].exports.getMainWindow()
        && cache[loaded()].exports.getApiServerPort())) {
        if (Date.now() > deadline) throw new Error('The main window did not open');
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const appState = cache[loaded()].exports;
      const win = appState.getMainWindow();
      // Keep the demo files out of the system's recent documents
      electron.app.addRecentDocument = () => {};
      win.webContents.closeDevTools();
      win.setContentSize(${WIDTH}, ${HEIGHT});
      win.center();
      return { userData: electron.app.getPath('userData'), apiPort: appState.getApiServerPort() };
    `);
    if (path.resolve(appInfo.userData).toLowerCase() !== path.resolve(userData).toLowerCase()) {
      throw new Error(`The dev app uses ${appInfo.userData}, expected ${userData}`);
    }

    page = await Cdp.connect(PORTS.renderer, (t) => t.type === 'page' && t.url.startsWith(`http://localhost:${PORTS.nuxt}`));
    await page.send('Runtime.enable');
    await page.send('Page.enable');

    // English and Cobalt for the shots; the language is put back afterwards
    savedLocale = await page.run(`
      await new Promise((resolve) => {
        const ready = () => document.querySelector('#__nuxt')?.__vue_app__ ? resolve() : setTimeout(ready, 200);
        ready();
      });
      return { value: localStorage.getItem('liveplay-locale') };
    `);
    await page.run(`localStorage.setItem('liveplay-locale', 'en'); location.reload();`).catch(() => {});
    await sleep(3000);
    await page.run(`
      await new Promise((resolve) => {
        const ready = () => document.querySelector('.welcome-recent') ? resolve() : setTimeout(ready, 200);
        ready();
      });
    `);
    await main.run(`${MAIN_PRELUDE} mainWindow.webContents.send('menu-set-theme', 'cobalt');`);
    // The Nuxt DevTools button is part of the dev server, not of CueBard
    await page.run(`
      const style = document.createElement('style');
      style.textContent = '#nuxt-devtools-container, #nuxt-devtools-anchor { display: none !important; }';
      document.head.appendChild(style);
    `);

    log('rendering placeholder images');
    await renderPlaceholders(main, demo.project);

    fs.mkdirSync(OUT, { recursive: true });
    await takeScreenshots({ main, page, tempDir, demo, apiPort: appInfo.apiPort });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (page) {
      try {
        if (savedLocale) {
          await page.run(savedLocale.value === null
            ? `localStorage.removeItem('liveplay-locale');`
            : `localStorage.setItem('liveplay-locale', ${JSON.stringify(savedLocale.value)});`);
        }
      } catch (error) {
        console.error('[screenshots] could not restore the language:', error.message);
      }
      page.close();
    }
    if (main) {
      try {
        await main.run(`process.mainModule.require('electron').app.quit();`);
      } catch { /* quitting closes the socket */ }
      main.close();
    }
    await waitForExit(electron, 10_000);
    stopProcess(electron);
    stopProcess(nuxt);
    await waitForExit(nuxt, 10_000);

    // On failure, show the end of the app logs before they go with the temp folder
    for (const child of failed ? [nuxt, electron] : []) {
      if (!child?.logFile || !fs.existsSync(child.logFile)) continue;
      const lines = fs.readFileSync(child.logFile, 'utf8').trim().split('\n').slice(-25);
      console.error(`--- ${path.basename(child.logFile)} (last lines)\n${lines.join('\n')}`);
    }
    if (recentBackup === null) fs.rmSync(recentFile, { force: true });
    else fs.writeFileSync(recentFile, recentBackup);
    fs.rmSync(tempDir, { recursive: true, force: true });
    log('dev app stopped, recent projects restored, temp folder removed');
  }
}

main().catch((error) => {
  console.error(`[screenshots] ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
