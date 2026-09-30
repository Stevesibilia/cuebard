## Context

Findings come from issue #77 (code review of `dev` @ 88f9deb), plus the follow-up comment on `useVisualDisplay` timers found while building #76. Line numbers below are from `dev` @ e041c43, where this branch starts.

The engine is `app/composables/useAudioEngine.ts`. Cue state lives in `useState<Map<string, ActiveCueState>>('activeCues')`, which is deeply reactive: every value read out of it, including `cue.howl`, is a Vue proxy. Howler 2.2.4 (`node_modules/howler/src/howler.core.js`) matters in three places:

- `unload()` removes the Howl from the global registry with `Howler._howls.indexOf(self)` (l.1780). Called through a proxy, `self` is the proxy, the lookup returns -1 and the Howl stays registered forever.
- `pause()` calls `_stopFade` (l.1041): a fade in progress stops at its current volume and is never restarted.
- `_emit` (l.1894) dispatches every event through `setTimeout(..., 0)`, so an `onend` handler runs after Howler has finished its own `_ended` bookkeeping. Calling `unload()` from `onend` is safe.
- With `html5: true` and a sprite, Howler arms its own end timer from the sprite given at construction. The engine cannot change the sprite of a playing Howl.

Tests run in node (`vitest.config.ts`: no environment, no setup file). No test imports a composable today; `tests/finalize-cue.test.ts` tests a copy of `finalizeCue`. The engine uses Nuxt auto-imports as free identifiers (`useState`, `useProject`) and `import.meta.client` guards, which is why nobody tested it for real.

There is no toast or notification UI in the renderer (only native `alert()`, which blocks the renderer thread and with it every scheduled cue timer).

## Decisions

### D1. Howls are raw objects and are always unloaded

In `setupCueForPlayback` wrap the new Howl in `markRaw` (import `markRaw` explicitly from `vue`, like `useProject.ts` imports `triggerRef`) before storing it on the cue. `finalizeCue` calls `cue.howl.unload()` after `cue.howl.stop()`. `stopCue`'s delayed stop, `stopAllCues` and panic already call `unload()`; with `markRaw` those calls now actually deregister.
**Why:** `markRaw` makes `activeCues.value.get(id).howl` return the real Howl, so `Howler._howls.indexOf(self)` finds it. The rest of the cue state stays deeply reactive because the UI reads `cue.currentTime`, `isPaused` and levels from it every tick.
**Rejected:** `shallowReactive` for the map values (issue's suggestion) — it would stop the progress bars and meters from updating unless every UI read site changed.

### D2. Project teardown stops the audio

- `stopAllCues()` also clears `activeGroups`.
- `closeProject` (useProject.ts:398-410): replace `activeCues.value.clear()` with `await useAudioEngine().stopAllCues()`.
- `openProject` (useProject.ts:166): call `await useAudioEngine().stopAllCues()` next to the existing `clearVisualOutputs()` at the start.
  **Why:** the engine owns the map and the Howls; clearing the map from outside orphaned playing Howls so even Panic could not reach them.

### D3. Scheduling is pause-safe and trim-aware

`scheduleCueTriggers(cue, item)`:

1. `cancelCueTriggers(cue)` (unchanged).
2. Recompute the trimmed duration from the item as it is now: `const fileEnd = cue.fileDuration ?? Infinity; const out = Math.min(item.outPoint || item.duration, fileEnd); cue.duration = out - (item.inPoint || 0); cue.inPoint = item.inPoint; cue.outPoint = out;`. Add `fileDuration?: number` to `ActiveCueState`, set in `onload` from `howl.duration()`; `onload` then no longer computes the duration itself, it just calls `scheduleCueTriggers`.
3. `if (cue.isPaused) return;` — nothing is armed for a paused cue. `resumeCue` already sets `isPaused = false` before calling `scheduleCueTriggers`, so resume re-arms.
4. Arm crossfade / stop-fade / end (unchanged) and custom actions (D7).
   **Why:** `seekCue`, `setLoopForCue` and `rescheduleCueTriggers` all funnel through this function, so one guard fixes all three. Using the live `item.inPoint` with a stale `cue.duration` is what made an in-point edit cut the cue short.
   **Limit, documented not fixed:** the Howl's sprite is fixed at creation (see Context). Moving the in-point, or moving the out-point earlier, takes effect immediately; moving the out-point later than it was at trigger time still ends the cue at the old out-point (Howler's own sprite end fires `onend`). It applies from the next trigger. Put this sentence in a comment above `rescheduleCueTriggers`.
   **Rejected:** restarting the Howl on trim edits — an audible glitch mid-show for an edit the operator may be making live.

