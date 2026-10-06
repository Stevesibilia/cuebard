## Context

- Approved mockups: `mockups/Main.dc.html` (Audio workspace), `mockups/PropsTabs.dc.html` (Behaviour and Details tabs), `mockups/Visuals.dc.html` (Visuals workspace, interactive), `mockups/Welcome.dc.html`, `mockups/Tokens.dc.html` (tokens and components). They are HTML with inline styles: read them for exact sizes, colours and order. Ignore `support.js`, `<x-dc>`, `<sc-for>`, `<sc-if>` and the `renderVals()` script; they belong to the mockup tool. Sample names in them ("Session 12", "Tavern ambience") are placeholders.
- `coverage.md` lists every feature of 2.0.0 with the step that keeps it. Nothing in it may disappear.
- Styling today (facts from exploration, 2026-10-06):
  - `app/assets/styles/main.scss` is the only global stylesheet. Each theme block (`light` 58-86, `dark` 89-117, `calm-slate` 120-148, `cobalt` 151-179) defines 23 tokens: background, surface, surface-hover, border, text-primary/secondary/disabled, accent (+hover, from `--color-accent-custom`), danger, success, warning, info, state-armed/paused/queued, stop-all, meter-lowest..clip. `:root` (20-55) holds spacing, radius, transitions, z-index, `--playback-controls-height: 120px`, `--properties-panel-height: 300px`, unused `--cart-player-width`, font sizes 15/12/18 and weights 450/600.
  - Used but undefined: `--color-text` (PropertiesPanel 693, 701, 789, 818), `--color-accent-dark` (UpdateModal 213, 304, 375), `--color-background-hover` (WaveformTrimmer 1695), `--color-hover` (YouTubeImportModal 382, 549), `--radius-sm`/`--radius-md` (RemoteViewerControl 153, 175, 216). UpdateModal uses `--color-accent-custom` directly (213, 237, 283, 304, 371).
  - `app/assets/styles/variables.scss` is injected everywhere and used nowhere. `public/assets/styles/` is a stale copy. `app/assets/fonts/` duplicates `public/fonts/`; Inter is declared (main.scss 11-16) and unused. No IBM Plex Mono. No network fonts.
  - Colour literals: WaveformTrimmer 41 (canvas: meter hex 359-368 and 792-799, grid rgba 726-888, fade regions 949-1019; playhead bug at 904 assigns `'var(--color-accent)'` to `ctx.strokeStyle`, which canvas cannot resolve), app.vue 19 (accent swatches 78-83), LiveDisplayPanel 8, VUMeter 5 (71-73 not matching the meter tokens), PlaybackControls 4 (84-87), plus `color: white` in many components.
  - Icons: `material-symbols-rounded` everywhere; `-outlined` only in UpdateModal and ProjectSelectionModal. CartPlayer.vue:7 uses a gear character, PlaybackControls.vue:5 a `⚠` character.
- Tests mount no components; `tests/i18n.test.ts` requires every `t('key')` to exist in `locales/en.json`, Italian (`it`) to have every English key, and matching `{placeholders}`.
- The packaged app runs from `file://`, offline: fonts and images must be bundled.

## Goals / Non-Goals

**Goals:**

- The approved look on every screen, in all four themes, with tokens only.
- Every 2.0.0 feature kept (`coverage.md`), plus the three approved changes: three property tabs with a cue picker for targets, playlist search, recent projects.
- Steps that build in parallel without editing the same files.

**Non-Goals:**

- New audio or visual features beyond the three above.
- Changing the playlist index format (`0`, `1,0`, ...): the HTTP API triggers by it.
- Changing what Stop all and Esc do (Stop all fades 0.5 s, Esc stops at once).
- Light theme polish beyond token values (it must work and be readable, not be redesigned).
- Persisting things 2.0.0 does not persist (panel widths, active tab).

## Steps, waves and file ownership

