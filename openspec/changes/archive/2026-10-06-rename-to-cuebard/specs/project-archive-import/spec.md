## MODIFIED Requirements

### Requirement: Archive extracted into a new folder

Importing a project archive (`.cbpack`, or a legacy `.lpa`) SHALL extract it into a new subfolder of the chosen location named after the archive. If that subfolder already exists the import SHALL stop with a message and SHALL NOT write anything.

#### Scenario: Import next to an existing project

- **WHEN** the operator imports `show.cbpack` into a folder that already contains `show/`
- **THEN** the import SHALL stop with a message and the existing `show/` SHALL be unchanged

#### Scenario: Import a legacy archive

- **WHEN** the operator imports `show.lpa` into a folder without `show/`
- **THEN** the archive SHALL be extracted into a new `show/` folder
