## ADDED Requirements

### Requirement: Filter the playlist by cue name

A search field in the workspace toolbar SHALL filter the playlist to cues whose name contains the typed text, ignoring case. A group SHALL stay visible when its own name matches (with all its children) or when one of its descendants matches (with only the matching descendants). Clearing the field SHALL show the full playlist.

#### Scenario: Find a cue inside a group

- **WHEN** the operator types "drone" and "Crypt drone" is inside the group "Act 2"
- **THEN** the playlist SHALL show "Act 2" with only "Crypt drone" under it

#### Scenario: Clear with Esc

- **WHEN** the search field has focus and the operator presses Esc
- **THEN** the field SHALL be cleared and no cue SHALL stop

### Requirement: Filtering changes only what is shown

Filtering SHALL NOT change indices, the project file, selection, drag and drop targets, playback, end behaviours, hotkeys outside the field, MIDI or the HTTP API.

#### Scenario: Index trigger while filtered

- **WHEN** a filter hides cue `1,0` and the API triggers index `1,0`
- **THEN** that cue SHALL play
