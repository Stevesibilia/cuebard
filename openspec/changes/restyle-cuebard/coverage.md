# Feature coverage

Every feature of CueBard 2.0.0, from a read of the code on 2026-10-06, with the step that must keep it. The implementer of each step checks its lines in the running app and ticks them in its last commit. A feature that cannot be kept is a question to the architect, not a silent removal.

## Step 1: header and global

- [x] Logo shown in the header (now with wordmark)
- [x] Project name, or "No Project"
- [x] Clock HH:MM:SS, updated every second
- [x] Silence warning when all active cues end within 60 s with nothing following; stages >30 s, ≤30 s slow flash, ≤10 s red 1 s flash, ≤5 s solid red 0.5 s flash
- [x] Theme from the project's `theme.mode`, mirrored to `<html data-theme>`; custom accent via `--color-accent-custom`
- [x] RTL direction for RTL locales
- [x] Dropped files never navigate the window (app.vue 148-161)

## Step 2: now-playing strip, toolbar, search

- [x] Stop all: disabled with nothing playing; fades playing cues over 0.5 s, end behaviours do not run
- [x] "No active cues" when empty
- [x] Active cue: name, elapsed, remaining (-m:ss), progress bar with item colour, per-cue meter with peak hold, item colour tint
- [x] Active cue warning flashes at 30/10/5 s
- [x] Active cue Pause/Resume, Stop (fade-out), click progress to seek within the trimmed range
- [x] MIX meter shown only while a cue plays, peak hold
- [x] Master volume -60..0 dB, 0.1 steps, dB readout, handle colour by level; session-only
- [x] Audio tab always; Media/Visuals tab only when visual display is enabled; falls back to Audio when disabled
- [x] Import audio: multi-file dialog, copy into `media/` with "name (2).ext" on clash, add at root, waveform in background
- [x] Import from YouTube opens the YouTube dialog
- [x] New group adds "New Group" at the root
- [x] Dropping audio files (mp3, wav, ogg, flac, m4a, aac) on the playlist area imports them; a drop onto a row does nothing
- [x] F1 plays the selected audio item (main workspace only)
- [x] Menu listeners: Save (immediate), Export (progress), Close project, Open project folder

## Step 3: playlist and cart

- [x] Playlist empty state with hint
- [x] Row: group chevron (expanded state saved), index in comma form, group icon/marker, name, behaviour indicators with tooltips, duration (trimmed; countdown while playing, -h:mm:ss over an hour)
- [x] States: selected, playing (accent, bold), custom colour shown when not the neutral default, progress while playing (groups too, through play-first), warning flashes 30/10/5 s
- [x] Waveform behind the row on hover, trimmed range, scaled by volume
- [x] Nested indent 24 px per level, no depth limit
- [x] Hover actions: Play (groups trigger the group; group Play always visible), Pause/Resume, Stop, Delete with confirm
- [x] Click select; Ctrl/Cmd toggle; Shift range in flattened order
- [x] Drag rows, whole selection when dragging a selected row; before/after/inside-group drop zones; normalizeMoveSet; refuse drop into own subtree; drag-over classes
- [x] Drag a row onto a cart slot assigns it
- [x] Cart: 16 slots; columns 2/3/4 by width; "Keys and MIDI" opens the controls dialog
- [x] Splitter: default 500, min 300, max 95%; snap close within 100 px of the right edge, full width within 100 px of the left; collapsed edge strip drags back
- [x] Empty slot: number/key, hint on hover, click imports the first chosen file as a cart-only item
- [x] Filled slot: name, key, item colour tint (stronger while playing), progress, waveform on hover, behaviour indicators, duration or countdown, warning flashes
- [x] Slot click plays (never stops) and moves the selection to it if an item was selected
- [x] Slot hover: Play, Stop while playing, Edit (select and open properties), Remove (deletes cart-only items, no confirm)
- [x] Slot drag onto slot: move to empty, push the run up to the first gap, refuse past slot 16
- [x] OS audio file onto a slot imports it as cart-only (duration corrected after waveform)
- [x] Playlist row onto a slot assigns it (single uuid), replacing the assignment
- [x] Drag-over highlight on slots

## Step 4: properties drawer

