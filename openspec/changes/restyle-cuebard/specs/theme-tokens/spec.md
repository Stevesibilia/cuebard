## ADDED Requirements

### Requirement: Surface, text, size, radius and font tokens

Every theme SHALL define the surface tokens `--color-panel`, `--color-chrome`, `--color-field`, `--color-divider`, `--color-control-border`, the text tokens `--color-text-muted`, `--color-danger-text`, `--color-on-accent`, and the stylesheet SHALL define accent and state tints derived from the theme's colours, size tokens for header, strip, toolbar, rows, controls and drawer, radius tokens and the font tokens `--font-sans`, `--font-mono`, `--font-brand`. Components SHALL take colours, fonts and these sizes from tokens, except cue colours chosen by the user.

#### Scenario: Switching theme

- **WHEN** the operator switches from Cobalt to Classic Light
- **THEN** every panel, field, divider and text SHALL change with the theme and none SHALL keep a Cobalt colour

#### Scenario: Custom accent

- **WHEN** the operator picks a custom accent colour
- **THEN** selected, playing and primary elements and their tints SHALL use that colour
