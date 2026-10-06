## ADDED Requirements

### Requirement: Product name

Everything a user sees SHALL name the app CueBard: window and page titles, the About dialog, menus, installer and archive file names, release names, and locale strings that name the app.

#### Scenario: Main window title and About

- **WHEN** the app starts and the operator opens About
- **THEN** the window title and the About dialog SHALL say CueBard and SHALL NOT say E-LivePlay

#### Scenario: Windows installer name

- **WHEN** a release is built for Windows
- **THEN** the installer SHALL be named `CueBard-Setup-<version>.exe`

### Requirement: Own app ID and data folder

The app SHALL use the app ID `com.cuebard.app` and SHALL keep its settings in a data folder named after CueBard, separate from any LivePlay or E-LivePlay installation.

#### Scenario: Installed beside upstream LivePlay

- **WHEN** CueBard and upstream LivePlay are installed on the same machine
- **THEN** each SHALL run with its own data folder and SHALL NOT block the other from starting

### Requirement: Settings carried over from E-LivePlay

On start, when the CueBard data folder has not been migrated before and an E-LivePlay data folder exists, the app SHALL copy the saved language (`Local Storage`), `midi-config.json` and the downloaded yt-dlp binary (`bin/`) from it, each only if CueBard has none yet. The copy SHALL happen at most once, SHALL NOT change the E-LivePlay folder, and a failure SHALL NOT stop the app from starting.

#### Scenario: First start after upgrading

- **WHEN** CueBard starts for the first time on a machine where E-LivePlay saved Italian as the language and a MIDI mapping
- **THEN** CueBard SHALL show Italian and SHALL use the same MIDI mapping

#### Scenario: Settings changed after migration

- **WHEN** the operator changes the MIDI mapping in CueBard and restarts it
- **THEN** CueBard SHALL keep the new mapping and SHALL NOT copy from E-LivePlay again

#### Scenario: No E-LivePlay folder

- **WHEN** CueBard starts on a machine that never had E-LivePlay
- **THEN** it SHALL start normally with default settings

### Requirement: Windows upgrade replaces E-LivePlay

The Windows installer SHALL use the installer GUID that E-LivePlay used (`676ceb5a-270a-52c3-a72b-f1089eb9faff`), so installing CueBard over E-LivePlay replaces it instead of adding a second app.

#### Scenario: Update from E-LivePlay 1.9.0 on Windows

- **WHEN** E-LivePlay 1.9.0 on Windows installs the CueBard update
- **THEN** only CueBard SHALL remain installed

### Requirement: Update feed in the CueBard repository

Update checks, the update dialog's download link and published releases SHALL use the GitHub repository `Stevesibilia/cuebard`.

#### Scenario: Update dialog link

- **WHEN** a newer release exists and the operator chooses the download page
- **THEN** the page opened SHALL be a release page of `Stevesibilia/cuebard`

### Requirement: Upstream attribution

The About dialog SHALL state that CueBard is based on LivePlay by Thomas Doukinitsas, link to the upstream repository, and name the AGPL-3.0 licence.

#### Scenario: About dialog credits

- **WHEN** the operator opens About
- **THEN** it SHALL show the LivePlay credit with a working link to `github.com/tdoukinitsas/liveplay` and the licence name
