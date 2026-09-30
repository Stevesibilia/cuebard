# project-archive-import Specification

## Purpose

How an `.lpa` project archive is extracted on import: into a new folder, never over existing files, and never following unsafe archive entries.

## Requirements
### Requirement: Archive extracted into a new folder
Importing an `.lpa` archive SHALL extract it into a new subfolder of the chosen location named after the archive. If that subfolder already exists the import SHALL stop with a message and SHALL NOT write anything.

#### Scenario: Import next to an existing project
- **WHEN** the operator imports `show.lpa` into a folder that already contains `show/`
- **THEN** the import SHALL stop with a message and the existing `show/` SHALL be unchanged

### Requirement: Unsafe archive entries rejected
Extraction SHALL skip entries that are not regular files or directories (including symbolic links), SHALL abort and remove partial output when an entry would land outside the target folder, and SHALL abort when the uncompressed total exceeds twenty times the archive size or 1 GiB, whichever is larger.

#### Scenario: Archive with a symlink entry
- **WHEN** an archive contains a symbolic-link entry
- **THEN** no link SHALL be created and the other files SHALL extract

#### Scenario: Archive with a traversal entry
- **WHEN** an archive contains an entry named `../evil.txt`
- **THEN** the import SHALL fail and no file SHALL remain from it

