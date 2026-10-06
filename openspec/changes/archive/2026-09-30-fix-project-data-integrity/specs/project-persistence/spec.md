## ADDED Requirements

### Requirement: Structural edits are saved
The system SHALL schedule a project save after every structural edit of the playlist: adding an item, removing an item, moving an item, and expanding or collapsing a group. Rapid successive edits SHALL be collapsed into one write by a single debounce shared by all components.

#### Scenario: Import then quit
- **WHEN** the operator imports an audio file into the playlist and quits the app within one second
- **THEN** the reopened project SHALL contain the imported cue

#### Scenario: Delete a cue
- **WHEN** the operator deletes a cue and no other edit follows
- **THEN** the project file on disk SHALL no longer contain that cue after the debounce interval

### Requirement: Pending save flushed before close
The system SHALL write any pending debounced save before the main window closes or the app quits, waiting at most 3 seconds for the renderer. The explicit Save command SHALL write immediately without waiting for the debounce.

#### Scenario: Quit right after an edit
- **WHEN** the operator renames a cue and quits within 500 ms
- **THEN** the reopened project SHALL show the new name

#### Scenario: Save command
- **WHEN** the operator presses Ctrl/Cmd+S
- **THEN** the project file SHALL be written without the debounce delay

### Requirement: One open path for project files
Opening a `.liveplay` file by any route (File > Open, welcome screen, file association, double-click in the OS file manager) SHALL use the same open procedure: validation, schema checks, migrations, load-time defaults, folder path derived from the file's location, main-process notification of the current project, cart-only items and waveforms restored.

#### Scenario: Double-click a project file
- **WHEN** the app is running and the operator double-clicks a `.liveplay` file in the OS file manager
- **THEN** the project SHALL open with File > Export enabled, cart slots and waveforms shown, and the remote viewer able to serve its media

### Requirement: Media import keeps existing files
Importing a media file whose name already exists in the project's `media/` folder SHALL store the new file under a free name (`name (2).ext`, `name (3).ext`, …) and SHALL NOT overwrite the existing file.

#### Scenario: Two files with the same name
- **WHEN** the operator imports two different files both named `track.mp3`
- **THEN** each cue SHALL play its own audio

### Requirement: Project file excludes waveform peaks
The saved `.liveplay` file SHALL NOT contain waveform peak data. Peaks SHALL be loaded from the project's `waveforms/` folder, or regenerated when missing.

#### Scenario: Save a project with waveforms
- **WHEN** a project whose cues have waveforms is saved
- **THEN** the `.liveplay` file SHALL contain no `waveform` key and SHALL keep each cue's `waveformPath`

#### Scenario: Waveform files missing
- **WHEN** a project is opened after its `waveforms/` folder was deleted
- **THEN** waveforms SHALL be regenerated and shown
