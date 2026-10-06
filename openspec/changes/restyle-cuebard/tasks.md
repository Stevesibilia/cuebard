## 1. Step 1, foundation (wave 1, `feat/restyle-1-foundation`)

- [x] 1.1 Tokens in `main.scss` per D1, including the aliases for the undefined variables; body font per D1
- [x] 1.2 Fonts per D3: dev dependencies, imports in `nuxt.config.ts`, remove Inter, `app/assets/fonts/`, `public/assets/styles/`; lockfile regenerated on Linux
- [x] 1.3 Locale sections per D2 in `en.json` and `it.json`
- [x] 1.4 Header per D4 (`ProjectHeader.vue`)
- [x] 1.5 Verify per D12; tick the step 1 lines of `coverage.md`

## 2. Step 2, now-playing strip, toolbar, search (wave 2, `feat/restyle-2-toolbar`)

- [x] 2.1 `usePlaylistActions.ts` with the import logic moved unchanged; `PlaylistView` header removed; YouTube dialog mounted in `MainWorkspace`
- [x] 2.2 Toolbar row per D6 in `MainWorkspace.vue` (Audio side; leave a slot for the Visuals actions of step 5)
- [x] 2.3 Search per D6 (`usePlaylistFilter.ts`, filtering in `PlaylistView`/`PlaylistItem` only), "N of M cues · Clear" line
- [x] 2.4 Strip per D5 (`PlaybackControls.vue`, `ActiveCueItem.vue`, `VUMeter.vue` on meter tokens)
- [x] 2.5 Strings into `strip` and `toolbar`
- [x] 2.6 Verify per D12; tick the step 2 lines of `coverage.md`

## 3. Step 4, properties drawer (wave 2, parallel with step 2, `feat/restyle-4-properties`)

- [x] 3.1 Drawer shell per D7: header, tabs (Playback/Behaviour/Details; groups Behaviour/Details), height `var(--size-drawer)`
- [x] 3.2 Playback tab: `WaveformTrimmer.vue` re-laid per D7, canvas colours from tokens (re-read on theme change), playhead fix
- [x] 3.3 Behaviour tab with CuePicker targets (`includeGroups`), missing-target state, index fields
- [x] 3.4 Details tab
- [x] 3.5 `CuePicker.vue`: `includeGroups`, dialog style, strings into `drawer`
- [x] 3.6 Multi-selection logic untouched; strings into `drawer`
- [x] 3.7 Verify per D12 (single cue, group, cart-only cue, multi-selection); tick the step 4 lines of `coverage.md`

## 4. Step 3, playlist rows and cart (wave 3, `feat/restyle-3-playlist-cart`)

- [x] 4.1 Rows per D8 (`PlaylistItem.vue`), group headers with count and total length, "Space" chip
- [x] 4.2 Cart per D8 (`CartPlayer.vue`, `CartSlot.vue`), splitter handle
- [x] 4.3 Strings into `rows` and `cartUi` (behaviour titles, "Cart Player", "New Group" is step 2's and stays)
- [x] 4.4 Verify per D12 (drag and drop in all directions, cart push, cart-only import); tick the step 3 lines of `coverage.md`

## 5. Step 5, visuals (wave 3, parallel with step 3, `feat/restyle-5-visuals`)

- [x] 5.1 Media pane layout per D9 in `MainWorkspace.vue`: one column, collapse toggle in the toolbar, splitter removed
- [x] 5.2 Library and folders in the column (`MediaLibraryPanel.vue`, `MediaLibraryItem.vue`)
- [x] 5.3 Visual properties in the column (`VisualPropertiesPane.vue`), back to library
- [x] 5.4 Toolbar right side: layer count, Publish all, Black, Viewer; `LiveDisplayPanel` header removed; canvas fills; layer bar as a row
- [x] 5.5 `RemoteViewerControl.vue` popover restyled and anchored to the toolbar
- [x] 5.6 Strings into `visuals`
- [x] 5.7 Verify per D12 (folders, drag to folder and canvas, publish with link delay, background, Black, viewer toggles); tick the step 5 lines of `coverage.md`

## 6. Step 6, welcome, recent projects, minimal mode, dialogs (wave 4, `feat/restyle-6-welcome`)

- [ ] 6.1 Recent projects IPC, preload, types, `useRecentProjects.ts`, recording in `useProject.ts`; unit tests for the list logic (dedupe, cap 8, prune missing) on a pure helper in `electron/lib/recent-projects.js`
- [ ] 6.2 Welcome per D10 with the recent list; name prompt styles
- [ ] 6.3 Minimal mode per D10
- [ ] 6.4 Dialogs, toasts and accent picker per D10
- [ ] 6.5 Strings into `recent`, `dialogs`, `minimal`
- [ ] 6.6 Verify per D12; tick the step 6 lines of `coverage.md`
- [ ] 6.7 Cleanup: remove the unused layout variables from `main.scss` and correct its meter-token comments; remove locale keys used nowhere in `app/` or `electron/` from all 21 locale files; correct the fonts in `guides/DEVELOP.md`

## 7. Release 2.1.0 (architect)

- [ ] 7.1 `release/v2.1.0` into `dev`
- [ ] 7.2 Owner approves; PR `dev` → `main` "Release v2.1.0", merge commit; check the release

## 8. Step 7, README and screenshots (wave 5, `docs/readme-screenshots`)

- [ ] 8.1 `scripts/take-screenshots.mjs` per D11
- [ ] 8.2 Screenshots in `docs/screenshots/`; `public/screenshots/` removed
- [ ] 8.3 README rewritten per D11; Markdown formatter run
- [ ] 8.4 Verify: script runs from a clean checkout; README renders on GitHub (links and images)
