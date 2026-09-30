## ADDED Requirements

### Requirement: Guard resolves links and roots
The path guard SHALL resolve symbolic links on both the project folder and the requested path (for a path that does not exist yet, on its nearest existing ancestor) before checking containment, and SHALL accept paths inside a project located at a filesystem root.

#### Scenario: Symlink escaping the project
- **GIVEN** a project folder containing a symbolic link that points outside it
- **WHEN** a handler is asked for a path through that link
- **THEN** the guard SHALL return `null`

#### Scenario: Project at a filesystem root
- **GIVEN** a project file at `/show.liveplay`
- **WHEN** the guard is called with `/media/song.mp3`
- **THEN** it SHALL return the resolved path

### Requirement: Visual media, waveform and export handlers guarded
The `read-visual-media`, `delete-visual-media`, `import-visual-media` (destination), `generate-waveform` (input and output) and `export-project` (source folder) handlers SHALL apply the path guard for the current project and SHALL fail without touching the filesystem when it rejects.

#### Scenario: Delete outside the project
- **GIVEN** a project is loaded
- **WHEN** the renderer requests `delete-visual-media` for a path outside the project folder
- **THEN** the handler SHALL return `success: false` and SHALL NOT delete anything

### Requirement: Shell handlers restricted
`open-folder` SHALL open only existing directories. `open-external` SHALL open only `http:`, `https:` and `mailto:` URLs.

#### Scenario: Open an executable as a folder
- **WHEN** the renderer calls `open-folder` with a path to a file
- **THEN** nothing SHALL be opened and the call SHALL return `success: false`

#### Scenario: External file URL
- **WHEN** the renderer calls `open-external` with a `file:` URL
- **THEN** nothing SHALL be opened
