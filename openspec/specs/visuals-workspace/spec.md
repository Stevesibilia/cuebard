# visuals-workspace Specification

## Purpose

The layout of the Visuals tab: the composition canvas takes the space, and the media library and visual properties share one collapsible side column.

## Requirements

### Requirement: The composition gets the space

On the Visuals tab the composition canvas SHALL take all width and height not used by the header, the now-playing strip, the toolbar, one side column and the selected-layer bar, keeping 16:9. Hiding the side column SHALL give the canvas the full width.

#### Scenario: Side column hidden

- **WHEN** the operator hides the side column
- **THEN** the canvas SHALL grow to the largest 16:9 size that fits the workspace

### Requirement: One side column for library and properties

The media library (with its folders) and the visual properties of a media item SHALL share one side column: opening an item's properties SHALL replace the library in that column, and going back SHALL show the library again. No feature of the 2.0.0 media library, folders or visual properties SHALL be removed.

#### Scenario: Edit link delay

- **WHEN** the operator opens the properties of "Crypt level 1", changes its link delay and goes back
- **THEN** the change SHALL be saved and the library SHALL show again in the same column
