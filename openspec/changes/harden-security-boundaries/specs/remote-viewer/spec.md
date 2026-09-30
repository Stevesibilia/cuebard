## MODIFIED Requirements

### Requirement: Media streamed over HTTP
The system SHALL stream local media files to remote clients over HTTP so images referenced in `displayState` are viewable in a browser that cannot resolve the `local-media://` protocol. The display state sent to remote viewers SHALL reference media by path relative to the project folder. The server SHALL serve only files inside the project's `media/` folder after resolving symbolic links, and only file types the player can display.

#### Scenario: Image layer resolves in a remote browser
- **WHEN** the viewer page renders an image layer
- **THEN** the image element requests the media over HTTP from the API server by its project-relative path and displays the file contents

#### Scenario: Path outside the project media directory is refused
- **WHEN** a media request resolves to a path outside the current project's `media/` folder, including through a symbolic link
- **THEN** the server refuses the request and does not stream the file

#### Scenario: File type not displayable
- **WHEN** a media request targets a file inside `media/` whose type is not an image or PDF
- **THEN** the server refuses the request

#### Scenario: Missing media file
- **WHEN** a media request targets a path that does not exist
- **THEN** the server responds with a not-found status and the viewer renders no image for that layer