### D4. Fades survive pause

Add `fade?: { to: number; endsAt: number }` and `pausedFade?: { to: number; remainingMs: number }` to `ActiveCueState`. Add a private helper `fadeCue(cue, from, to, ms)` that calls `cue.howl.fade(from, to, ms)` and records `cue.fade = { to, endsAt: Date.now() + ms }`. Use it at every fade on a cue that stays in `activeCues`: the play fade-in in `playCue` (look the cue up with `activeCues.value.get(item.uuid)` after `setupCueForPlayback`), the fade-in in `startCrossfadeTrack`, the crossfade-out and stop-fade in `scheduleCueTriggers`, and the fades in `applyDucking` and `restoreDuckedVolumes`. Leave the fade-outs of `stopCue` and panic as plain `howl.fade` (those cues are already out of the map).

- `pauseCue`: before `howl.pause()`, if `cue.fade` exists and `endsAt > Date.now()`, set `cue.pausedFade = { to, remainingMs: endsAt - Date.now() }`; clear `cue.fade`.
- `resumeCue`: after `howl.play()`, if `cue.pausedFade`, call `fadeCue(cue, cue.howl.volume() as number, pausedFade.to, pausedFade.remainingMs)` and clear `pausedFade`.
  **Why:** Howler's `pause()` kills the fade. `Date.now()` rather than `performance.now()` so `vi.useFakeTimers()` controls it.

### D5. Panic stops only what was playing

`panicStop`:

1. `const doomed = Array.from(activeCues.value.values());`
2. `activeGroups.value.clear();`
3. For each doomed cue: clear its progress interval, `cancelCueTriggers(cue)`, `cue.howl.fade(cue.howl.volume() as number, 0, 500)`, `activeCues.value.delete(cue.uuid)`.
4. `setTimeout(() => doomed.forEach(c => { c.howl.stop(); c.howl.unload(); }), 500)`.
   **Why:** the old timeout iterated the live map, killing cues fired during the fade. Removing the doomed cues from the map at once (as `stopCue` already does) also means their `onend` is a no-op, so a cue that reaches its end during the fade cannot start its end behaviour, and a new cue fired in the window does not duck them.

### D6. Load/play failure leaves the other cues alone

- Move `applyDucking(item.uuid, item.duckingBehavior)` from `setupCueForPlayback` into `onload`, before `scheduleCueTriggers`. Under `html5: true` a `play()` issued before load is queued by Howler until load, so the ducking still lands as the audio starts.
- `onloaderror` and `onplayerror`: call `finalizeCue(item, { fromEnd: false })` (which stops, unloads, removes the entry and restores ducking) and then `notifyCueError(item)`.
- `playCue` and `startCrossfadeTrack` `catch`: same two calls if the cue is in the map, instead of the bare `activeCues.value.delete`.
- `notifyCueError(item)` (private): `useToast().showToast(`${t('audio.mediaError')}: ${item.mediaFileName}`, 'error')` with `t` from `useLocalization()`.
  **Why:** with ducking applied at setup, a missing file had already stopped every other cue ('stop-all', the playlist default) or left them ducked. A load error now never touches them. A play error after load restores 'duck-others' through `finalizeCue`; 'stop-all' cannot be undone and that is accepted (play errors after a successful load are rare on desktop Electron).
  **Rejected:** `alert()` — it blocks the renderer thread, and with it every cue timer.

### D7. Custom actions are cue timers

