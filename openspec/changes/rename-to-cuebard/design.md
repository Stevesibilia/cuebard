## Context

The app ships as E-LivePlay 1.9.0 from `Stevesibilia/enhanced-liveplay`, a GitHub fork of `tdoukinitsas/liveplay`. Identity is spread over:

- `package.json`: `name: e-liveplay`, `build.appId: com.liveplay.app`, `build.productName: E-LivePlay`, file associations for `.liveplay` and `.lpa`, `build.publish.repo: enhanced-liveplay`, `nsis.artifactName`.
- Electron derives the data folder from the app name: packaged builds use `productName` (`E-LivePlay`), dev runs use the npm `name` (`e-liveplay`). On macOS both are the same folder (case-insensitive file system); on Linux they differ.
- The data folder holds the renderer's `Local Storage` (the only key is `liveplay-locale`), `midi-config.json`, and `bin/` with the downloaded yt-dlp binary.
- electron-builder derives the Windows installer GUID from the app ID: `UUID.v5(appId, 50e065bc-3134-11e6-9bab-38c9862bdaf3)`. For `com.liveplay.app` that is `676ceb5a-270a-52c3-a72b-f1089eb9faff`. The GUID is the uninstall registry key, so it decides whether a new installer upgrades or installs beside.
- E-LivePlay 1.9.0's updater reads `app-update.yml` (repo `enhanced-liveplay`) and the fallback calls the GitHub API for `Stevesibilia/enhanced-liveplay`.
- `useProject.ts` rebuilds the save path as `${folderPath}/${name}.liveplay` on every save, instead of remembering the file it opened.

## Goals / Non-Goals

**Goals:**
- One name, CueBard, in everything a user sees, with upstream credited.
- An app ID and data folder that no longer collide with upstream LivePlay.
- E-LivePlay 1.9.0 users reach CueBard through the normal update path and keep their language, MIDI mapping and yt-dlp download.
- New projects and archives use CueBard's own extensions; every existing project and archive keeps working.

**Non-Goals:**
- New logo or icon artwork. The current icons carry no text and stay.
- Renaming internal identifiers: IPC channel names (`open-lpa-file`, `importLpaFile`), the `liveplay-locale` storage key, icon file names, the project JSON schema. They are invisible to users and renaming them adds risk without benefit.
- Converting existing `.liveplay` files to `.cuebard`.
- Translating the other 19 locales beyond replacing the product name.
- Detaching the GitHub fork network (done by the owner in the GitHub UI after the release).

## Decisions

### D1. Names
`productName: CueBard`, npm `name: cuebard`, `appId: com.cuebard.app`, description "CueBard: audio and visual cues for tabletop sessions and live events". Window titles, the HTML titles, release names and the API server log line use "CueBard". The Windows installer becomes `CueBard-Setup-<version>.exe` through the existing `nsis.artifactName` template.

### D2. Windows in-place upgrade by pinning the old GUID
Set `build.nsis.guid: 676ceb5a-270a-52c3-a72b-f1089eb9faff`. The CueBard installer then finds the E-LivePlay uninstall entry and replaces that installation. *Alternative*: let the GUID follow the new app ID; E-LivePlay would stay installed beside CueBard and both would register the same file types. Rejected: the update would look like a second app appearing.
The GUID is pinned permanently; changing it later would repeat the problem.

### D3. Settings migration in the main process, before the window opens
`electron/lib/legacy-data.js` exports a pure-ish `migrateLegacyData({ appData, userData, fs })`:
- Candidate sources, first that exists: `appData/E-LivePlay`, `appData/e-liveplay` (Linux dev).
- Skip entirely when `userData/.legacy-data-migrated` exists, or when the source is the same folder as `userData` (realpath compare).
- Copy each of `Local Storage/`, `midi-config.json`, `bin/` only when the target lacks it (`fs.cpSync` recursive). Never delete or modify the source.
- Write the marker afterwards, also when nothing was copied, so the copy happens at most once.
- Errors are logged and never stop start-up.
Called from `main.js` right after the single-instance lock is acquired and before `app.whenReady()`, so Chromium has not opened `Local Storage` yet. *Alternative*: `app.setName('E-LivePlay')` to keep the old folder. Rejected: it keeps the collision with upstream's data folder that this change removes.

