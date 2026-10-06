## Why

CueBard 2.0.0 shipped a new name and logo on top of the old LivePlay interface: oversized panic button, a toolbar that wraps, truncated cue names, a saturated indigo selection, controls spread across six property tabs, and a composition canvas squeezed between three columns. The owner approved a restyle (mockups in `mockups/`) so the new identity also shows in the interface, and wants it built in steps by several implementers, released as 2.1.0, followed by a README with new screenshots.

## What Changes

- **Design tokens**: new surface, text, control, size, radius and font tokens for all four themes in `main.scss`; every component uses tokens instead of colour literals. Bundled fonts IBM Plex Mono (times, keys) and Bricolage Grotesque (wordmark only); unused Inter and duplicate font folders removed.
- **Header**: logo mark and wordmark, project name, silence warning as a chip, remote viewer status, clock.
- **Now-playing strip**: compact Stop all, cards for active cues with remaining time as the main number, master fader and meter.
- **One toolbar row**: Audio/Visuals switch, a cue search that filters the playlist (new), Import audio, YouTube, New group; on the Visuals tab, the composition actions.
- **Playlist and cart**: 40 px rows with readable behaviour chips and clear playing/paused/selected states; compact cart cards with key caps.
- **Properties drawer**: three tabs instead of six (Playback, Behaviour, Details); start and end targets chosen from a cue list instead of a typed UUID (**behaviour change**).
- **Visuals tab**: the composition canvas gets all remaining space; library, folders and visual properties share one collapsible column.
- **Welcome screen** with a **recent projects** list (new); minimal mode and every dialog restyled.
- **README** rewritten with new screenshots taken by a script.
- No feature is removed: `coverage.md` lists every feature of 2.0.0 and where it lives in the new layout.

## Capabilities

### New Capabilities

- `recent-projects`: the recent projects list on the welcome screen and how it is kept.
- `playlist-search`: filtering the playlist by cue name.
- `properties-drawer`: the cue properties as three tabs, and choosing behaviour targets from a list.
- `visuals-workspace`: the layout rules of the Visuals tab (canvas size, shared side column).

### Modified Capabilities

- `theme-tokens`: adds surface, text, size, radius and font tokens that every theme defines.

## Impact

- Renderer: `app/assets/styles/main.scss`, `nuxt.config.ts`, nearly every component in `app/components/`, new composables `usePlaylistActions`, `usePlaylistFilter`, `useRecentProjects`, changes in `useProject.ts`, `useProjectDialogs.ts`.
- Main process: recent projects IPC in `electron/ipc/misc.js`, `electron/preload.js`, `app/types/global.d.ts`, `app/types/ipc.ts`.
- Locales: new keys in `locales/en.json` and `locales/it.json` (Italian stays complete).
- Dependencies: `@fontsource/ibm-plex-mono`, `@fontsource-variable/bricolage-grotesque` (dev dependencies, bundled by Vite).
- Docs: README, `docs/screenshots/`, `scripts/take-screenshots.mjs`; old `public/screenshots/` removed.
- Released as 2.1.0 through the new `dev` → `main` flow after step 6; README follows as step 7.