| Step | Content                                         | Branch                         | Wave | Files it owns (others must not edit them)                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ----------------------------------------------- | ------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Tokens, fonts, header                           | `feat/restyle-1-foundation`    | 1    | `main.scss`, `nuxt.config.ts`, `package.json`/lock, font folders, `ProjectHeader.vue`, `locales/*.json` structure (D2)                                                                                                                                                                                                                                                                               |
| 2    | Now-playing strip, toolbar, search              | `feat/restyle-2-toolbar`       | 2    | `PlaybackControls.vue`, `ActiveCueItem.vue`, `VUMeter.vue`, `MainWorkspace.vue`, `PlaylistView.vue`, `PlaylistItem.vue` (filter only), new `usePlaylistActions.ts`, `usePlaylistFilter.ts`                                                                                                                                                                                                           |
| 4    | Properties drawer                               | `feat/restyle-4-properties`    | 2    | `PropertiesPanel.vue`, `WaveformTrimmer.vue`, `CuePicker.vue`                                                                                                                                                                                                                                                                                                                                        |
| 3    | Playlist rows, cart                             | `feat/restyle-3-playlist-cart` | 3    | `PlaylistItem.vue`, `PlaylistView.vue` (list part), `CartPlayer.vue`, `CartSlot.vue`                                                                                                                                                                                                                                                                                                                 |
| 5    | Visuals tab                                     | `feat/restyle-5-visuals`       | 3    | `MainWorkspace.vue` (media pane and toolbar right side), `MediaLibraryPanel.vue`, `MediaLibraryItem.vue`, `LiveDisplayPanel.vue`, `VisualPropertiesPane.vue`, `RemoteViewerControl.vue`, `useVisualDisplay.ts` if needed                                                                                                                                                                             |
| 6    | Welcome, recent projects, minimal mode, dialogs | `feat/restyle-6-welcome`       | 4    | `WelcomeScreen.vue`, `useProjectDialogs.ts`, `useProject.ts` (recording only), new `useRecentProjects.ts`, `electron/ipc/misc.js`, `electron/preload.js`, `app/types/global.d.ts`, `app/types/ipc.ts`, `MinimalWorkspace.vue`, `AboutModal.vue`, `UpdateModal.vue`, `ProgressModal.vue`, `ProjectSelectionModal.vue`, `YouTubeImportModal.vue`, `ControlConfigModal.vue`, `ToastHost.vue`, `app.vue` |
| 7    | README and screenshots                          | `docs/readme-screenshots`      | 5    | `README.md`, `docs/screenshots/`, `scripts/take-screenshots.mjs`, `public/screenshots/` (removal)                                                                                                                                                                                                                                                                                                    |

Each wave starts from `dev` after the previous wave is merged. Within a wave the two steps run in separate git worktrees. Every step branch starts from `dev` with this plan already merged.

## Decisions

### D1. Tokens (step 1) and the rule that only step 1 edits `main.scss`

Add to every theme block (values per theme below), keeping the 23 existing tokens unchanged:

| Token                             | cobalt  | calm-slate | dark    | light   |
| --------------------------------- | ------- | ---------- | ------- | ------- |
| `--color-panel`                   | #1A1A1A | #1C1F24    | #1C1C1C | #F3F3F3 |
| `--color-chrome` (header, drawer) | #1C1C1C | #1E2126    | #1E1E1E | #FFFFFF |
| `--color-field` (cards, inputs)   | #222222 | #23272D    | #262626 | #FFFFFF |
| `--color-divider`                 | #2E2E2E | #2C313A    | #333333 | #D0D0D0 |
| `--color-control-border`          | #393939 | #3A404A    | #3D3D3D | #C6C6C6 |
| `--color-text-muted`              | #8D8D8D | #8A93A0    | #8D8D8D | #6F6F6F |
| `--color-danger-text`             | #FF8389 | #FF8389    | #FF8389 | #A2191F |
| `--color-warning-text`            | #F1C21B | #F1C21B    | #F1C21B | #8E6A00 |
| `--color-on-accent`               | #FFFFFF | #FFFFFF    | #FFFFFF | #FFFFFF |

