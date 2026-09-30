## ADDED Requirements

### Requirement: Howls are released when a cue ends

Every Howl the engine creates SHALL be unloaded, and removed from Howler's global registry, when its cue ends naturally, is stopped, fails to load or play, is panicked, or is torn down with the project.

#### Scenario: Long session

- **WHEN** fifty cues are played and allowed to end naturally
- **THEN** Howler's registry SHALL hold only the Howls of cues still playing or fading out

### Requirement: Project teardown stops audio

Closing a project, or opening another one, SHALL stop every active cue, release its Howl and clear group progress.

#### Scenario: Close while playing

- **WHEN** a cue is playing and the operator closes the project
- **THEN** the audio SHALL stop and no active cue or group SHALL remain

### Requirement: Paused cues arm no timers

While a cue is paused, seeking, toggling loop or editing its fades or trim SHALL NOT arm its end, crossfade, stop-fade or custom-action timers. Resuming SHALL arm them from the current position.

#### Scenario: Slider drag on a paused cue

- **WHEN** a cue is paused, the operator changes its stop-fade and clicks its progress bar, and wall-clock time passes its original end
- **THEN** the cue SHALL stay paused and its end behaviour SHALL NOT run
- **AND** after resume it SHALL end at its trimmed end and run its end behaviour once

### Requirement: Trim edits reschedule from the new duration

When the in-point or out-point of a playing cue changes, the engine SHALL recompute the cue's trimmed duration from the item before rescheduling. Moving the out-point later than it was at trigger time MAY take effect only from the next trigger.

#### Scenario: In-point moved earlier while playing

- **WHEN** a playing cue's in-point is moved 5 s earlier
- **THEN** the cue SHALL end at the same position in the file as before the edit

### Requirement: Fades continue after pause

A fade in progress when a cue is paused SHALL continue on resume toward the same target for its remaining time.

#### Scenario: Pause during fade-in

- **WHEN** a cue with a 5 s fade-in is paused after 2 s and resumed
- **THEN** its volume SHALL reach the cue's volume about 3 s after resume

### Requirement: Panic stops only the cues playing when pressed

Panic SHALL fade out and stop the cues active at the moment it is pressed, and SHALL clear group progress. A cue started during the panic fade SHALL keep playing. A panicked cue SHALL NOT run its end behaviour.

#### Scenario: Cue fired during the panic fade

- **WHEN** the operator presses Panic while cue A plays and fires cue B within 500 ms
- **THEN** A SHALL stop and B SHALL keep playing

### Requirement: Media failure leaves other cues untouched

A cue whose media fails to load SHALL NOT duck or stop other cues. A cue that fails to load or play SHALL release its Howl, restore any ducking it applied, and show an error message naming the media file. The error SHALL NOT block the renderer.

#### Scenario: Missing file

- **WHEN** a cue's media file has been removed from disk and the cue is triggered while another cue plays
- **THEN** an error toast SHALL name the file
- **AND** the other cue SHALL keep playing at its volume

### Requirement: Custom-action timers belong to the cue

Custom actions SHALL be scheduled against the cue's playback position and SHALL be cancelled when the cue is paused, seeked, stopped, panicked or ends.

#### Scenario: Stop before the action time

- **WHEN** a cue with a custom action at 5 s is stopped at 2 s
- **THEN** the action SHALL NOT run

### Requirement: Loop toggle restores the previous end behaviour

Toggling loop off on a cue whose loop was toggled on in the same session SHALL restore the end behaviour it had before, and SHALL update the playing Howl's loop flag and end timer. The keyboard and MIDI toggles SHALL behave identically.

#### Scenario: Loop on then off

- **WHEN** a cue with end behaviour "next" has loop toggled on and then off
- **THEN** its end behaviour SHALL be "next"

### Requirement: Duck-others always has a level

A cue in "duck others" mode with no stored level SHALL duck to 0.2 (linear). Choosing "duck others" in the properties panel SHALL store that level when none is set.

#### Scenario: Switch a playlist cue to duck others

- **WHEN** the operator switches a playlist cue's ducking to "duck others"
- **THEN** the level SHALL show a number of dB and playing the cue SHALL duck the others
