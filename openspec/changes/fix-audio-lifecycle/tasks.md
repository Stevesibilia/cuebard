Each numbered group is one commit. Every commit leaves `npx vitest run` green. Commit messages: Conventional Commits, no issue references, trailers exactly as in the brief. In a fresh checkout run `npx nuxt prepare` before vitest.

## 1. Engine: Howl release, teardown, panic (D1, D2, D5, D7, D15 harness)

- [ ] 1.1 `vitest.config.ts` `define` for `import.meta.client`; `tests/audio-engine.test.ts` harness (FakeHowl with `Howler._howls`, stubbed `useState`/`useProject`/`useToast`/`useLocalization`, fake timers); port `tests/finalize-cue.test.ts` cases and delete it
- [ ] 1.2 `markRaw(howl)`; `finalizeCue` unloads; tests: Howl leaves `Howler._howls` on natural end, `stopCue`, `stopAllCues`
- [ ] 1.3 `stopAllCues` clears `activeGroups`; `closeProject` and `openProject` call `stopAllCues()` (D2)
- [ ] 1.4 `panicStop` snapshot + immediate removal + `activeGroups.clear()` (D5); test: cue started in the window survives
- [ ] 1.5 Custom actions scheduled in `scheduleCueTriggers`, cleared by `cancelCueTriggers`; `scheduleCustomActions` removed (D7); test: stop before time point → not executed

## 2. Engine: scheduling, fades, failures, ducking level (D3, D4, D6, D9, D14)

- [ ] 2.1 `scheduleCueTriggers` recomputes duration from the live item and `cue.fileDuration`; returns early when paused; comment on the sprite limit (D3); tests: pause + seek / loop / reschedule → no end; in-point edit → same absolute end
- [ ] 2.2 `fadeCue` helper, `fade` / `pausedFade`, resume continues the fade (D4); test
- [ ] 2.3 `useToast.ts`, `ToastHost.vue` in `app.vue`, `audio.mediaError` in every locale (Italian in `it.json`) (D14)
- [ ] 2.4 Ducking moved to `onload`; error handlers and `catch` blocks use `finalizeCue` + `notifyCueError` (D6); tests: load error leaves other cue untouched; play error restores ducked volume
- [ ] 2.5 `DEFAULT_DUCK_LEVEL`; engine fallback; `PropertiesPanel` seeds the level on mode change and the dB getter falls back (D9); test

## 3. Control surfaces (D8, D10, D11)

- [ ] 3.1 Engine `toggleLoop` with module-scope `endBehaviorBeforeLoop`; hotkey and MIDI toggle-loop call it (D8); test
- [ ] 3.2 `app/utils/keyboard.ts` `isTextEntryElement` + `tests/keyboard.test.ts`; hotkeys use it; `e.repeat` ignored except volume up/down (D10)
- [ ] 3.3 `useControlSurfaces.ts` (hotkeys, MIDI, API trigger/stop) mounted from `app.vue`; removed from `MainWorkspace.vue` and `CartPlayer.vue`; MIDI `unmount` clears `onstatechange`; MIDI handler ignores input with no project unless learning (D11)

## 4. Listener lifetimes (D12, D13)

- [ ] 4.1 `electron/preload.js` `subscribe` helper, every `on*` returns a remover, `remove*ProgressListener` removed; `global.d.ts` `Unsubscribe` return types
- [ ] 4.2 `useWorkspaceListeners` returns an unsubscribe; `MainWorkspace.vue` registers in `onMounted`, unsubscribes in `onUnmounted`; export and import progress listeners removed in `finally`
- [ ] 4.3 `WelcomeScreen.vue`, `UpdateModal.vue`, `RemoteViewerControl.vue` unsubscribe on unmount
- [ ] 4.4 `useVisualDisplay.ts` `pendingTimers` at module scope (D13)

## 5. Verify and hand back

- [ ] 5.1 `npx vitest run` — paste the summary line
- [ ] 5.2 Typecheck: `npx nuxi prepare` then `npx -y -p typescript@5 -p vue-tsc@3 vue-tsc --noEmit -p tsconfig.json`; baseline on `dev` is 0 errors
- [ ] 5.3 Smoke with the dev app (`just dev`, or the CDP launch in the brief), pass/fail per line:
  1. Play and let 50 cues end naturally (a short test file, or a group chain): `Howler._howls.length` in DevTools stays small (≤ the cues currently playing + a few)
  2. Play a cue, close the project: audio stops. Same with File > Open of another project while playing
  3. Pause a cue, drag its stop-fade slider and click its progress bar, wait past its end time: it stays paused; resume: it ends normally and its end behaviour runs
  4. Pause during a 5 s fade-in, resume: the fade completes to the cue's volume
  5. Panic while A plays, fire B within half a second: B keeps playing
  6. Rename a cue's media file on disk, trigger it while another cue plays: error toast names the file; the other cue is neither stopped nor ducked
  7. Switch to the Media tab, close the cart, enter minimal mode: a cart hotkey and (if a MIDI device is available; otherwise say so) a MIDI binding still trigger in each
  8. Click the master slider, press a cart key: the cue plays. Hold a cart key: it toggles once
  9. Close and reopen a project three times, then Ctrl+S and File > Export: one save, one export dialog; Menu > Open on the welcome screen: one dialog
  10. Toggle loop (hotkey) on a cue whose end behaviour is "next", toggle again: end behaviour is "next"
  11. Switch a playlist cue to "Duck others": the level shows a number, not "NaN dB", and ducking works
- [ ] 5.4 Push `fix/audio-lifecycle` to `fork`, hand back to the architect. Do not open the PR.