And once, in `:root`, derived tokens that follow the theme and a custom accent:
`--color-accent-tint: color-mix(in srgb, var(--color-accent) 14%, transparent)`, `--color-accent-tint-strong: color-mix(in srgb, var(--color-accent) 24%, transparent)`, `--color-warning-tint: color-mix(in srgb, var(--color-warning) 12%, transparent)`, `--color-danger-tint: color-mix(in srgb, var(--color-danger) 10%, transparent)`, `--color-success-tint: color-mix(in srgb, var(--color-success) 14%, transparent)`.
Sizes in `:root`: `--size-header: 48px`, `--size-strip: 88px`, `--size-toolbar: 48px`, `--size-row: 40px`, `--size-control: 32px`, `--size-control-lg: 36px`, `--size-action: 44px`, `--size-drawer: 268px`. Radii: `--radius-key: 4px`, `--radius-control: 8px`, `--radius-card: 10px`, `--radius-pill: 999px`. Type: `--font-sans: 'IBM Plex Sans', system-ui, sans-serif`, `--font-mono: 'IBM Plex Mono', ui-monospace, monospace`, `--font-brand: 'Bricolage Grotesque Variable', 'Bricolage Grotesque', var(--font-sans)`, `--font-size-base: 14px`, `--font-size-label: 12px`, `--font-size-title: 15px`; keep the existing font tokens. Body uses `var(--font-sans)` at 14px.
Also in step 1: define the five undefined variables listed in Context as aliases (`--color-text: var(--color-text-primary)`, `--color-accent-dark: var(--color-accent-hover)`, `--color-background-hover: var(--color-surface-hover)`, `--color-hover: var(--color-surface-hover)`, `--radius-sm: var(--radius-key)`, `--radius-md: var(--radius-control)`), so nothing renders transparent while later steps replace them. Leave `--playback-controls-height` and `--properties-panel-height` alone (steps 2 and 4 stop using them). After step 1, no other step edits `main.scss`: a step that needs a token it lacks asks the architect.
_Rejected_: a token file per component. One sheet keeps themes in step.

### D2. Locale sections, so parallel steps do not conflict (step 1)

Step 1 adds empty top-level objects to `locales/en.json` and `locales/it.json`, in this order at the end of each file, each separated by the existing content they follow: `"strip": {}`, `"toolbar": {}`, `"drawer": {}`, `"rows": {}`, `"cartUi": {}`, `"visuals": {}`, `"recent": {}`, `"dialogs": {}`, `"minimal": {}`. Each step adds its new keys only inside its own objects (strip/toolbar: step 2; drawer: step 4; rows/cartUi: step 3; visuals: step 5; recent/dialogs/minimal: step 6) and may reuse existing keys anywhere. Italian gets every new key (Italian punctuation: no em dash, «» quotes). Other locales get nothing (English fallback). Hard-coded English in a step's own components moves into its section.

### D3. Fonts (step 1)

Add dev dependencies `@fontsource/ibm-plex-mono` (weights 400, 500, 600) and `@fontsource-variable/bricolage-grotesque`, imported through the `css` array in `nuxt.config.ts` so Vite bundles the woff2 files (works offline under `file://`). Remove the Inter `@font-face`, `public/fonts/Inter/`, the duplicate `app/assets/fonts/`, `public/assets/styles/`. Keep IBM Plex Sans as is. After `npm install` on macOS, regenerate the lockfile on Linux as project memory describes (`docker run node:24 npm install --package-lock-only --ignore-scripts` on a copy), or CI's `npm ci` fails.

### D4. Header (step 1, `ProjectHeader.vue`)

