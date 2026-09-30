## ADDED Requirements

### Requirement: Subscriptions can be removed

Every renderer subscription to a main-process event exposed by the preload SHALL return a function that removes exactly that subscription.

#### Scenario: Unsubscribe

- **WHEN** a component subscribes to a menu event and calls the returned function
- **THEN** later menu events SHALL NOT reach its callback

### Requirement: Components unsubscribe on unmount

A component or composable that subscribes while mounted SHALL remove its subscriptions when it unmounts, so remounting never leaves more than one live copy of a listener.

#### Scenario: Reopen a project three times

- **WHEN** the operator closes and reopens a project three times and presses Ctrl+S
- **THEN** the project SHALL be saved once

#### Scenario: Menu Open on the welcome screen

- **WHEN** the operator returns to the welcome screen several times and chooses File > Open
- **THEN** one open dialog SHALL be shown

### Requirement: Remote-control triggers work in every workspace view

Trigger and stop requests from the remote-control API SHALL reach the audio engine whenever a project is open, including in minimal mode.

#### Scenario: API trigger in minimal mode

- **WHEN** the app is in minimal mode and a trigger request arrives
- **THEN** the cue plays once
