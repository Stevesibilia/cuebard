## Why

The dev code review (issue #78) found that the app's security boundaries are weaker than the specs and README say. The Remote Control API answers anyone on the LAN and any web page the operator opens; `/media` serves the whole folder that holds the `.liveplay` (not just `media/`), follows symlinks and ignores the Host header; `.lpa` import recreates symlinks and overwrites files; several filesystem IPC handlers skip the path guard and `open-folder`/`open-external` accept anything; and no window has a navigation guard, so a file dropped outside a drop zone can replace the live UI while keeping the full `electronAPI`. No renderer injection sink was found, so most of this is defence in depth, but E-LivePlay runs on the same laptop as the operator's browser and on shared Wi-Fi at the table.

## What Changes

- Every window SHALL refuse navigation away from the app and refuse opening new windows; a file dropped anywhere outside a drop zone SHALL do nothing. `--dev` SHALL be ignored in packaged builds. The player window SHALL be sandboxed. `local-media://` SHALL serve only files inside the current project folder.
- The Remote Control API (`/api/*`) SHALL answer only loopback clients unless the operator enables "Allow remote control from network" (off by default, per session). Requests that a browser sends on behalf of another web page SHALL be refused. `/api/project/info` SHALL no longer return absolute paths. Index parameters SHALL be validated.
- All HTTP routes SHALL check the Host header (DNS-rebinding defence).
- `/media` SHALL serve only files inside the project's `media/` folder, after resolving symlinks, and only the visual media types the player displays; the SSE display state sent to remote viewers SHALL use project-relative paths.
- The path guard SHALL resolve symlinks, handle a project at a filesystem root, and be applied to the visual-media, waveform and export handlers. `open-folder` SHALL open only existing directories; `open-external` SHALL open only `http:`/`https:` URLs.
- `.lpa` import SHALL use an extractor that skips non-regular entries, rejects entries escaping the target, caps the uncompressed size, and extracts into a new subfolder named after the archive; `extract-zip` is removed.

## Capabilities

### New Capabilities
- `remote-control-api`: who may call `/api/*`, and what it returns.
- `window-navigation-safety`: navigation, new-window, drop, dev-flag and custom-protocol rules for the app's windows.
- `project-archive-import`: how an `.lpa` archive is extracted.

### Modified Capabilities
- `remote-viewer`: `/media` confined to `media/` with symlink resolution and a type allow-list; relative paths in the SSE state; Host check.
- `ipc-path-safety`: symlink-resolving guard, filesystem-root case, more handlers guarded, shell handlers restricted.

## Impact

- Main: `electron/windows.js`, `electron/main.js` (`local-media://` handler), `electron/state.js`, `electron/api-server.js`, `electron/remote-viewer.js`, `electron/lib/path-guard.js`, new `electron/lib/extract-archive.js`, new `electron/lib/http-guards.js`, `electron/ipc/files.js`, `electron/ipc/player.js`, `electron/ipc/project.js`, `electron/media/waveform.js`, `electron/preload.js`, `electron/preload-player.js`, `electron/player-browser.html`.
- Renderer: `app/app.vue` (global drop), `app/components/RemoteViewerControl.vue` (network API toggle), `app/types/global.d.ts`, locale files.
- Dependencies: remove `extract-zip`; add `yauzl` as a direct dependency.
- Docs: README "Remote Control API" and "Remote Viewer" security notes.
- Out: yt-dlp (M5/M6 of the review) goes to a follow-up change; see design.
- Built in parallel with `fix-project-data-integrity` (#76), which also edits `electron/main.js`, `electron/windows.js`, `electron/ipc/files.js`; see design "Shared files with the #76 change".
