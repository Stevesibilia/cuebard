# CueBard

CueBard plays audio and visual cues for tabletop role-playing sessions and
small live events: background music, ambience and sound effects on one side,
pictures and handouts on a second screen or a tablet on the other.

CueBard is based on [LivePlay](https://github.com/tdoukinitsas/liveplay) by
Thomas Doukinitsas and was called E-LivePlay until version 1.9. It is a
separate project now: upstream LivePlay moved to a C++ audio server, CueBard
stays an Electron app with its own visual display.

## Download

Get the latest version from
[Releases](https://github.com/Stevesibilia/cuebard/releases/latest).

| System                | File                                           |
| --------------------- | ---------------------------------------------- |
| Windows               | `CueBard-Setup-<version>.exe`                  |
| macOS (Apple Silicon) | `CueBard-<version>-arm64.dmg`                  |
| macOS (Intel)         | `CueBard-<version>.dmg`                        |
| Linux                 | `CueBard-<version>.AppImage`, `.deb` or `.rpm` |

The macOS builds are not signed. On first launch, right-click the app and
choose **Open**. CueBard checks for updates at start; on Windows and Linux it
installs them for you, on macOS it opens the download page.

### Coming from E-LivePlay

- **Windows**: the update replaces E-LivePlay.
- **macOS and Linux**: CueBard installs next to E-LivePlay. Remove E-LivePlay
  when CueBard works for you.
- On first start CueBard copies your language, MIDI mapping and the downloaded
  yt-dlp from E-LivePlay. E-LivePlay's own settings are left as they are.
- Your projects open as before. A `.liveplay` project is saved back to the same
  file; new projects are saved as `.cuebard`.

## Features

**Audio**

- Playlist with nested groups, colours, trim points and waveforms.
- Start, end and ducking behaviours per cue: play next, jump to a cue, loop,
  crossfade, duck the others.
- Cart with 16 slots for instant one-shots.
- Keyboard hotkeys and MIDI mapping for cart slots, pause/resume, loop, stop
  all and master volume.
- YouTube search and import (yt-dlp and ffmpeg are bundled).

**Visuals**

- Media library for images and PDFs, published as layers with fades.
- Player window for a second monitor.
- Remote viewer: any tablet or phone on the same Wi-Fi shows the visuals in a
  browser, no app needed.

**Everything else**

- Remote control API over HTTP.
- Themes and accent colours.
- 21 interface languages; translations that are missing fall back to English.
- Projects are one JSON file plus `media/` and `waveforms/` folders; archives
  pack a whole project into one file.

## Files

| Extension   | What                 | Notes                    |
| ----------- | -------------------- | ------------------------ |
| `.cuebard`  | Project              | New projects             |
| `.cbpack`   | Project archive      | Export and import        |
| `.liveplay` | Project (E-LivePlay) | Opens and saves in place |
| `.lpa`      | Archive (E-LivePlay) | Imports                  |

Files saved by upstream LivePlay 2.5 or later are not compatible.

## Remote control API

> **Same machine only by default.** The API answers requests from the computer
> CueBard runs on (`localhost`). To trigger cues from another device, open
> **Viewer** in the composition panel and turn on **Allow remote control from
> network**. The setting is off at every start. Requests a browser sends on
> behalf of another website are always refused.

```bash
# Trigger a cue by UUID (copy the URL from the cue's Properties panel)
curl http://localhost:8080/api/trigger/uuid/<uuid>

# Trigger by position: the first item, or the second item in the first group
curl http://localhost:8080/api/trigger/index/0
curl http://localhost:8080/api/trigger/index/1,0

# Stop a cue
curl http://localhost:8080/api/stop/uuid/<uuid>

# Project name and number of top-level items
curl http://localhost:8080/api/project/info
```

## Remote viewer

1. In the composition panel, click **Viewer** and turn on **Remote viewer**
   (off by default).
2. A URL such as `http://192.168.1.42:8080/player` and a QR code appear.
3. On a tablet on the same Wi-Fi, scan the QR code or type the URL.

The player window and the remote viewer are independent; use either or both.

> **Local network only.** While it is on, anyone on the same network can see
> the project's visual media, without a password. The viewer only serves files
> from the project's `media/` folder. Turn it off when you are done.

## Development

```bash
npm ci
just dev          # Nuxt + Electron
just test         # vitest
just typecheck    # nuxt prepare + vue-tsc
just build-electron
```

Pull requests run tests and the typecheck. A version bump in `package.json`
merged to `dev` builds and publishes a release. See [AGENTS.md](AGENTS.md) for
the branch and release workflow.

## Licence and credits

CueBard is a modified version of LivePlay and, like LivePlay, is licensed under
the **GNU Affero General Public License v3.0**. See [LICENSE.txt](LICENSE.txt).

- LivePlay: Thomas Doukinitsas,
  [github.com/tdoukinitsas/liveplay](https://github.com/tdoukinitsas/liveplay)
- CueBard: Stefano Sibilia,
  [github.com/Stevesibilia/cuebard](https://github.com/Stevesibilia/cuebard)

Built with [Electron](https://www.electronjs.org/), [Nuxt](https://nuxt.com/),
[Vue](https://vuejs.org/), [Howler.js](https://howlerjs.com/),
[yt-dlp](https://github.com/yt-dlp/yt-dlp) and [FFmpeg](https://ffmpeg.org/).
