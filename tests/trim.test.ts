import { describe, it, expect } from 'vitest';
import { outPointAfterDuration } from '../app/utils/trim';

describe('outPointAfterDuration', () => {
  it('follows the new duration when the cue was untrimmed', () => {
    expect(outPointAfterDuration(60, 60, 62.3)).toBe(62.3);
  });

  it('follows the new duration when the out-point is unset or not positive', () => {
    expect(outPointAfterDuration(undefined, 60, 62.3)).toBe(62.3);
    expect(outPointAfterDuration(null, 60, 62.3)).toBe(62.3);
    expect(outPointAfterDuration(0, 60, 62.3)).toBe(62.3);
    expect(outPointAfterDuration(-1, 60, 62.3)).toBe(62.3);
  });

  it('keeps a trim made before the waveform arrived', () => {
    expect(outPointAfterDuration(45, 60, 62.3)).toBe(45);
  });

  it('clamps a kept trim to the new duration', () => {
    expect(outPointAfterDuration(61, 60, 58)).toBe(58);
  });

  it('keeps a trim when the previous duration is unknown', () => {
    expect(outPointAfterDuration(45, undefined, 62.3)).toBe(45);
  });
});
