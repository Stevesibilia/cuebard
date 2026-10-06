## MODIFIED Requirements

### Requirement: Suppress hotkeys when text input focused

The system SHALL NOT trigger cart hotkeys when the focused element accepts text entry: a `textarea`, a `select`, a `[contenteditable]` element, or an `input` whose type is not one of `range`, `checkbox`, `radio`, `button`, `submit`, `reset`, `color`, `file` or `image`. A focused slider, checkbox or button SHALL NOT block hotkeys.

#### Scenario: Typing in a text field does not trigger slots

- **WHEN** the user focuses a text input and presses the "1" key
- **THEN** no cart slot is triggered and the keystroke is handled normally by the input

#### Scenario: Hotkey after touching a slider

- **WHEN** the user drags the master volume slider and then presses a bound cart key
- **THEN** the slot is triggered

## ADDED Requirements

### Requirement: Held keys do not retrigger

The system SHALL ignore auto-repeated keydown events for every hotkey except master volume up and down.

#### Scenario: Holding a cart key

- **WHEN** the user holds down a bound cart key
- **THEN** the slot is toggled once

### Requirement: Hotkeys active in every workspace view

Cart and global hotkeys SHALL work whenever a project is open, whichever tab is active, whether the cart is open or closed, and in minimal mode.

#### Scenario: Minimal mode

- **WHEN** the operator enters minimal mode and presses a bound cart key
- **THEN** the slot is triggered