Add `customActionTimeouts: ReturnType<typeof setTimeout>[]` to `ActiveCueState` (initialised `[]`). Remove `scheduleCustomActions` and its two call sites (`playCue`, `startCrossfadeTrack`). In `scheduleCueTriggers`, after the end trigger: for each `item.customActions` entry, `delayMs = (action.timePoint - (item.inPoint || 0)) * 1000 - currentAudioTime * 1000`; if `delayMs > 0`, push `setTimeout(() => { if (activeCues.value.has(item.uuid)) executeCustomAction(action.action); }, delayMs)`. `cancelCueTriggers` clears and empties the array.
**Why:** they now pause, seek, stop and panic with the cue. Semantics: an action fires when playback crosses its time point; seeking back before it fires it again (same as crossfade after a backward seek). No editor UI exists yet, so no user-visible change today.

### D8. One engine `toggleLoop`

Add `toggleLoop(item: AudioItem)` to the engine's return. Module scope in `useAudioEngine.ts` (outside the function): `const endBehaviorBeforeLoop = new Map<string, EndBehavior>()`.

- Loop on: store `structuredClone(toRaw(item.endBehavior))` under `item.uuid`, set `item.endBehavior = { action: 'loop' }`.
- Loop off: `item.endBehavior = endBehaviorBeforeLoop.get(item.uuid) ?? { action: 'nothing' }`, delete the entry.
- Then `setLoopForCue(item.uuid, newLoop)`.
  It does not save; callers keep their `saveProject()`. `useCartHotkeys.ts` `toggleLoop` (209-217) and the MIDI `toggle-loop` branch (useMidiController.ts:141-166) keep their target-item lookup and call `engine.toggleLoop(target)` then `saveProject()`.
  **Why:** both copies dropped next/goto targets; the MIDI copy never synced the playing Howl or its end timer.
  **Limit:** the remembered behaviour lives for the session. After a restart, turning loop off on a looping cue gives 'nothing', as today.
  **Rejected:** persisting the previous behaviour in the item — a schema field for a toggle convenience.

### D9. "Duck others" always has a level

In `app/types/project.ts` export `DEFAULT_DUCK_LEVEL = 0.2` and use it in `CART_AUDIO_ITEM_TEMPLATE` instead of the literal. Engine `applyDucking`: drop the `duckLevel !== undefined` condition and use `behavior.duckLevel ?? DEFAULT_DUCK_LEVEL`. `PropertiesPanel.vue`: the mode `<select>` (118) keeps its `v-model` and `@change="handleSave"`; add a handler before the save that sets `duckLevel = DEFAULT_DUCK_LEVEL` when the new mode is `duck-others` and `duckLevel` is undefined. The `duckLevelDB` getter (360-370) reads `duckLevel ?? DEFAULT_DUCK_LEVEL`.
**Why:** existing projects already have playlist cues in `duck-others` with no level; the engine fallback covers them without a migration.

### D10. Hotkey focus rule and key repeat

New pure `app/utils/keyboard.ts`: `isTextEntryElement(el: { tagName: string; type?: string; isContentEditable?: boolean } | null): boolean` — true for `textarea`, `select`, `isContentEditable`, and `input` whose `type` (lower-cased, default `text`) is not one of `range`, `checkbox`, `radio`, `button`, `submit`, `reset`, `color`, `file`, `image`. `useCartHotkeys.ts` `isTextInputFocused` (154-161) becomes `isTextEntryElement(document.activeElement as HTMLElement | null)`.
In `handleKeydown` (222-252) ignore `e.repeat` for everything except the master volume up/down actions (holding those keeps ramping). Handled keys already `preventDefault()`, so a focused slider or checkbox does not also react.
**Why:** after touching a volume slider, every cart key, Space and Escape did nothing until the operator clicked elsewhere; holding a cart key toggled it on and off.

### D11. Control surfaces live at app level

New `app/composables/useControlSurfaces.ts` exporting `useControlSurfaces()` with `mount()` / `unmount()`:

