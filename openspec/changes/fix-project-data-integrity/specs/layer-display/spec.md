## ADDED Requirements

### Requirement: Layers cleared with the project
Closing a project or opening another one SHALL remove all visual layers and SHALL blank the player window and connected remote viewers.

#### Scenario: Switch project with layers visible
- **WHEN** the operator has published layers and opens a different project
- **THEN** the workspace SHALL show no layers from the previous project and the player output SHALL be blank

### Requirement: Auto-fit once per layer
The system SHALL fit a layer's box to its image's aspect ratio at most once per layer, and SHALL never auto-fit a background layer. Switching workspace tabs SHALL NOT change any layer's box or push anything to the outputs.

#### Scenario: Tab switch with a live background
- **WHEN** a background and another layer are published and the operator switches Audio → Media → Audio → Media
- **THEN** the player output and every layer's box SHALL be unchanged
