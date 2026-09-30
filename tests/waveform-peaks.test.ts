import { describe, it, expect } from 'vitest';
// @ts-expect-error CommonJS module without type declarations
import { downsamplePeaks } from '../electron/lib/waveform-peaks';

const pcm = (samples: number[]) => {
  const buffer = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, i) => buffer.writeInt16LE(sample, i * 2));
  return buffer;
};

describe('downsamplePeaks', () => {
  it('takes evenly spaced samples as absolute values in 0..1', () => {
    const peaks = downsamplePeaks(pcm([0, 16384, -32768, 8192, 0, -16384, 32767, 1]), 4);
    expect(peaks).toEqual([0, 1, 0, 32767 / 32768]);
  });

  it('never returns more than the target', () => {
    const peaks = downsamplePeaks(pcm(Array.from({ length: 1000 }, (_, i) => i)), 7);
    expect(peaks).toHaveLength(7);
  });

  it('returns each sample once when the audio is shorter than the target', () => {
    expect(downsamplePeaks(pcm([16384, -16384, 8192]), 10)).toEqual([0.5, 0.5, 0.25]);
  });

  it('ignores a trailing odd byte', () => {
    const buffer = Buffer.concat([pcm([16384, 16384]), Buffer.from([0x7f])]);
    expect(downsamplePeaks(buffer, 2)).toEqual([0.5, 0.5]);
  });

  it('returns nothing for an empty buffer or a zero target', () => {
    expect(downsamplePeaks(Buffer.alloc(0), 10)).toEqual([]);
    expect(downsamplePeaks(pcm([1, 2, 3]), 0)).toEqual([]);
  });
});
