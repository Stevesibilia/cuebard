Each numbered group is one commit. Every commit leaves `npx vitest run` green. Commit messages: Conventional Commits, no issue references, trailers exactly as in the brief.

## 1. Tree moves and default factories (D1, D2)

- [x] 1.1 Add `app/utils/tree.ts` with `findPathToUuid`, `isSelfOrDescendant`, `normalizeMoveSet`, `canDropOnto`
- [x] 1.2 Use them in `PlaylistItem.vue` `handleDrop`: normalise the move set, return early with no mutation when the drop is not allowed
- [x] 1.3 Replace `DEFAULT_AUDIO_ITEM` / `DEFAULT_CART_AUDIO_ITEM` / `DEFAULT_GROUP_ITEM` with `createDefault*()` factories; update every caller; decide `DEFAULT_GLOBAL_KEY_BINDINGS` / `DEFAULT_CART_SLOT_KEYS` per D2 and note the decision in the commit body
- [x] 1.4 Tests `tests/tree.test.ts` (drop onto self, onto child, onto grandchild refused; sibling allowed; group+child moves child once) and `tests/defaults.test.ts` (two factory results share no nested object)

## 2. Saving (D3, D4)

- [x] 2.1 `addItem`, `removeItem`, `toggleExpand` schedule `saveProject()`
- [x] 2.2 Module-scope save timer; `saveNow()`; `menu-save-project` calls `saveNow()`
- [x] 2.3 Close handshake: `electron/windows.js` main-window `close` listener with 3000 ms timeout, `electron/preload.js` `onBeforeClose` / `notifyFlushed`, types, renderer listener registered once in `useMenuListeners.ts`
- [x] 2.4 Test the timer sharing if it can be done without Nuxt runtime (e.g. extract the debounce into `app/utils/debouncedSaver.ts` with an injected writer and test it with fake timers); otherwise state in the hand-back why it is covered by smoke only

## 3. Opening and file format (D5, D6, D7, D9)

- [x] 3.1 `openFile` in `electron/main.js` sends `{ filePath }` only; `useMenuListeners.ts` closes the open project and calls `openProject(filePath)`, error shown as File > Open does
- [x] 3.2 `normalizeProject` and `checkSchemaCompat` in `migrations.ts`; wire into `openProject`; `runMigrations` never lowers the version; defensive `theme` reads in `app.vue` and `useMenuListeners.ts`
- [x] 3.3 i18n key `project.newerVersion` in every locale file (English text; Italian in `it.json`)
- [x] 3.4 `serializeProject` in `app/utils/projectSerialize.ts`; `saveProjectImmediate` uses it
- [x] 3.5 Tests in `tests/migrations.test.ts` (missing `theme`/`cartItems`/`cartOnlyItems` defaulted; newer version refused; version never lowered) and `tests/project-serialize.test.ts` (no `waveform` key at any depth incl. `cartOnlyItems`; `waveformPath` kept; round-trips)
- [x] 3.6 `outPointAfterDuration` helper used at the three waveform-arrival sites (moved from group 4 so the group 3 commit does not wipe trims on reopen)
- [x] 3.7 Extend `loadWaveformsAsync` to `cartOnlyItems`

## 4. Media, cart and visuals (D8, D10, D11, D12, D13)

- [x] 4.1 `copy-file` `{ noOverwrite: true }` with `COPYFILE_EXCL` retry and `nextFreeName` in `electron/lib/`; audio import in `PlaylistView.vue` and `CartSlot.vue` uses it and stores the returned name
- [x] 4.3 `app/utils/cart.ts` `planCartPush` + `CART_SLOT_COUNT`; `CartSlot.vue` and `CartPlayer.vue` use them
- [x] 4.4 `clearAll()` + empty push to outputs in `closeProject` and at the start of `openProject`
- [x] 4.5 `DisplayLayer.fitted`; `onImageLoad` skips fitted and background layers; remove `autoFitted`; sync only on change
- [x] 4.6 Tests: `nextFreeName`, `outPointAfterDuration`, `planCartPush` (gap stops the shift; full row returns `null`; never returns a slot ≥ 16)

## 5. Verify and hand back

- [x] 5.1 `npx vitest run` — paste the summary line
- [x] 5.2 `npx nuxi typecheck` if it runs in this repo; if it fails on errors that exist on `dev` too, say so and list only new errors
- [x] 5.3 `just dev` smoke, each item from `specs/*/spec.md` scenarios that can be done by hand; report pass/fail per line (the checklist is in the brief)
- [x] 5.4 Push `fix/data-integrity` to `fork`, hand back to the architect. Do not open the PR.