48 px, `--color-chrome`, divider bottom. Left: the mark (`./assets/icons/cuebard-mark.svg`, bound with `:src` because Vite rewrites a literal `./assets` path) at 26 px and the wordmark "CueBard" in `--font-brand` 700 17px; a 1px divider; project name (600); no save state (the saver's pending flag is private and cannot report a failed write). Right: the silence warning as a pill (keep all four stages and their thresholds: >30 s yellow text on `--color-warning-tint`, ≤30 slow flash, ≤10 red on `--color-danger-tint` with 1 s flash, ≤5 solid `--color-danger` with `--color-on-accent` text and 0.5 s flash; text "Silence in 0:12"), the remote viewer pill only when the remote viewer is on ("Viewer on", green dot; polled once per second from getRemoteViewerStatus(); no client count (not exposed)), then the clock in `--font-mono` 18px 500 `--color-text-secondary`. No buttons in the header (none exist today; settings live in the menu). Strings: `project.silenceIn` and `project.viewerOn`. The mark keeps its fixed Cobalt fill on every theme (owner's decision in the icon PR).

### D5. Now-playing strip (step 2)

`PlaybackControls.vue` height `var(--size-strip)`. Stop all: 112 px wide button, `--color-danger` 1.5px border, `--color-danger-tint` fill, `--color-danger-text`, label "Stop all" and below it "fades 0.5 s"; disabled while nothing plays; still calls `panicStop`. Active cues: horizontal list of 300 px cards (`ActiveCueItem.vue`): `--color-field`, inset left stripe in the item colour, name (500, ellipsis), Pause/Resume and Stop icon buttons (28 px), then a row: elapsed (mono 11px muted), progress bar (click to seek, as today) with the per-cue meter as a thin bar under it, remaining time in mono 18px 600. Paused: remaining time in `--color-warning-text`, bar in `--color-warning`. Keep the 30/10/5 s warning flashes. Empty state "No active cues" kept. Right: MIX meter (only while something plays) and the master volume as a horizontal slider, -60 to 0 dB in 0.1 steps, dB readout in mono, handle colour by level as today, plus a 24-segment meter. `VUMeter.vue` uses the `--color-meter-*` tokens (read with `getComputedStyle` where JS needs a value) instead of its own hex values.

Accepted in review (step 2): the 24-segment meter under the master slider _is_ the MIX meter (no separate label; shown only while something plays, its row reserved so the slider does not move). `VUMeter.vue` has two variants, `bar` (per-cue thin bar with peak tick) and `segments` (MIX), coloured with the meter tokens in style bindings. Cue cards: 3px stripe in the item colour always; a custom (non-neutral) colour adds an 8% tint over `--color-field` and colours the bar; neutral cues get a flat card with the accent bar; paused cues a `--color-warning` bar. The master handle keeps its level colours (coverage) on an accent-filled track. A row mounted while its cue plays shows its countdown at once (`immediate` playback watches in `PlaylistItem.vue`, a 2.0.0 bug the search made common).

### D6. Toolbar and search (step 2)

One 48 px row in `MainWorkspace.vue` replacing the tab bar: a segmented control Audio / Visuals (Visuals only when `visualDisplayEnabled`, fallback watch kept), a search field 260 px ("Find a cue", Esc clears it), a flexible gap, then on the Audio tab: Import audio, YouTube, New group (32 px buttons with icons and labels). `PlaylistView.vue` loses its header. The import logic moves unchanged into `app/composables/usePlaylistActions.ts` (`handleImport`, `importAudioFile`, `handleAddGroup`, `showYouTubeModal`); `PlaylistView` keeps using `importAudioFile` for its drop handler; `YouTubeImportModal` is mounted in `MainWorkspace.vue`. The right side of the toolbar on the Visuals tab is step 5's.
Search: `app/composables/usePlaylistFilter.ts` with `useState('playlistFilter', '')` and `matches(item)`: case-insensitive substring of `displayName`; a group is shown if its name matches (then all its children show) or any descendant matches (then only matching descendants show). `PlaylistView` and `PlaylistItem` apply it when rendering only; indices, drag and drop, selection and playback are unaffected. While a filter is active, show a one-line "N of M cues · Clear" under the toolbar. While the field has focus, hotkeys are ignored (the existing rule for text inputs), so Esc there clears the search instead of stopping all cues; outside the field Esc still stops all.

### D7. Properties drawer (step 4)

