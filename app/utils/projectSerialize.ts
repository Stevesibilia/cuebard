// Serialises a project for the .liveplay file.
//
// Waveform peaks are left out: they are already stored in waveforms/*.json
// and loaded (or regenerated) from there on open. Inline they made every save
// several MB of JSON on the UI thread and every sync upload large. Only the
// exact key `waveform` is dropped; `waveformPath` is kept.
export function serializeProject(project: unknown): string {
  return JSON.stringify(project, (key, value) => (key === 'waveform' ? undefined : value), 2);
}
