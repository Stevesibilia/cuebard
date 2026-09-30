## Why

A code review of `dev` @ 88f9deb (issue #77) found bugs in cue playback and in the control surfaces that drive it. Some of them can bite mid-session: Howls are never released, so audio elements pile up until a late cue does nothing; closing a project leaves audio playing that not even Panic can stop; a paused cue "ends" on its own after a slider drag and starts the next cue; MIDI and hotkeys stop working on the Media tab, with the cart closed and in minimal mode; and every close/reopen adds another copy of the menu and API listeners, so one Ctrl+S saves N times and Menu > Open shows N dialogs. A missing media file silently leaves the other cues ducked or stopped.

## What Changes

- Every Howl the engine creates SHALL be released (`unload`) when its cue ends, fails, is stopped, panicked or torn down with the project.
- Closing a project, or opening another one, SHALL stop all cues and clear group progress.
- A paused cue SHALL NOT have its end, crossfade, stop-fade or custom-action timers armed by seek, loop toggle or property edits; resume re-arms them.
- A fade interrupted by pause SHALL continue for its remaining time on resume.
- Editing in/out points on a playing cue SHALL reschedule from the new trimmed duration.
- Panic SHALL stop only the cues playing when it was pressed, and SHALL clear group progress.
- A cue whose media fails to load or play SHALL leave the other cues untouched (no ducking, no stop-all), release its Howl and show an error toast naming the file.
- Custom-action timers SHALL be owned by the cue and cancelled with its other timers.
- Toggle-loop (keyboard and MIDI) SHALL go through one engine function that restores the previous end behaviour and syncs the playing Howl.
- Cart hotkeys SHALL work while a slider, checkbox or button has focus, SHALL still be blocked in text entry, and a held key SHALL NOT retrigger (volume keys excepted).
- "Duck others" SHALL always have a level (default 0.2 linear, about −14 dB).
- Cart hotkeys, MIDI and the remote-control API trigger/stop listeners SHALL be active in every workspace view while a project is open, including minimal mode.
- Every renderer IPC `on*` subscription SHALL return an unsubscribe function, and components SHALL unsubscribe when they unmount.
- Visual reveal timers SHALL be shared across `useVisualDisplay()` callers so project close cancels them.

## Capabilities

### New Capabilities

- `renderer-ipc-listeners`: lifetime of renderer subscriptions to main-process events.

### Modified Capabilities

- `cue-playback`: Howl release, project teardown, pause-safe scheduling, fade resume, trim edits, panic scope, load/play failure, custom-action timers, loop toggle, ducking level.
- `cart-hotkeys`: focus rule, key repeat, active in every workspace view.
- `midi-mapping`: active in every workspace view.

## Impact

- Renderer: `app/composables/useAudioEngine.ts`, `useProject.ts`, `useCartHotkeys.ts`, `useMidiController.ts`, `useWorkspaceListeners.ts`, `useImportExport.ts`, `useVisualDisplay.ts`, new `useToast.ts`, new `useControlSurfaces.ts`, new `useProjectDialogs.ts`, new `app/utils/keyboard.ts`; components `app.vue`, `MainWorkspace.vue`, `CartPlayer.vue`, `WelcomeScreen.vue`, `UpdateModal.vue`, `RemoteViewerControl.vue`, `PropertiesPanel.vue`, new `ToastHost.vue`; `app/types/project.ts`, `app/types/global.d.ts`; locale files.
- Main process: `electron/preload.js` only.
- Tests: new `tests/audio-engine.test.ts` against the real engine (replaces `tests/finalize-cue.test.ts`), `tests/keyboard.test.ts`; `vitest.config.ts` gets a `define`.
- No project file schema change.
