## Context

Findings come from issue #76 (code review of `dev` @ 88f9deb). Line numbers below are from that commit. The renderer keeps the project in `useState('currentProject')` and writes it through `window.electronAPI.writeFile` as pretty-printed JSON. Tests run with `npx vitest run`; `vitest.config.ts` has no DOM environment and existing tests only import pure utilities (`tests/migrations.test.ts` imports `app/utils/migrations`). So every rule this change adds is put in a pure function under `app/utils/` (or `electron/lib/`) and tested there; components and composables only call it.

## Decisions

### D1. Tree moves go through a pure `app/utils/tree.ts`
`PlaylistItem.vue` `handleDrop` (592-682) only refuses a drop onto one of the dragged items themselves (`itemsToMove.includes(props.item.uuid)`), not onto their descendants. Add:
- `findPathToUuid(items, uuid): (AudioItem|GroupItem)[] | null` — the chain of ancestors ending at the item.
- `isSelfOrDescendant(items, ancestorUuid, uuid): boolean`.
- `normalizeMoveSet(items, uuids): string[]` — drops any uuid whose ancestor is also in the set; keeps the tree order of the remaining ones (built: so a multi-selection picked out of order now drops in tree order, not selection order).
- `canDropOnto(items, movingUuids, targetUuid): boolean` — false when the target is any moving item or inside one.

`handleDrop` calls `normalizeMoveSet` first, then returns early (no mutation) when `canDropOnto` is false. The rest of the handler stays as is.
**Why:** the cycle makes `JSON.stringify` throw inside `saveProjectImmediate`, which swallows the error, so every later save fails silently. Normalising the move set also fixes the duplicate-child case (group dragged with its own child). Pure functions are testable without a DOM.
**Rejected:** a guard in `removeItem`/`addItem` — the bad insert happens through a direct `splice` in the handler, not through those helpers.

### D2. Default items come from factories
In `app/types/project.ts` (260-288) replace `DEFAULT_AUDIO_ITEM`, `DEFAULT_CART_AUDIO_ITEM` and `DEFAULT_GROUP_ITEM` with `createDefaultAudioItem()`, `createDefaultCartAudioItem()`, `createDefaultGroupItem()`. Each returns `structuredClone` of a module-private template. Remove the three exported constants so nothing can spread them again. Update every caller: `PlaylistView.vue:87`, `YouTubeImportModal.vue:240`, `CartSlot.vue:270`, and wherever `DEFAULT_GROUP_ITEM` is used (grep). Also check `DEFAULT_GLOBAL_KEY_BINDINGS` (144-150) and `DEFAULT_CART_SLOT_KEYS`: if a caller copies them into a project and later mutates an element in place, give them a factory too; if not, leave them.
**Why:** `{ ...DEFAULT_X }` copies one level, so `endBehavior`, `startBehavior`, `duckingBehavior`, `customActions` are shared, and `PropertiesPanel.vue` (118, 266, 322, 368) mutates them in place.
**Rejected:** changing `PropertiesPanel` to replace objects instead of mutating — it is many call sites and does not protect the next caller that mutates.

### D3. Structural edits save themselves
`addItem` (useProject.ts:387) and `removeItem` (405) call the debounced `saveProject()` at the end. `toggleExpand` (PlaylistItem.vue:543) calls `saveProject()` too (`isExpanded` is persisted). Existing explicit `saveProject()` calls after these helpers stay; the debounce collapses them.
**Why:** import (PlaylistView:101, 233), add group, delete (PlaylistItem:539) and expand never saved. Saving inside the primitives covers every present and future caller. All handler code is synchronous, so a debounced save scheduled mid-operation fires after the operation completes.

### D4. One save timer; Ctrl+S saves now; close flushes
- Move `saveTimeout` (useProject.ts:330) to module scope, outside `useProject()`, so `saveProject`, `flushPendingSave` and the `beforeunload` handler all see the same timer.
- The `menu-save-project` listener (menu.js:104 sends it; find the renderer handler) calls a new `saveNow()` = clear pending timer + `await saveProjectImmediate()`.
- Close handshake. In `electron/windows.js`, the main window gets a `close` listener: unless `state` says the flush is done, `event.preventDefault()`, send `app-before-close` to the renderer, wait for `ipcMain.once('renderer-flushed')` or 3000 ms, whichever comes first, mark done, then `mainWindow.close()` again. If a quit was under way (tracked with `app.on('before-quit')`), call `app.quit()` instead, so Cmd+Q still quits on macOS instead of leaving the app windowless. Reset the flag when a new main window is created (macOS re-open). Preload exposes `onBeforeClose(cb)` and `notifyFlushed()`; the renderer registers the listener once at app level (next to the other menu listeners in `useMenuListeners.ts`), awaits `flushPendingSave()`, then calls `notifyFlushed()`. Keep the existing `beforeunload` handler as a fallback.
**Why:** `beforeunload` cannot wait for an async IPC write, so a quit within 500 ms of an edit loses it. The timeout keeps a hung renderer from blocking quit.
**Rejected:** a synchronous IPC write (`sendSync`) in `beforeunload` — it blocks the UI thread and still depends on Chromium running the handler.

