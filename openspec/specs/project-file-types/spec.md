# project-file-types Specification

## Purpose

Which file extensions CueBard saves, opens, imports and registers (`.cuebard` and `.cbpack`, plus the legacy `.liveplay` and `.lpa`), and that a project is saved back to the file it was opened from.

## Requirements

### Requirement: CueBard file types for new files

A new project SHALL be saved as `<name>.cuebard`, and exporting a project SHALL offer `<name>.cbpack` as the archive name.

#### Scenario: Create a project

- **WHEN** the operator creates a project named "Session 12" in a folder
- **THEN** the folder SHALL contain `Session 12.cuebard`

#### Scenario: Export a project

- **WHEN** the operator exports the open project
- **THEN** the save dialog SHALL propose `<project name>.cbpack`

### Requirement: Legacy file types still open

The app SHALL open `.liveplay` projects and import `.lpa` archives everywhere it opens `.cuebard` projects and imports `.cbpack` archives: the open and import dialogs, double-click and command-line launch, and project files found inside an imported archive.

#### Scenario: Open an E-LivePlay project

- **WHEN** the operator opens `show.liveplay` from the Open Project dialog
- **THEN** the project SHALL load as it did in E-LivePlay

#### Scenario: Import an E-LivePlay archive

- **WHEN** the operator imports `show.lpa` that contains `show.liveplay`
- **THEN** the project SHALL be extracted and opened

#### Scenario: Double-click a project file

- **WHEN** the operator double-clicks a `.cuebard` or `.liveplay` file
- **THEN** CueBard SHALL open that project

### Requirement: Project saved to the file it was opened from

Saving SHALL write to the file the project was opened from or created as, whatever its extension and whatever the project's current name.

#### Scenario: Save an opened legacy project

- **WHEN** the operator opens `show.liveplay`, edits it and saves
- **THEN** `show.liveplay` SHALL contain the changes and no `.cuebard` file SHALL be created

#### Scenario: Rename a project

- **WHEN** the operator renames the open project and saves
- **THEN** the change SHALL be written to the same file and no second project file SHALL be created

### Requirement: File associations

Installers SHALL register `.cuebard` and `.cbpack` as CueBard files and SHALL also register `.liveplay` and `.lpa`.

#### Scenario: Associations after install

- **WHEN** CueBard is installed on Windows or macOS
- **THEN** the system SHALL list CueBard as an app for all four extensions