`PropertiesPanel.vue` stays where it is (`MainWorkspace.vue:57`), height `var(--size-drawer)`, `--color-chrome`. Header 44 px: item colour dot, name, file meta in mono muted, a segmented control with tabs, a close button (clears the selection, as today). Tabs for audio: **Playback** (default), **Behaviour**, **Details**; for groups: **Behaviour**, **Details**. Switching items keeps the tab if it exists for the new item.

- **Playback** = `WaveformTrimmer.vue` re-laid: vertical volume slider left (-60..+10 dB, markers +10/0/-12/-24/-∞, readout, double-click resets, level colours), waveform centre (trim handles and overlays, play/stop/crossfade fade regions and handles hidden for cart items, RMS line, time grid, playhead, click to seek, wheel zoom, scroll bar when zoomed), below it one row of fields with −/+ 0.5 s buttons: In, Out, Length (read-only), Fade in, Fade out, Crossfade (fades hidden for cart items); right column: Zoom slider 1-20× with %, Trim silence, Normalize volume. Canvas colours come from tokens via `getComputedStyle(document.documentElement)` (`--color-meter-*`, `--color-text-muted`, `--color-divider`, `--color-warning`, `--color-danger`, `--color-accent`); fix the playhead at 904 the same way.
- **Behaviour**: three columns. When it starts (audio: Nothing, Play next, Play a cue, Play by index; group: Play first, Play all). When it ends (Nothing, Play next, Go to a cue, Go to index, Loop for audio). Other cues (Stop all others, No ducking, Duck others with the level slider -60..0 dB, 0.5 steps). "Play a cue" and "Go to a cue" show a button with the target's colour dot, name and index that opens `CuePicker`; a missing target shows "None (was deleted)". Index targets keep the comma text field. The picker lists the playlist depth-first, groups included, then cart-only cues; the current cue may be picked.
- **Details**: Name (saved on change), Colour (the 16 `PRESET_COLORS`, current one ringed), File with Replace (keep today's behaviour, it is a stub; do not implement it here), Duration, Trigger URL with Copy (port read from getRemoteViewerStatus(), fallback 8080), UUID and index with Copy UUID.
- Multi-selection: today's diff-copy logic (416-475) and the all-selected application of fades, Normalize and Trim silence stay exactly as they are.
- `CuePicker.vue` gains `includeGroups?: boolean` (default false) so behaviour targets can be groups (`triggerByUuid` plays groups too, `useAudioEngine.ts:901-910`); `currentUuid`, `select`, `cancel` keep their meaning (VisualPropertiesPane uses them); its strings move to the `drawer` locale section; restyle it as a dialog.
  _Rejected_: keeping six tabs. Four of them held one or two controls each.

Accepted in review (step 4): fade regions are drawn on a stopped cue too (2.0.0 drew them only while playing, a misplaced brace); fade grips sit near the top of the waveform so they no longer cover the trim handles; fade fields show seconds ("2.5 s", typing accepts "2.5", "2,5", "2.5 s" or hh:mm:ss.mmm) while In and Out keep hh:mm:ss.mmm; Length is Out minus In and the full file duration is shown in the header and the Details file row (no separate Duration row); volume markers sit at their true dB positions; both trim handles use the accent, the RMS line is dashed and the playhead is drawn above the fade regions; option labels use new sentence-case keys in `drawer`; CuePicker shows every entry's index (also in VisualPropertiesPane) and has no shadow. Canvas tokens are re-read by a MutationObserver on `<html>` (theme and custom accent).

### D8. Playlist rows and cart (step 3)

Rows (`PlaylistItem.vue`): height `--size-row`, radius `--radius-control`, gap 10. Order: chevron (groups), index in mono 12 muted (unchanged format), colour dot 8px (replaces the left stripe), name (14px, ellipsis, never truncated by fixed widths), behaviour chips (20 px pills, `--color-control-border` outline, 11px: "loop", "duck others", "then next", "go to <name>", "crossfade 4 s", "plays next" for start), duration in mono 13 (trimmed length; countdown while playing as today). Indent 24 px per level. States: playing `--color-accent-tint` background, bold name and a 2px bottom line in the accent showing progress (replaces the left stripe and the 75% fill); paused `--color-warning-tint`; selected `--color-surface` with a 1.5px accent outline; warning flashes 30/10/5 s kept; waveform behind the row on hover kept. Hover actions (Play, Pause/Resume, Stop, Delete with confirm) as 26 px buttons. When nothing is playing, the selected audio row shows a "Space" keycap chip (Space plays it). Group headers: uppercase 12px 600 tracked, index, name, and "N cues · total length" in mono muted. Drag and drop rules, highlight classes and selection unchanged.
Cart (`CartPlayer.vue`, `CartSlot.vue`): panel `--color-panel`; header "CART" label and a "Keys and MIDI" button opening `ControlConfigModal` (replaces the gear character). Grid column logic unchanged (2/3/4 by width). Filled slot 84 px card: key cap top-left (mono 11, `--radius-key` outline), name up to two lines, footer duration and "loop"; behaviour chips as in rows; playing: 1.5px accent outline, `--color-accent-tint`, 3px accent progress at the bottom, name in accent; hover: Play/Stop, Edit, Remove icon buttons top-right; waveform on hover kept; warnings kept. Empty slot: dashed `--color-control-border`, key and "Drop a cue"; click imports as today. Drag-over highlight uses `--color-accent-tint-strong`. Splitter: 9 px handle with a 3×32 grip; snap and collapse rules unchanged.

### D9. Visuals tab (step 5)

In `MainWorkspace.vue` media pane: one left column 264 px (`--color-panel`) and the composition taking all remaining width and height. The left column shows either the **media library** or, while visual properties are open, **visual properties** in its place (back arrow returns to the library). A toolbar button (panel icon, next to the Audio/Visuals switch) hides and shows the column; hidden by the user stays hidden for the session. The media splitter (`mediaWidth`, 89-104) goes.

- Library (`MediaLibraryPanel.vue`, `MediaLibraryItem.vue`): header "MEDIA" with "+ Folder" and "Import"; the folder list (All, Unfiled, user folders) as 30 px rows with counts, rename by double-click, delete on hover with confirm, drop media onto a folder; a divider; the grid in 2 columns with 80 px thumbnails, linked-cue badge, hover actions Properties, Add to composition, Delete; import progress; empty state; multi-select rules unchanged. The folder sidebar's own collapse goes (the whole column collapses instead).
- Toolbar right side on the Visuals tab: "N layers", Publish all (primary), Black, Viewer (with a green dot when on; no client count, not exposed). `LiveDisplayPanel.vue` loses its header; the actions come from a small composable or are lifted into `MainWorkspace` (the implementer's choice, keep logic unchanged).
- Composition (`LiveDisplayPanel.vue`): the 16:9 canvas scales to the largest size that fits (keep the container-query sizing at 617-634); layer states, handles, drop, Delete key unchanged; the selected-layer bar sits under the canvas as a normal 44 px row (name, Publish/Unpublish, Background/Unset BG, Front, Back, Remove), not an absolute overlay with z-index 10000. The selected-layer row is always present (muted 'No layer selected' without a selection) so the canvas never resizes when a drag starts. Drawing on the canvas, the player's output, keeps fixed light-on-black colours as scoped custom properties.
- `VisualPropertiesPane.vue`: fields unchanged (name, linked cue with Change/Clear via CuePicker, link delay, fades), laid out for the 264 px column.
- `RemoteViewerControl.vue`: same popover content (Player window, Remote viewer with QR and URLs and warning, Allow remote control from network), anchored to the toolbar Viewer button.
- All hard-coded English in these components moves into the `visuals` section.
  _Rejected_: a fixed right-hand properties column. The owner wants the canvas as large as possible.

### D10. Welcome, recent projects, minimal mode, dialogs (step 6)

- Welcome (`WelcomeScreen.vue`): two columns (wrap on narrow windows). Left: the mark in an 88 px `--color-field` tile, "CueBard" in `--font-brand` 48px, the tagline (`welcome.subtitle`), New project (primary 44 px) and Open project (secondary 44 px), "v<version> · based on LivePlay" in mono muted. Right: "RECENT" and up to 8 entries (name, path in mono muted with ellipsis, relative date); click opens it through `openProject`; an empty list shows nothing. Remove the `'1.1.3'` version fallback (show nothing until the version arrives).
- Recent projects: main process `electron/ipc/misc.js`, file `path.join(app.getPath('userData'), 'recent-projects.json')`, entries `{ path, name, openedAt }`, most recent first, at most 8, deduplicated by path. IPC `get-recent-projects` returns entries whose file still exists (missing ones are dropped and the file rewritten); `add-recent-project(path, name)` inserts at the top and also calls `app.addRecentDocument(path)`. Preload `getRecentProjects`, `addRecentProject`; types in `global.d.ts` and `ipc.ts` (`RecentProject`). Renderer `useRecentProjects.ts`. `useProject.ts` calls `addRecentProject` after a successful `createNewProject` (146) and `openProject` (after 234); nothing else changes there.
- The name prompt in `useProjectDialogs.ts` (DOM-built, styles in `WelcomeScreen.vue:152-238`) gets the token styles; its `alert` text goes to the `dialogs` section.
- Minimal mode (`MinimalWorkspace.vue`): tokens, `--font-mono` for times and keys, `CART_SLOT_COUNT` instead of 16, strings into `minimal`.
- Dialogs: About, Update, Progress, ProjectSelection, YouTubeImport, ControlConfig, ToastHost and the accent picker in `app.vue` use tokens (no `color: white`, no undefined variables, `material-symbols-rounded` everywhere), 10 px radius cards on `--color-chrome`, primary actions in the accent; Cancel in `app.vue:20` into `dialogs`. Keep every control and behaviour.

### D11. README and screenshots (step 7)

`scripts/take-screenshots.mjs` (run by hand, not in CI): creates a demo project in a temp folder (cue audio generated with the bundled ffmpeg as tones; images generated as plain coloured placeholders with a label; names fit a tabletop session), starts the dev app with `--remote-debugging-port`, opens the project through the main process (`webContents.send('open-project-file', ...)`, see project memory "smoke tooling"), and captures at 1440×900: welcome, audio workspace with a cue playing and one selected, properties Behaviour tab, visuals with a published background and a draft layer, the remote viewer page, minimal mode. Saves PNGs to `docs/screenshots/`. README: rewrite the feature section around what 2.1 does (audio, visuals, remote viewer, control surfaces, themes, recent projects, search), embed the screenshots, keep install, upgrade-from-E-LivePlay, file types, API and licence sections accurate. Delete `public/screenshots/` (upstream images, unused).

### D12. Verification for every step

`npm test`, `npm run typecheck`, `npm run build`; the dev app driven over CDP (project memory "smoke tooling": one dev app at a time on port 3000, open a copy of the test project) with screenshots of the step's screens in the default theme and in Calm Slate and Classic Light, saved under the scratchpad and listed in the hand-back; every `coverage.md` line of the step checked by hand in the running app and ticked.

## Risks / Trade-offs

- [Two parallel steps edit the same file anyway] → stop and ask; do not resolve another step's file.
- [Locale merge conflicts] → only inside your own section (D2); if git still conflicts, the architect resolves it.
- [A feature turns out to depend on markup you are removing] → keep the feature, report the departure.
- [Light theme contrast fails on a new token] → report it with the values; do not change `main.scss` outside step 1.
- [Canvas colours read once at mount miss a theme switch] → re-read them when the theme changes (watch `useState('theme')`).
- [Dev app port 3000 is shared] → only one dev app runs at a time; if it is taken, wait, do not kill another session's app.

## Migration Plan

Waves as in the table; each step: branch from `dev`, build, hand back, review, PR into `dev`, merge. After step 6: `release/v2.1.0` into `dev`, then the owner approves the `dev` → `main` release PR. Step 7 follows on `dev` and ships with the next release.

## Open Questions

None.