### D5. File-association open goes through `openProject`
`electron/main.js` `openFile` (121-145): for `.liveplay`, stop reading and parsing the file; send `open-project-file` with `{ filePath }` only. In `useMenuListeners.ts` (73-80) the listener does: if a project is open, `await closeProject()`; then `const ok = await openProject(filePath)`; on `false` show nothing (openProject already did). Update the `onOpenProjectFile` payload type.
**Why:** assigning the raw JSON skips validation, migrations and `folderPath`, never tells main which project is open (Export disabled, remote viewer `/media` 404, path guard scoped to the previous project), and skips cart-only items and waveforms.

### D6. Load-time defaults for missing fields
Add `normalizeProject(project)` to `app/utils/migrations.ts`, called by `openProject` after `runMigrations` on every load. It sets, only when absent: `theme` = copy of `DEFAULT_THEME`, `cartItems` = `[]`, `cartOnlyItems` = `[]`, `visualDisplayEnabled` = `true` (move the existing default from useProject.ts:171-173 into it). Also make the reads defensive: `app/app.vue:107` (and `:82`), `useMenuListeners.ts:35` use `project.theme?.mode ?? DEFAULT_THEME.mode`.
**Why:** upstream LivePlay 2.5 drops `theme` on save; the fork then throws in `app.vue`. These are additive optional fields, so no schema bump (same reasoning as the existing `visualDisplayEnabled` default).

### D7. Refuse files from a newer schema
Add `checkSchemaCompat(parsed): { ok: true } | { ok: false, fileVersion: number }` to `migrations.ts`. `openProject` calls it before `runMigrations`. `openProject` shows its own error for every failure (the existing "Failed to open project" text for read/JSON/validation failures, moved from `WelcomeScreen.vue:75`; for a newer schema: "This project was saved by a newer version of E-LivePlay. Update the app to open it."), then returns `false`; callers show nothing. (new i18n key `project.newerVersion`, English text in every locale file, Italian translated in `it.json`). `runMigrations` must never lower `schemaVersion` (guard: only assign when higher).
**Why:** stamping the version down while keeping newer fields makes the next newer build skip migrations it needs. Steve syncs projects across hosts, so a host behind on updates must not silently rewrite the file.
**Rejected:** read-only open — there is no read-only mode today and it would need guarding every save path.

### D8. Media import never overwrites
`electron/ipc/files.js` `copy-file` (95-109) gets an optional third argument `{ noOverwrite: true }`. With it, the handler copies with `fs.promises.copyFile(src, dest, fs.constants.COPYFILE_EXCL)`; on `EEXIST` it retries with `name (2).ext`, `name (3).ext`, … (built: the loop is `copyFileNoOverwrite(src, dest)` next to `nextFreeName(baseName, n)` in `electron/lib/free-name.js`, tested against a real temp directory; the handler calls it), and returns `{ success, destPath }` with the path actually written. Renderer audio import in `PlaylistView.vue` (71-76) and `CartSlot.vue` (246-250) passes the option and stores the returned file name as `mediaFileName`. Visual media already prefixes a uuid (`electron/ipc/player.js:57`) and YouTube import names files in yt-dlp; neither changes here.
**Why:** `COPYFILE_EXCL` is atomic, so there is no check-then-copy race. The path guard on `copy-file` stays exactly as it is.

### D9. Peaks stay out of the project file
Add `serializeProject(project): string` in `app/utils/projectSerialize.ts`: `JSON.stringify(project, replacer, 2)` where the replacer returns `undefined` for the key `waveform` (only that exact key; `waveformPath` stays). `saveProjectImmediate` (304-327) uses it. `loadWaveformsAsync` (223-266) loads from `waveforms/` or regenerates when `waveform` is missing, but only for `project.items`; extend it to `project.cartOnlyItems`, which until now relied on inline peaks (their only other load path, the `CartSlot.vue` poll, never regenerates).
**Why:** peaks are duplicated in `waveforms/*.json`; inline they make each save several MB on the UI thread and each sync upload large.

