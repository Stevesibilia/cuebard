## Why

E-LivePlay has been a separate project from upstream LivePlay since May 2026: upstream moved audio and the project file into a C++ server, while this app is Electron + Howler with its own visual display, remote viewer, themes and release pipeline. Project files no longer round-trip between the two, yet both apps share the same app ID (`com.liveplay.app`), file types and product name family, so on one machine they share a settings folder, a single-instance lock and the `.liveplay`/`.lpa` double-click association. Renaming to **CueBard** gives the app its own identity before it is detached from the GitHub fork network.

## What Changes

- **BREAKING** Product name E-LivePlay → CueBard everywhere users see it: window titles, About, menus, installers, release names, locale strings. The About dialog credits upstream LivePlay by Thomas Doukinitsas (AGPL-3.0 attribution).
- **BREAKING** App ID `com.liveplay.app` → `com.cuebard.app`; npm package name `e-liveplay` → `cuebard`. The data folder moves with the name (`…/E-LivePlay` → `…/CueBard`).
- Settings migration: on first launch, CueBard copies the saved language, MIDI mapping and the downloaded yt-dlp binary from the E-LivePlay data folder when its own folder has none.
- Windows in-place upgrade: the NSIS installer keeps the E-LivePlay installer GUID, so updating from E-LivePlay 1.9.0 replaces the old app instead of installing beside it.
- New file types: projects save as `.cuebard`, archives export as `.cbpack`. CueBard still opens `.liveplay` and imports `.lpa`, and both old and new types are registered as file associations.
- A project is saved back to the file it was opened from, so an opened `.liveplay` stays `.liveplay` (today the path is rebuilt from the folder and project name).
- Update feed and links point at the renamed repository `Stevesibilia/cuebard`. GitHub redirects the old name, which is how E-LivePlay 1.9.0 finds the first CueBard release.
- Removed: `docs-site/`, `deploy-docs.yml`, `setup-docs-site.ps1` (upstream's site, only deployed from `main`). README and GitHub releases are the documentation.
- Version 2.0.0.

## Capabilities

### New Capabilities
- `app-identity`: product name, app ID, data folder and its migration from E-LivePlay, Windows upgrade path, update feed repository, upstream attribution.
- `project-file-types`: which extensions CueBard saves, opens, imports and registers, and that a project is saved back to the file it was opened from.

### Modified Capabilities
- `project-archive-import`: archives are `.cbpack` or legacy `.lpa`; requirements that name `.lpa` cover both.

## Impact

- `package.json` (`name`, `description`, `build.appId`, `productName`, `fileAssociations`, `nsis.guid`, `publish.repo`), lockfile name fields.
- Main process: `electron/main.js` (argv and `open-file` extensions, settings migration before ready), `ipc/files.js` and `ipc/project.js` (dialog filters, archive extension, project file lookup in archives), `windows.js`, `api-server.js`, `updater.js`, `lib/release-info.js`, `player.html`, `player-browser.html`.
- Renderer: `useProject.ts` (new extension, remember the opened file path), `AboutModal.vue`, `UpdateModal.vue`, header/welcome alt texts, `nuxt.config.ts` title, all 21 locale files.
- CI: release name in `build-release.yml`; `deploy-docs.yml` removed.
- Tests that hard-code the old names and extensions.
- GitHub: repository rename, then leaving the fork network (manual, by the owner).
- Users: macOS and Linux get a new app next to E-LivePlay (remove the old one by hand); Windows upgrades in place. On macOS, E-LivePlay 1.9.0 offers the download page, as for any update.
