# playlist-editing Specification

## Purpose

Structural rules for moving items in the playlist tree and the cart grid, and for keeping each new item's settings independent, so an edit never corrupts the tree or changes items the operator did not touch.

## Requirements
### Requirement: No drop into own subtree
A playlist drag-and-drop move SHALL be refused, leaving the tree unchanged, when the drop target is one of the dragged items or lies inside one of them. When the dragged selection contains a group and some of its descendants, the descendants SHALL move only as part of the group.

#### Scenario: Group onto its nested group
- **WHEN** the operator drags group G onto a group nested inside G
- **THEN** nothing SHALL move and the project SHALL still save

#### Scenario: Group together with its child
- **WHEN** the operator selects group G and one of its children and drags both to another position
- **THEN** G SHALL move with the child inside it, and the child SHALL appear exactly once

### Requirement: New items are independent
Each newly created audio, cart or group item SHALL have its own nested settings objects, so editing one item's behaviour SHALL NOT change any other item.

#### Scenario: Set one imported cue to loop
- **WHEN** the operator imports three files and sets the first cue's end behaviour to loop
- **THEN** the other two cues SHALL keep their default end behaviour

### Requirement: Cart push stays inside the grid
A cart drop that pushes occupied slots SHALL shift only the contiguous run of occupied slots starting at the target slot, and SHALL be refused when that run reaches the last slot. No cue SHALL be placed outside the visible slots.

#### Scenario: Push into a full row
- **WHEN** slots from the target to the last slot are all occupied and the operator drops a cue on the target with push
- **THEN** the drop SHALL be refused and no cue SHALL move

#### Scenario: Push stops at a gap
- **WHEN** the target slot is occupied, the next slot is empty, and the operator drops with push
- **THEN** only the target's cue SHALL move one slot up and later slots SHALL stay unchanged

### Requirement: Waveform arrival keeps the trim
When a cue's waveform or measured duration arrives after the cue was created, the system SHALL update the cue's duration and SHALL change its out-point only if the out-point was unset or equal to the previous duration.

#### Scenario: Trim before the waveform finishes
- **WHEN** the operator trims a newly imported cue's out-point before its waveform is generated
- **THEN** the trimmed out-point SHALL be kept when the waveform arrives

