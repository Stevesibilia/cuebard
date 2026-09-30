# window-navigation-safety Specification

## Purpose

Keep every app window on its own page and confine the custom `local-media://` protocol to the open project, so a dropped file, an external link or a crafted media path cannot replace the UI or read outside the project.

## Requirements
### Requirement: Windows never navigate away from the app
Every app window SHALL refuse navigation to a URL outside the app's own origin and SHALL refuse to open new windows.

#### Scenario: File dropped outside a drop zone
- **WHEN** the operator drops an image file on an empty area of the main or player window
- **THEN** the window SHALL keep showing the app and nothing SHALL be imported

### Requirement: Development flag ignored in packaged builds
A packaged build SHALL ignore the `--dev` command-line flag.

#### Scenario: Launch installed app with --dev
- **WHEN** an installed build is started with `--dev`
- **THEN** it SHALL load its bundled UI, not `http://localhost:3000`

### Requirement: Custom media protocol confined to the project
The `local-media://` protocol SHALL serve only files inside the current project folder, after resolving symbolic links, and SHALL serve nothing when no project is open.

#### Scenario: Path outside the project
- **WHEN** a `local-media://` URL points outside the current project folder
- **THEN** the protocol SHALL respond not-found