### D10. Waveform arrival keeps the trim
At every waveform-arrival site (built: five, not three — PlaylistView.vue 135 and 176, PlaylistItem.vue 364, CartSlot.vue 345 and 590; all had the same overwrite), replace the unconditional `outPoint = duration` with a pure helper `outPointAfterDuration(currentOutPoint, previousDuration, newDuration)` (in `app/utils/`): return `newDuration` when `currentOutPoint` is null/undefined/≤0 or equals `previousDuration` (untrimmed), else keep `currentOutPoint` (clamped to `newDuration`).
**Why:** the user may trim before the waveform finishes; the current code wipes that trim.

### D11. Cart push stays inside the grid
Extract the push logic at CartSlot.vue:673-691 into `planCartPush(occupiedSlots: number[], targetSlot: number, slotCount = 16): Map<number, number> | null` in `app/utils/cart.ts`. It shifts only the contiguous run of occupied slots starting at `targetSlot` up by one, stopping at the first empty slot; returns `null` when there is no empty slot before `slotCount`. `null` means the drop is a no-op. Slot count 16 comes from `CartPlayer.vue:14`; export a `CART_SLOT_COUNT = 16` constant and use it in both places.
**Why:** the current loop shifts every slot ≥ target, pushing slot 15 to an unreachable 16 even when there were gaps.

### D12. Visual layers cleared on close and open
`closeProject` (useProject.ts:363) and the start of `openProject` call `useVisualDisplay().clearAll()` and push an empty display state to the player and remote viewers through the same function `LiveDisplayPanel` uses to sync (`syncToPlayer` with an empty published state; find the exact export).
**Why:** `clearAll` is never called, so old layers resolve against the new project's folder and outputs keep showing the previous project.

### D13. Auto-fit once, never for backgrounds
Add optional `fitted?: boolean` to `DisplayLayer` (`app/types/ipc.ts:59-73`). In `LiveDisplayPanel.vue` `onImageLoad` (227-253) skip when `layer.fitted || layer.isBackground`; after fitting set `fitted: true` via `updateLayer`. Remove the component-local `autoFitted` set (169). Only call `syncIfReady()` when a fit actually changed the box.
**Why:** `autoFitted` dies with the component (`v-if` on the tab), so every return to the Media tab re-fits every layer, including the full-screen background, and pushes it live. Layers live in `useVisualDisplay` state, so a flag on the layer survives the tab switch.

## Shared files with the #78 change

`harden-security-boundaries` (#78) is built in parallel on `fix/security-hardening`. Both touch:
- `electron/main.js`: this change edits only the `.liveplay` branch of `openFile` (payload becomes `{ filePath }`). #78 edits the `local-media://` handler and may add a line in `openFile`. Do not restructure `openFile` beyond the payload.
- `electron/windows.js`: this change adds the main-window `close` handshake. #78 adds navigation guards after window creation and changes `webPreferences`. Keep the handshake in its own listener block.
- `electron/ipc/files.js`: this change adds the `noOverwrite` option inside `copy-file`. #78 changes `open-folder`, `open-external` and the guard helper. Do not move or rename handlers.
Whichever PR merges second rebases on `dev` and resolves by keeping both.

## Not touched

- Audio engine lifecycle (`useAudioEngine.ts`), hotkeys, MIDI, IPC listener cleanup: issue #77.
- Path guard, API server, remote viewer, `.lpa` import: issue #78.
- `findItemByIndex` robustness, `createNewProject` ordering: issue #82.
- `PropertiesPanel.vue` in-place mutation style (made harmless by D2).

## Risks

- **Close handshake blocks quit.** If the window does not close within ~3 s of Cmd+Q in testing, the timeout path is broken: report it, do not remove the handshake.
- **`structuredClone` on a Vue proxy throws** (`DataCloneError`). Templates are plain module objects, so it should not happen; if it does, a caller is passing reactive state into a factory: report which.
- **Removing `waveform` from the file** breaks a project whose `waveforms/` folder is missing only if regeneration fails (no ffmpeg). The smoke test covers a project with its `waveforms/` folder deleted.
- **i18n**: the new key must exist in every locale file; the current `t()` has no English fallback (#79), so a missing key shows raw.
