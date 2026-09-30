## ADDED Requirements

### Requirement: Newer schema refused
The system SHALL refuse to open a project whose `schemaVersion` is greater than the version this build supports, SHALL tell the operator to update the app, and SHALL NOT modify the file. Migrations SHALL never lower a file's `schemaVersion`.

#### Scenario: File from a newer build
- **WHEN** the operator opens a `.liveplay` whose `schemaVersion` is higher than the current build's
- **THEN** the project SHALL NOT open, a message SHALL say it was saved by a newer version, and the file SHALL be unchanged on disk

### Requirement: Load-time defaults for optional fields
On every load, after migrations, the system SHALL supply defaults for missing optional top-level fields without bumping the schema version: `theme` (default theme), `cartItems` (empty), `cartOnlyItems` (empty), `visualDisplayEnabled` (true).

#### Scenario: File without a theme
- **WHEN** the operator opens a project file that has no `theme` key (for example one saved by upstream LivePlay 2.5)
- **THEN** the project SHALL open with the default theme
