// Out-point to keep when a cue's measured duration arrives late (waveform
// generated after import, or loaded on open). The operator may already have
// trimmed the cue: only an unset out-point, or one still equal to the
// previous duration (untrimmed), follows the new duration. A trim is kept,
// clamped to the new duration.
export function outPointAfterDuration(
  currentOutPoint: number | null | undefined,
  previousDuration: number | null | undefined,
  newDuration: number,
): number {
  if (currentOutPoint == null || !(currentOutPoint > 0) || currentOutPoint === previousDuration) {
    return newDuration;
  }
  return Math.min(currentOutPoint, newDuration);
}
