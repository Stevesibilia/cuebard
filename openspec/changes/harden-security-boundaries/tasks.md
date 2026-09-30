Each numbered group is one commit. Every commit leaves `npx vitest run` green. Commit messages: Conventional Commits, no issue references, trailers exactly as in the brief.

## 1. Windows (D1, D2, D3)

- [x] 1.1 `hardenWebContents(win)` in `electron/windows.js`, called for main, state-viewer and player windows
- [x] 1.2 Global `drop` preventDefault in `app/app.vue`; same in the Electron player if applicable
- [x] 1.3 `--dev` ignored when packaged (`electron/state.js`)
- [x] 1.4 Remove unused pdfjs getters from `preload-player.js` and their handlers; `sandbox: true` on the player (or report why not)
- [x] 1.5 Tests: pure same-origin check used by `hardenWebContents` (extract it to `electron/lib/` so it is testable)

## 2. Path guard and filesystem handlers (D6, D8, and `local-media://` from D3)

- [x] 2.1 Rewrite `pathIsInProjectFolder` (realpath, nearest existing ancestor, `path.relative` containment, case-insensitive on win32/darwin); add `pathIsInFolder`
- [x] 2.2 Guard `read-visual-media`, `delete-visual-media`, `import-visual-media` (+ uuid check), `generate-waveform`, `export-project`
- [x] 2.3 Guard `local-media://`; `pathToFileURL`; drop the log
- [x] 2.4 `open-folder` directories only; `open-external` http/https only (`isSafeExternalUrl`)
- [x] 2.5 Tests in `tests/path-guard.test.ts`: symlink inside the project pointing outside → null (create a temp dir with `fs.mkdtempSync` and a real symlink); project at filesystem root; non-existent write target inside/outside; existing 6 cases still pass. `isSafeExternalUrl` cases (`https:`, `mailto:` ok; `file:`, `smb:`, `javascript:` refused)

## 3. HTTP server (D4, D5, D7)

- [ ] 3.1 `electron/lib/http-guards.js` (`isLoopback`, `isCrossSiteBrowserRequest`, `isAllowedHost`, `parseIndexPath`, `isSafeExternalUrl` if not placed elsewhere)
- [ ] 3.2 App-level Host middleware; `/api` middleware (cross-site always 403; non-loopback 403 unless `apiNetworkEnabled`); `parseIndexPath`; `/api/project/info` → `{ name, itemCount }`
- [ ] 3.3 `apiNetworkEnabled` state + IPC + preload + types; toggle in `RemoteViewerControl.vue` with help text; i18n keys in every locale (Italian in `it.json`)
- [ ] 3.4 `/media`: relative path only, `media/` root via `pathIsInFolder`, type allow-list, `nosniff`, svg CSP sandbox, stream error handler; `broadcastDisplayState` sends relative paths; `player-browser.html` `mediaUrl` uses them
- [ ] 3.5 Tests: `tests/http-guards.test.ts` (every function, including IPv6-mapped loopback, `Host: evil.example` refused, `Host: 192.168.1.42:8080` allowed, `parseIndexPath('-1')`/`'1,x'` null); extend `tests/remote-viewer.test.ts`: file outside `media/` 403, disallowed type 403, relative-path rewrite in broadcast; an api-server test for the loopback/cross-site middleware using the same Express double pattern
- [ ] 3.6 README: Remote Control API section says loopback by default and names the toggle; Remote Viewer security note says media is limited to the project's `media/` folder

## 4. Archive import (D9)

- [ ] 4.1 `electron/lib/extract-archive.js` with yauzl; `package.json`: remove `extract-zip`, add `yauzl`; `npm install` only to update the lockfile for these two changes, then verify `npm ci` works
- [ ] 4.2 One shared import function for `import-project` and `import-lpa-file`; subfolder target; exists → error dialog
- [ ] 4.3 Tests `tests/extract-archive.test.ts`: build fixture zips at test time with `archiver` (already a dependency) — normal files extract; a symlink entry (`archive.symlink`) is skipped; an entry named `../evil.txt` aborts and leaves no files; the size cap aborts; an existing file is never overwritten

## 5. Verify and hand back

- [ ] 5.1 `npx vitest run` — paste the summary line
- [ ] 5.2 `npm audit --omit=dev` before and after — paste the two summary lines (extract-zip advisories should be gone)
- [ ] 5.3 `just dev` smoke per the brief's checklist; pass/fail per line
- [ ] 5.4 Push `fix/security-hardening` to `fork`, hand back to the architect. Do not open the PR.
