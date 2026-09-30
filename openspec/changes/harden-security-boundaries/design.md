## Context

Findings come from issue #78 (code review of `dev` @ 88f9deb); line numbers below are from that commit. The HTTP server is one Express app on port 8080 (auto-increments on `EADDRINUSE`), started from `electron/windows.js:70`, serving both the Remote Control API (`electron/api-server.js`, 4 GET routes) and the remote viewer (`electron/remote-viewer.js`, routes `/player`, `/player-renderer.js`, `/player-renderer.css`, `/media?path=<abs>`, `/events`, all behind `remoteViewerGate`). Remote viewer state is session-only (`state.remoteViewerEnabled`, default false, `electron/state.js:21`). Visual media lives in `<project>/media/visuals/<uuid>_<name>`, audio in `<project>/media/`. The Electron player builds `local-media://<abs>` URLs (`electron/player.html:18-19`); the browser viewer builds `/media?path=<abs>` (`electron/player-browser.html:17`). Existing tests: `tests/path-guard.test.ts` (6 cases), `tests/remote-viewer.test.ts` (Express double via `createRequire`, see its header comment for why CJS require is needed).

User decisions (2026-09-30): nothing calls the API from another device today, so the API is loopback-only by default with an opt-in network toggle; `.lpa` import extracts into a new subfolder and never overwrites.

## Decisions

### D1. Navigation and window-open guards on every window
Add `hardenWebContents(win)` in `electron/windows.js` and call it right after each `BrowserWindow` is created (main, state viewer, player). It registers `will-navigate` and `will-redirect` handlers that `preventDefault()` unless the target URL has the same origin as the window's current URL (dev: `http://localhost:3000`; packaged: the `file://` app URL, compare by protocol + path of the app's index), and `setWindowOpenHandler(() => ({ action: 'deny' }))`. Links that must open in the browser already go through `open-external`.
**Why:** `webSecurity: false` (windows.js:25, 382) stays for now, so a navigation to a dropped file or an external page would run with the full preload API.
**Rejected:** removing `webSecurity: false` in this change — audio and images load through `file://` today; replacing that is a separate migration with its own risk.

### D2. Drops outside drop zones do nothing
`app/app.vue` (131-139) already prevents default on `dragenter`/`dragover`; add a document-level `drop` listener that calls `preventDefault()` (bubble phase, so existing drop zones run first). Add the same three listeners in `electron/player-renderer.js` only if it runs in the Electron player; D1 blocks the navigation anyway, so this is belt and braces.

### D3. Small window hardening
- `electron/state.js:32`: `--dev` counts only when `!app.isPackaged`.
- Player window: remove `getPdfjsPath` / `getPdfjsWorkerPath` from `electron/preload-player.js` and their IPC handlers after confirming with grep that nothing calls them (the review found no caller), then set `sandbox: true` (windows.js:380). If something does call them, keep `sandbox: false`, say so in the hand-back, and move on.
- `local-media://` handler (`electron/main.js:71-76`): resolve the requested path with the guard from D6 against the current project; outside or no project → 404 response. Build the file URL with `url.pathToFileURL`. Drop the per-request `console.log`. Remove the `img.onerror` fallback to `file://` in `electron/player-renderer.js` (62-67); it would bypass the guard in the Electron player.

### D4. Remote Control API: loopback by default, no cross-site calls
New pure module `electron/lib/http-guards.js`:
- `isLoopback(remoteAddress)` — true for `127.0.0.1`, `::1`, `::ffff:127.0.0.1`.
- `isCrossSiteBrowserRequest(headers)` — true when `origin` is present, or `sec-fetch-site` is present and not `none`/`same-origin`. curl and scripts send neither header.
- `isAllowedHost(hostHeader, localNames)` — see D5.
- `parseIndexPath(str)` — `'1,0'` → `[1, 0]`; `null` for anything that is not a comma-separated list of non-negative base-10 integers.

In `api-server.js`, one middleware on `/api` rejects with 403 when the request is cross-site (always), or not loopback and `state.getApiNetworkEnabled()` is false. Routes keep GET so the README `curl` examples keep working. `/api/trigger/index/:index` uses `parseIndexPath` → 400 on `null`. `/api/project/info` returns `{ name, itemCount }` (no `path`, no folder). New session-only state `apiNetworkEnabled` (default false) in `state.js`, with IPC `get-api-network-enabled` / `set-api-network-enabled` and preload methods mirroring the remote-viewer ones (`electron/preload.js:161`).
UI: a second toggle "Allow remote control from network" in `app/components/RemoteViewerControl.vue`, under the remote viewer toggle, with one line of help text ("Lets other devices on this network trigger and stop cues. Off by default."). i18n keys in every locale file (English text; Italian in `it.json`).
**Why:** GET routes can be fired by any web page with an `<img>`; nothing uses the API from the network today. Keeping GET avoids breaking the documented examples.
**Rejected:** POST-only (breaks README examples and any Stream Deck "open URL" action); a token (user said nothing on the network calls it; can be added later behind the toggle).

### D5. Host header check on the whole server
One app-level middleware (before both route sets) rejects with 421/403 when `isAllowedHost` is false. Allowed: IPv4/IPv6 literals (with optional port), `localhost`, `os.hostname()` and `os.hostname()` + `.local` (case-insensitive). The QR code uses the LAN IP (`README.md:315`), so the tablet keeps working.
**Why:** DNS rebinding lets a web page reach `127.0.0.1:8080` under its own hostname; the Host check defeats it for both `/api` and `/media`.