### D4. File types
- Save new projects as `<name>.cuebard`; export archives as `<name>.cbpack`.
- Open dialog filter: `.cuebard` and `.liveplay`; import and export filters: `.cbpack` and `.lpa` (export defaults to `.cbpack`).
- Archive import finds project files ending in either `.cuebard` or `.liveplay`.
- `main.js` treats `.cuebard`/`.liveplay` as projects and `.cbpack`/`.lpa` as archives (argv and `open-file`).
- `build.fileAssociations` lists all four, new ones first; legacy ones keep their "LivePlay Project/Archive" labels so Finder/Explorer stay truthful.
- One helper, `electron/lib/file-types.js`, holds the extension lists and `isProjectFile` / `isArchiveFile`, so the main process does not repeat string checks. The renderer only needs the new project extension constant.

### D5. Save back to the opened file
`useProject` keeps the path it opened or created (module-level, not written into the project JSON) and saves there. A legacy `.liveplay` therefore stays `.liveplay`, and renaming a project inside the app no longer writes a second file. Closing a project clears the path. *Alternative*: keep rebuilding the path, with the new extension. Rejected: opening and saving an old project would leave the `.liveplay` stale and create a `.cuebard` next to it.

### D6. Repository and update feed
`build.publish.repo`, `RELEASE_REPO`, the update modal fallback link and the About link point at `Stevesibilia/cuebard`. The repository is renamed on GitHub before the release PR is merged; GitHub redirects git, web and API requests for the old name, which is what E-LivePlay 1.9.0's updater and fallback use. *Alternative*: keep the old repository name. Rejected by the owner.

### D7. Attribution
About shows "Based on LivePlay by Thomas Doukinitsas" with the upstream link, and the licence (AGPL-3.0). `package.json` `author` stays Thomas Doukinitsas and a `contributors` entry is added for the fork's maintainer. README states that CueBard is a modified version of LivePlay, under the same licence.

### D8. Docs site removed
Delete `docs-site/`, `.github/workflows/deploy-docs.yml` and `setup-docs-site.ps1`. GitHub Pages for the repository is disabled by the owner. README plus GitHub releases replace it.

### D9. Version 2.0.0
The name, app ID, data folder and file types change, which users notice; a major version marks that. The updater compares semver only, so 1.9.0 → 2.0.0 is offered normally.

## Risks / Trade-offs

- [GitHub redirect for the old repository name stops working (for example if a new repository is created with the old name)] → never reuse `enhanced-liveplay`; the release notes and README give the new URL; users can always download by hand.
- [electron-updater's GitHub provider does not follow the API redirect] → verify before relying on it: after renaming, request the old API URL and the old `releases/latest/download/latest.yml` and confirm they resolve; if not, publish one last E-LivePlay 1.9.1 from the old name pointing at the new repository.
- [Pinned GUID with a new product name leaves the old Start-menu shortcut or install folder name] → NSIS uninstalls the previous version during upgrade; check on a Windows machine before announcing.
- [Copying `Local Storage` while E-LivePlay is running copies an inconsistent database] → only the language is stored there; worst case the language falls back to the system locale.
- [macOS and Linux users end up with two apps] → release notes tell them to remove E-LivePlay.
- [Both CueBard and upstream LivePlay claim `.liveplay`] → the last installed app wins the double-click; opening from inside either app always works.

## Migration Plan

1. Merge the change on a branch; CI and a release dry run must pass.
2. Rename the repository to `Stevesibilia/cuebard`; update the local `fork` remote URL; verify the old-name redirects (see risks).
3. Merge the `release/v2.0.0` PR; CI publishes CueBard 2.0.0.
4. Check: E-LivePlay 1.9.0 on Windows or Linux offers 2.0.0; Windows upgrades in place; settings are carried over.
5. Owner leaves the fork network and disables GitHub Pages.

Rollback: before step 3, revert the merge. After a release, a fix-forward 2.0.1 is the only option; the GUID and app ID must not be changed back.

## Open Questions

- None blocking. Whether to add a new icon set is left for later.
