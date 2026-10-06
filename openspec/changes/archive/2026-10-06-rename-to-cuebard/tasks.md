## 1. Identity in build config

- [x] 1.1 `package.json`: `name: cuebard`, new `description`, `build.appId: com.cuebard.app`, `build.productName: CueBard`, `contributors` entry, `build.publish.repo: cuebard`; lockfile `name` fields follow
- [x] 1.2 `build.nsis.guid: 676ceb5a-270a-52c3-a72b-f1089eb9faff` with a comment that it must never change (D2)
- [x] 1.3 `build.fileAssociations`: `.cuebard` (CueBard Project) and `.cbpack` (CueBard Archive) first, then `.liveplay` and `.lpa` with their LivePlay labels
- [x] 1.4 Release name `CueBard <version>` in `build-release.yml`
- [x] 1.5 Remove `docs-site/`, `.github/workflows/deploy-docs.yml`, `setup-docs-site.ps1` and the three `guides/DOCS-SITE-*.md`

## 2. File types

- [x] 2.1 `electron/lib/file-types.js`: extension lists, `isProjectFile`, `isArchiveFile`; tests
- [x] 2.2 `main.js`: argv and `open-file` use the helper for all four extensions
- [x] 2.3 `ipc/files.js` open dialog filter: `.cuebard` + `.liveplay`
- [x] 2.4 `ipc/project.js`: export default `<name>.cbpack`, export/import filters `.cbpack` + `.lpa`, archive import finds `.cuebard` and `.liveplay` project files
- [x] 2.5 `useProject.ts`: create as `<name>.cuebard`; remember the opened/created file path and save there; clear it on close (D5). No unit test (useProject needs the whole Nuxt context); covered by the dev-app smoke in 6.2

## 3. Settings migration

- [x] 3.1 `electron/lib/legacy-data.js` `migrateLegacyData({ appData, userData, fs })` per D3, with tests on a temp folder: copies the three items, skips items already present, runs once (marker), ignores a source equal to the target, survives a copy error
- [x] 3.2 Call it from `main.js` after the single-instance lock and before `app.whenReady()`

## 4. Names and links in the app

- [x] 4.1 Window titles, `player.html`, `player-browser.html`, state viewer, `nuxt.config.ts` title, API server log line, updater User-Agent, dialog filter labels
- [x] 4.2 `RELEASE_REPO`, update modal fallback URL → `Stevesibilia/cuebard`
- [x] 4.3 About dialog: CueBard title, "Based on LivePlay by Thomas Doukinitsas" with the upstream link, licence name; new locale keys in `en` and `it`
- [x] 4.4 Locale files: product name strings → CueBard in all 21 files (`E-LivePlay`, `LivePlay`, `Enhanced LivePlay`), keeping the translation contributor credit
- [x] 4.5 Header, welcome and About `alt` texts
- [x] 4.6 Update tests that hard-code old names, extensions or the repository

## 5. Docs

- [x] 5.1 README: CueBard intro, based-on-LivePlay credit, licence note, install and download links to `Stevesibilia/cuebard`, file types and E-LivePlay upgrade notes
- [x] 5.2 AGENTS.md: repository table and commands use `Stevesibilia/cuebard`; upstream described as read-only reference
- [x] 5.3 `justfile` header comment

## 6. Verify

- [x] 6.1 `npm test`, `npm run typecheck`, `npm run build`
- [ ] 6.2 (create, open `.liveplay`, rename and save done over CDP; export and import need the native dialogs, left for the owner) Dev app: create a project (file is `.cuebard`), open a `.liveplay` copy, edit, save (same file, no `.cuebard` created), export (`.cbpack` proposed), import a `.lpa` and a `.cbpack`
- [x] 6.3 (owner confirmed the real update from E-LivePlay 1.9.0 works; first start also done for real in dev: the dev run copied `Local Storage` and `bin` from the local E-LivePlay folder and showed Italian; second start covered by unit test) Migration smoke: temp `appData` with an E-LivePlay folder holding `Local Storage`, `midi-config.json` and `bin/`; start; language and MIDI mapping carried over; second start does not copy again
- [x] 6.4 Packaged macOS build (`--dir`): name, bundle ID `com.cuebard.app`, About credit
- [x] 6.5 Release dry run on the branch: installer named `CueBard-Setup-<version>.exe`, `latest.yml` matches

## 7. Release (owner-gated)

- [x] 7.1 Owner renames the repository to `Stevesibilia/cuebard`; update the local `fork` remote URL
- [x] 7.2 Verify the old-name redirects: `api.github.com/repos/Stevesibilia/enhanced-liveplay/releases/latest` and `github.com/Stevesibilia/enhanced-liveplay/releases/latest/download/latest.yml`
- [x] 7.3 `release/v2.0.0` PR; merge publishes CueBard 2.0.0
- [x] 7.4 After release: E-LivePlay 1.9.0 (Windows or Linux) offers 2.0.0; Windows upgrades in place; settings carried over
- [x] 7.5 Owner leaves the fork network and disables GitHub Pages (repository is no longer a fork; Pages is not enabled)