### D6. Path guard: realpath, roots, containment by `path.relative`
Rewrite `electron/lib/path-guard.js` `pathIsInProjectFolder(requestedPath, projectPath)` keeping its signature and the "no project → allow" rule (spec `ipc-path-safety`; changing it is out of scope, see "Not touched"):
- resolve the project folder with `fs.realpathSync.native`;
- resolve the requested path with `realpathSync.native` when it exists; when it does not (write targets), realpath its nearest existing ancestor and append the rest;
- contained iff `path.relative(folder, target)` is `''` or does not start with `..` and is not absolute; compare case-insensitively on `win32` and `darwin`.
Add `pathIsInFolder(requestedPath, folder)` for callers that need a sub-folder root (D7). Return value stays the resolved path or `null`.
Apply the guard (current project from `state`) to: `read-visual-media`, `delete-visual-media` (`electron/ipc/player.js:78-104`), `import-visual-media` destination (`:50-75`; also validate `uuid` against `/^[0-9a-f-]{8,36}$/i`), `generate-waveform` input and output (`electron/media/waveform.js:16-19`), `export-project` source folder must equal the current project folder (`electron/ipc/project.js:18-98`).
**Why:** the lexical check is escaped by a symlink inside the project; a project at `/` or `C:\` builds a `//` prefix and rejects everything; the listed handlers allowed arbitrary read and delete.

### D7. `/media` serves only `media/`, by relative path
- `broadcastDisplayState` (`remote-viewer.js:48`) sends remote viewers a copy of the state where each layer's `mediaPath` is relative to the project folder with `/` separators. The Electron player IPC path is unchanged (spec: local player unaffected).
- `player-browser.html:17` `mediaUrl` passes the relative path through: `'/media?path=' + encodeURIComponent(rel)`.
- `/media` (`remote-viewer.js:77-98`) resolves `path` against the project folder, then requires `pathIsInFolder(resolved, <project>/media)`; rejects absolute input; serves only extensions in `electron/lib/mime.js` (anything that maps to `application/octet-stream` → 403); sets `X-Content-Type-Options: nosniff` and, for `.svg`, `Content-Security-Policy: sandbox`. Keep `createReadStream`; add a stream `error` handler that ends the response.
- Update the remote-viewer spec scenario that said `mediaPath` is absolute.
**Why:** a project saved directly in `~/Documents` exposed all of `~/Documents`; absolute paths also leak the username to tablets.

### D8. Shell handlers
`open-folder` (`electron/ipc/files.js:122-124`): `fs.promises.stat`; only `isDirectory()` → `shell.openPath`; else return `{ success: false }`. `open-external` (`:132-134`): only `http:`, `https:` and `mailto:` URLs (mailto needed by the About modal contributor link, `AboutModal.vue:122`, which now routes through `open-external` instead of `window.location.href`) (pure `isSafeExternalUrl(url)` in `http-guards.js`). Check the renderer callers still work (grep `openFolder`, `openExternal` in `app/`).

### D9. `.lpa` extraction
New `electron/lib/extract-archive.js` using `yauzl` (add as a direct dependency at the version already in `package-lock.json`, 2.10.0; remove `extract-zip`). `extractArchive(archivePath, targetDir, { onProgress, maxTotalBytes })`:
- skip entries that are not regular files or directories (symlinks detected from `externalFileAttributes >>> 16` mode bits `0o170000 === 0o120000`);
- reject (abort, delete what was written) any entry whose name is absolute, contains a drive letter, or resolves outside `targetDir`;
- abort when the running uncompressed total exceeds `maxTotalBytes` = `max(20 × archive size, 1 GiB)`;
- create files with `flags: 'wx'` (never overwrite).
`import-project` and `import-lpa-file` (`electron/ipc/project.js:101-243`) share one function: target is `<chosen folder>/<archive basename without .lpa>`; if it exists, show an error dialog ("A folder named X already exists here. Choose another location.") and stop. Progress events keep their current shape.
**Why:** `extract-zip` recreates symlink entries (two advisories, no fix) and writes over existing files; the duplicated handler is ~60 lines.

## Shared files with the #76 change

`fix-project-data-integrity` (#76) is built in parallel on `fix/data-integrity`. Both touch:
- `electron/main.js`: #76 changes only the `.liveplay` branch of `openFile` (payload becomes `{ filePath }`). This change edits the `local-media://` handler. Do not touch `openFile`.
- `electron/windows.js`: #76 adds a main-window `close` flush handshake. This change adds `hardenWebContents` calls and the player `sandbox` flag. Keep your additions in their own blocks.
- `electron/ipc/files.js`: #76 adds a `noOverwrite` option inside `copy-file`. This change edits `open-folder`, `open-external` and guard usage. Do not move, rename or reformat handlers you are not changing.
Whichever PR merges second rebases on `dev` and resolves by keeping both.

## Not touched

- yt-dlp download handler and binary management (review M5, M6): separate follow-up change; issue #78 stays open for them.
- "Main owns the project path" (the renderer can still call `setCurrentProject(null)` and widen the guard): renderer drag-and-drop import passes source paths the main process never saw, so this needs its own design. Tracked in #78.
- Removing `webSecurity: false`, IPC sender checks, SSE heartbeat/backpressure (#82), `findItemByIndex` robustness (#82).

## Risks

- **Remote viewer breaks on the tablet.** Any change here that stops images loading on a phone/tablet via the QR URL is a regression of a shipped feature: stop and report. Test with a real second device or at least a browser on another machine using the LAN IP.
- **Navigation guard blocks the dev server's HMR reload or Nuxt route changes.** If `just dev` stops hot-reloading or in-app navigation breaks, report the URL that was blocked; do not widen the rule to "allow all http".
- **Case-insensitive compare** on darwin assumes the default case-insensitive APFS; acceptable, note it in a code comment.
- **`realpathSync.native` on a path with a missing ancestor chain up to the root** must not throw; cover it in tests.
