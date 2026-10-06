## ADDED Requirements

### Requirement: Cue properties in three tabs

The properties drawer SHALL show the selected audio cue in three tabs: Playback (volume, trim, fades, zoom, Trim silence, Normalize), Behaviour (start, end and ducking behaviours) and Details (name, colour, file, duration, trigger URL, UUID and index). A selected group SHALL show Behaviour and Details only. Every control of the six 2.0.0 tabs SHALL be reachable in these three.

#### Scenario: Group selected

- **WHEN** the operator selects a group
- **THEN** the drawer SHALL show the Behaviour and Details tabs and no Playback tab

#### Scenario: Switching cues keeps the tab

- **WHEN** the Behaviour tab is open and the operator selects another audio cue
- **THEN** the drawer SHALL stay on Behaviour

### Requirement: Behaviour targets are chosen from a list

For "Play a cue" and "Go to a cue" the drawer SHALL let the operator pick the target from a list of cues and groups, and SHALL show the chosen target by colour, name and index. A target that no longer exists SHALL be shown as missing. Index targets SHALL still be typed as comma-separated numbers.

#### Scenario: Pick a target

- **WHEN** the operator sets "When it ends" to "Go to a cue" and picks "Victory fanfare"
- **THEN** the cue's end behaviour SHALL target that cue's UUID and the drawer SHALL show "Victory fanfare" with its index

#### Scenario: Target deleted

- **WHEN** the targeted cue is deleted
- **THEN** the drawer SHALL show the target as missing
