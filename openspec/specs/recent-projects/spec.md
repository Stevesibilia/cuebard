# recent-projects Specification

## Purpose

The list of recently opened projects on the welcome screen: what it shows, where it is kept, and how missing files and old entries are dropped.

## Requirements

### Requirement: Recent projects on the welcome screen

The welcome screen SHALL list up to eight recently opened or created projects, most recent first, each with its name, path and when it was last opened. Choosing one SHALL open it the same way as Open project.

#### Scenario: Reopen yesterday's session

- **WHEN** the operator opened `Session 11.cuebard` yesterday and starts CueBard today
- **THEN** the welcome screen SHALL list "Session 11" first and clicking it SHALL open that project

#### Scenario: No history

- **WHEN** CueBard starts for the first time
- **THEN** the welcome screen SHALL show New project and Open project and no recent list

### Requirement: The recent list is kept per app and pruned

The list SHALL be stored in the app's data folder (not in any project), SHALL hold each path once, and SHALL drop entries whose file no longer exists when the list is shown.

#### Scenario: Project file deleted

- **WHEN** a listed project file has been deleted
- **THEN** it SHALL not appear in the list and SHALL be removed from the stored list

#### Scenario: Ninth project

- **WHEN** a ninth different project is opened
- **THEN** the oldest entry SHALL be dropped