- `mount`: `useCartHotkeys().mount()`, `useMidiController().mount()`, and subscribe `onTriggerItem` / `onStopItem` (moved out of `useWorkspaceListeners.ts:65-77`, same bodies), keeping the unsubscribers (D12).
- `unmount`: the reverse.
  `app.vue` holds one instance and calls `mount()` in its existing `onMounted` (92-96) and `unmount()` in a new `onUnmounted`. Remove `mountHotkeys`/`unmountHotkeys` from `MainWorkspace.vue` (77, 112, 119) and `mountMidi`/`unmountMidi` from `CartPlayer.vue` (66-85; keep its ResizeObserver).
  `useMidiController.unmount` also sets `midiAccess.value.onstatechange = null`. Both handlers must ignore input when `currentProject.value` is null: hotkeys already do (check); in `useMidiController` return early from the message handler when there is no project and `learning` is not active (MIDI Learn must keep working).
  **Why:** MIDI was mounted only by `CartPlayer`, which exists only on the Audio tab with the cart open; minimal mode unmounts `MainWorkspace` and mounts no key listener at all. The remote-control API had the same gap in minimal mode. `app.vue` mounts once, so nothing accumulates.
  **Not moved:** save, export, close and open-folder listeners stay in `useWorkspaceListeners` (export drives the workspace's own progress modal); they get proper cleanup instead (D12).

### D12. IPC subscriptions return an unsubscribe

In `electron/preload.js` add a helper and use it for every `on*` wrapper:

```js
const subscribe = (channel, callback) => {
  ipcRenderer.on(channel, callback);
  return () => ipcRenderer.removeListener(channel, callback);
};
```

`onPlayerWindowStatusChanged` keeps its argument-stripping wrapper but returns a remover for that wrapper. Callbacks keep receiving exactly what they receive today. The remover is built in the preload world, so it removes the very function that was added; do not rely on the renderer passing the same callback back across the context bridge. Remove `removeExportProgressListener` and `removeImportProgressListener` (preload 54-55, `global.d.ts` 41-42) — their callers switch to the returned unsubscribe.
`app/types/global.d.ts`: every `on*` returns `() => void` (one `type Unsubscribe = () => void`).
Renderer:

- `useWorkspaceListeners.registerListeners()` returns an `unsubscribe()` that removes everything it added. `MainWorkspace.vue` calls `registerListeners()` in `onMounted` (not at setup top level, line 107) and the returned function in `onUnmounted`.
- The export flow (`useWorkspaceListeners.ts:27-53`) and both import flows (`useImportExport.ts:51-64`, `73-87`) remove their progress listener in a `finally`.
- `WelcomeScreen.vue:147-156`: its `onMenuNewProject` / `onMenuOpenProject` listeners are the only ones for those menu items, and Menu > New/Open with a project open worked only because they leaked. Move `handleNewProject`, `handleOpenProject` and `getProjectName` verbatim into a new `app/composables/useProjectDialogs.ts`; `useMenuListeners.registerListeners()` subscribes the two menu events to them once at app level; `WelcomeScreen.vue` calls the composable from its buttons and registers no IPC listener. The handlers' behaviour does not change.
- `UpdateModal.vue:116-134`: keep the three unsubscribers, call them in `onUnmounted`.
- `RemoteViewerControl.vue:127-137`: assign `detachStatus` from the `onPlayerWindowStatusChanged` return value.
- App-level registrations (`useMenuListeners`, `useImportExport`, `useUpdateChecker`) run once from `app.vue`; they may ignore the return value.
  **Why:** each remount added another copy of every listener: N saves per Ctrl+S, N dialogs per Menu > Open, N triggers per API call.

### D13. Visual reveal timers are shared

`useVisualDisplay.ts:31`: move `pendingTimers` to module scope (above `export const useVisualDisplay`), as the follow-up comment on #77 asks.
**Why:** `closeProject` → `clearVisualOutputs` → `useVisualDisplay().clearAll()` got a fresh empty map and could not cancel the timers owned by `LiveDisplayPanel`'s instance.

### D14. Toast

New `app/composables/useToast.ts`: `useState<Toast[]>('toasts')`, `showToast(message: string, kind: 'error' | 'info' = 'error', ms = 6000)` that pushes `{ id, message, kind }` and removes it after `ms`; `dismissToast(id)`. New `app/components/ToastHost.vue` rendered once in `app.vue` outside the `v-if` chain: fixed bottom-right stack, `role="alert"` for errors, click to dismiss, theme tokens only (no literal colours; `openspec/specs/theme-tokens`). i18n key `audio.mediaError` = "Media file missing or unreadable" in every locale file under `locales/` (new top-level `audio` section; there is none today), English text, Italian in `it.json`: "File multimediale mancante o illeggibile".

### D15. The engine is tested for real

- `vitest.config.ts`: add `define: { 'import.meta.client': 'true' }`. Check first that no existing test depends on it being undefined; if Vite does not replace it in test transforms, report it rather than working around it in the engine.
- New `tests/audio-engine.test.ts` imports the real `useAudioEngine`. Setup: `vi.mock('howler', ...)` with a `FakeHowl` class (records calls; `unload()` removes `this` from a `Howler._howls` array with `indexOf(this)` exactly as Howler does, so the proxy bug reproduces without D1; `duration()`, `seek()`, `volume()`, `fade()`, `pause()`, `play()`, `loop()`; a test hook to fire `onload` / `onloaderror` / `onend`). `vi.stubGlobal` for `useState` (a keyed cache of `ref(init())` from `vue`, reset in `beforeEach`), `useProject` (a small in-memory project with `findItemByUuid` / `findItemByIndex`), `useToast`, `useLocalization`. `vi.useFakeTimers()`.
- Port the idempotence cases of `tests/finalize-cue.test.ts` to the real engine, then delete that file.
- New `tests/keyboard.test.ts` for `isTextEntryElement`.

## Not touched

- Howler's sprite on a playing cue (D3 limit).
- Save, export, close and open-folder listeners stay in the workspace (D11).
- `#63` loop end-warning flash and `#22` ducking vs crossfade (out of scope in the issue).
- The `cue.volume`/`originalVolume` bookkeeping in `setVolume` during ducking — not reported, not changed.
- Group-progress calculation beyond clearing `activeGroups` in stop-all and panic.

## Risks

- **Ducking at `onload` feels late.** If in smoke a 'stop-all' cue audibly overlaps the cue it stops for more than a moment, report it with the file size and format; do not move ducking back.
- **`define` for `import.meta.client` does not take in vitest.** Report; do not add test-only branches to the engine.
- **A component relies on a listener registered at setup time** (e.g. an event arriving before mount). If moving a registration into `onMounted` breaks a flow in smoke, report which one.
- **MIDI Learn stops working** after the app-level move or the no-project guard: report, do not remove the guard.

## Verification

Unit (`npx vitest run`), `tests/audio-engine.test.ts`:

- finalize (natural end) calls `unload()` and the Howl leaves `Howler._howls`; same for `stopCue` after its fade and for `stopAllCues`.
- finalize twice: end behaviour fires once (ported).
- pause, then `seekCue` / `setLoopForCue(false)` / `rescheduleCueTriggers` + 100 ms, advance past the end: no end fires, cue still in the map; resume, advance: end fires.
- pause mid fade-in, resume: `fade` called again with the original target and the remaining time.
- in-point moved 5 s earlier while playing, `rescheduleCueTriggers`: end fires at the same absolute position, not 5 s early.
- panic, then `playCue(B)` within 500 ms, advance 600 ms: B still in the map, A's Howl unloaded; `activeGroups` empty.
- `onloaderror` on a 'stop-all' cue: the other cue keeps playing, not stopped, not ducked; toast shown; Howl unloaded.
- `onplayerror` after load on a 'duck-others' cue: the other cue's volume is restored.
- `toggleLoop` on a cue with `{ action: 'next' }`: on → loop; off → 'next' again; `howl.loop` called both times.
- custom action at 5 s, stop at 2 s, advance 10 s: action not executed.
- `applyDucking` with `duckLevel` undefined uses 0.2.
  `tests/keyboard.test.ts`: range, checkbox, button inputs → false; text, search, number inputs, textarea, select, contenteditable → true; null → false.

Typecheck: `npx nuxi prepare` then `npx -y -p typescript@5 -p vue-tsc@3 vue-tsc --noEmit -p tsconfig.json` (baseline 0 errors).

Smoke with `just dev`: the checklist in `tasks.md` §5.