- [x] Opens whenever an item is selected, on either tab; close clears the selection
- [x] Switching items keeps the current tab when it exists
- [x] Display name, saved on change
- [x] Colour: 16 preset swatches, current marked
- [x] UUID read-only with Copy
- [x] Index read-only
- [x] API trigger URL (audio) with Copy
- [x] File name with Replace (stub, unchanged)
- [x] Duration
- [x] Volume -60..+10 dB, 0.1 steps, markers, readout, double-click resets to 0, level colours, live on a playing cue
- [x] Zoom 1-20× slider with %, wheel zoom over the waveform
- [x] Trim silence (5 % threshold, 0.1 s padding); Normalize (-10 dB target, +10 dB cap); both on every selected audio item
- [x] Waveform: time grid, level colours, RMS line, "No waveform data available", playhead while playing, fade regions, click to seek
- [x] In and Out handles with dimmed outside; play-fade, stop-fade, crossfade handles (only >0, never for cart items), clamped 0-10 s
- [x] Scroll bar when zoomed
- [x] In/Out fields hh:mm:ss.mmm with ±0.5 s, select on focus; Duration read-only
- [x] Play fade in, Stop fade out, Crossfade fields with ±0.5 s (not for cart items); fades apply to every selected item
- [x] Ducking: Stop all others, No ducking, Duck others with level -60..0 dB (0.5), seeded at 0.2 linear
- [x] Start behaviour: audio Nothing / Play next / Play item / Play index; group Play first / Play all
- [x] End behaviour: Nothing / Play next / Go to item / Go to index / Loop (audio); groups same fields
- [x] Target index fields (comma-separated); target cue via picker (new)
- [x] Multi-selection: shows the last clicked item; copies only changed fields to all selected (name, colour, volume, in/out, ducking, start/end; groups start/end only)

## Step 5: visuals

- [x] Folders: All, Unfiled (drop target), user folders; click filters; New folder dialog (Enter/Create, Esc/Cancel, duplicates ignored); double-click rename (Enter/blur, Esc) re-tags items; delete on hover with confirm, items become unfiled; drop media onto a folder moves them (not onto All)
- [x] Import button; "N items" count; OS file drop on the library imports (jpg, jpeg, png, gif, webp, svg, pdf) into the selected folder; "Importing x/y..."
- [x] Empty state "No media items / Drag files here or click Import"
- [x] Select: click, Ctrl/Cmd toggle, Shift range in filtered order; selection clears on folder change
- [x] Delete item with confirm (removes from disk)
- [x] Item: thumbnail or PDF icon, linked-cue badge, name with tooltip; hover Properties, Add to composition, Delete
- [x] Drag items (selection) onto folders or the composition
- [x] Composition: layer count, Publish all (disabled without drafts; linked-cue logic), Black (disabled when nothing published; keeps background; cancels timers)
- [x] 16:9 letterboxed canvas; "Drag or push items here" empty state
- [x] Layer states: draft dashed, published green, selected accent, queued dashed with tag, background "BG" badge
- [x] Click select / empty deselect; drag to move (clamped; background not movable); 8 resize handles, corners keep ratio, min 5%
- [x] Drop media creates layers 50%×50% at the pointer, cascading 3%; first image load fits aspect (not background)
- [x] Delete/Backspace removes the selected layer when focus is on the page
- [x] Layer bar: name, Publish/Unpublish (linked cue with link delay; unpublish cancels timers, not audio), Background/Unset BG (one background, survives Black, restores box), Front, Back (disabled for background), Remove
- [x] Published changes sync to the player; per-item fades passed to the player; layers session-only, cleared on project open/close
- [x] Visual properties: name (blur/Enter, empty reverts), linked cue (name / None / None (was deleted)), Link/Change via CuePicker, Clear, link delay -30..+30 s (0.1) with hint, fade in/out 0-10 s (0.1), saves immediately; stale links cleared on open
- [x] Viewer popover: Player window toggle (kept in step with the window), Remote viewer toggle with QR, URLs, "No LAN address found", LAN warning; Allow remote control from network (session-only, off by default)

## Step 6: welcome, minimal mode, dialogs

- [x] Welcome: logo, title, version, subtitle; New project (folder dialog, then name prompt; Enter/Esc; alert on failure); Open project
- [x] Recent projects (new)
- [x] Minimal mode: 420×340 window, menu bar hidden, restore on exit; active cues with name, elapsed/total, Pause/Resume, Stop; 16-slot cart with key and marquee names, click toggles; OUT slider -60..0 (0.5) with readout; exit button
- [x] Accent picker: 18 swatches, click sets and saves, Cancel/backdrop closes, nothing without a project
- [x] About: logo, name, version, subtitle, maintainer, based-on-LivePlay credit, translator credit link, links (repo, upstream, licence); ×, backdrop, Esc close
- [x] Update: versions, notes, prompt; Later; Download & Install or Go to Download Page; progress; cannot close while downloading; Install Now / Install on Exit; inline errors
- [x] Progress: title, message, percentage bar (import/export)
- [x] Project selection (archive with several projects): list, Cancel/backdrop, Open disabled until a choice
- [x] YouTube: search (Enter or button), searching/error/no results/results, result thumbnail/title/channel/length, Preview (browser), Download (disabled while downloading), queue with status/progress/%, completed entries disappear after 2 s, finished download added to the playlist root with waveform, close resets search but keeps the queue
- [x] Controls dialog: Keyboard tab (16 slot captures, defaults styled, reserved/conflict errors with highlight, global actions Pause/Resume, Toggle loop, Stop all, Volume up/down with clash checks, Esc cancels capture or closes), MIDI tab (devices, slots/playback/volume sections, binding text, Learn/Cancel, Clear, reassign dialog), Reset to defaults / Reset all, Close
- [x] Toasts: error/info icon, click dismisses, auto-hide after 6 s
