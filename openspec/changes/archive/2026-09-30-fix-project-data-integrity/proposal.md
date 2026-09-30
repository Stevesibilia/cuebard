## Why

A code review of `dev` @ 88f9deb (issue #76) found a cluster of bugs that lose edits, corrupt the `.liveplay` file, or change project content the operator did not touch: a group can be dropped into its own sub-group (the tree becomes cyclic and every later save fails silently), new cues share nested default objects (editing one cue edits every cue imported that session), several edits never trigger a save, a quick quit loses the last edit, opening a project by double-click bypasses the normal open path, files from upstream LivePlay 2.5 crash on open, and several media/visual paths overwrite or reset user data.

## What Changes

- Playlist tree moves SHALL refuse a drop onto the dragged item itself or any of its descendants, and SHALL move a group together with its selected children exactly once.
- New audio, cart and group items SHALL be built from factories that return independent nested objects.
- Every structural edit (add, remove, expand/collapse) SHALL schedule a save; the save debounce SHALL be shared across all components; Ctrl+S SHALL save immediately; closing the main window or quitting SHALL flush a pending save before the window closes.
- Opening a `.liveplay` by file association SHALL go through the same `openProject(filePath)` path as File > Open.
- Loading SHALL default missing top-level fields (`theme`, `cartItems`, `cartOnlyItems`, `visualDisplayEnabled`) and SHALL refuse a file whose `schemaVersion` is newer than this build, instead of stamping it down.
- Importing a media file whose name already exists in `media/` SHALL keep both files.
- Saved `.liveplay` files SHALL NOT contain waveform peak data; peaks are read from `waveforms/`.
- A late-arriving waveform SHALL NOT overwrite a trimmed out-point.
- Cart "push" reorder SHALL never move a cue beyond the last slot.
- Closing or switching projects SHALL clear visual layers and blank the player outputs; returning to the Media tab SHALL NOT re-fit layers or push to the player.

## Capabilities

### New Capabilities
- `project-persistence`: when and how the project is written, flushed and opened; media import naming; what the file contains.
- `playlist-editing`: structural rules for moving items in the playlist tree and the cart grid.

### Modified Capabilities
- `project-schema-versioning`: newer-version refusal and load-time defaults for missing fields.
- `layer-display`: layers cleared on project close/switch; auto-fit happens once per layer and never for backgrounds.

## Impact

- Renderer: `app/composables/useProject.ts`, `app/types/project.ts`, `app/utils/migrations.ts`, new `app/utils/tree.ts`, `app/utils/cart.ts`, `app/utils/projectSerialize.ts`, `app/components/PlaylistItem.vue`, `PlaylistView.vue`, `CartSlot.vue`, `YouTubeImportModal.vue`, `LiveDisplayPanel.vue`, `app/composables/useVisualDisplay.ts`, `useMenuListeners.ts`, `app/app.vue`, `app/types/ipc.ts`, `app/types/global.d.ts` (or wherever `electronAPI` is typed), locale files.
- Main: `electron/main.js` (`openFile` payload), `electron/windows.js` (main-window close flush handshake), `electron/ipc/files.js` (`copy-file` no-overwrite option), `electron/preload.js`.
- File format: no schema bump. Files get smaller (no peaks). No migration needed.
- Runs in parallel with the security change for #78 (`harden-security-boundaries`), which also edits `electron/main.js`, `electron/windows.js` and `electron/ipc/files.js`; see design "Shared files with the #78 change".
