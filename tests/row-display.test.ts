import { describe, it, expect } from 'vitest';
import { behaviourChips, formatLength, groupSummary, trimmedLength } from '../app/utils/rowDisplay';
import type { AudioItem, GroupItem } from '../app/types/project';

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}(${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(',')})` : key;

const cue = (extra: Partial<AudioItem> = {}): AudioItem => ({
  uuid: 'a',
  index: [0],
  displayName: 'Cue',
  color: '#6b7280',
  type: 'audio',
  mediaFileName: 'a.mp3',
  mediaPath: 'media/a.mp3',
  waveformPath: 'a.json',
  inPoint: 0,
  outPoint: 0,
  volume: 1,
  endBehavior: { action: 'nothing' },
  startBehavior: { action: 'nothing' },
  customActions: [],
  duckingBehavior: { mode: 'stop-all' },
  duration: 60,
  fadeOutDuration: 1,
  playFade: 0,
  stopFade: 0,
  crossFade: 0,
  ...extra,
});

const group = (children: (AudioItem | GroupItem)[]): GroupItem => ({
  uuid: 'g',
  index: [0],
  displayName: 'Group',
  color: '#6b7280',
  type: 'group',
  children,
  startBehavior: { action: 'play-first' },
  endBehavior: { action: 'nothing' },
  isExpanded: true,
});

const names: Record<string, string> = { b: 'Boss' };
const resolve = (uuid: string) => names[uuid] ?? null;
const labels = (item: AudioItem, locale = 'en') =>
  behaviourChips(item, t, resolve, locale).map((chip) => chip.label);

describe('trimmedLength and formatLength', () => {
  it('uses Out minus In, the whole file when untrimmed', () => {
    expect(trimmedLength(cue())).toBe(60);
    expect(trimmedLength(cue({ inPoint: 10, outPoint: 40 }))).toBe(30);
  });

  it('formats m:ss, and h:mm:ss from an hour up', () => {
    expect(formatLength(8.9)).toBe('0:08');
    expect(formatLength(289)).toBe('4:49');
    expect(formatLength(3725)).toBe('1:02:05');
  });
});

describe('groupSummary', () => {
  it('counts audio cues at any depth and sums their trimmed length', () => {
    const nested = group([cue({ inPoint: 0, outPoint: 30 })]);
    expect(groupSummary(group([cue(), nested]))).toEqual({ count: 2, length: 90 });
  });

  it('is empty for an empty group', () => {
    expect(groupSummary(group([]))).toEqual({ count: 0, length: 0 });
  });
});

describe('behaviourChips', () => {
  it('shows nothing for a plain cue', () => {
    expect(labels(cue())).toEqual([]);
  });

  it('orders end, ducking, crossfade, start', () => {
    const item = cue({
      endBehavior: { action: 'loop' },
      duckingBehavior: { mode: 'duck-others' },
      crossFade: 4,
      startBehavior: { action: 'play-next' },
    });
    expect(labels(item)).toEqual(['rows.chipLoop', 'rows.chipDuck', 'rows.chipCrossfade(seconds=4)', 'rows.chipPlaysNext']);
  });

  it('names go-to and play targets, and flags deleted ones', () => {
    expect(labels(cue({ endBehavior: { action: 'goto-item', targetUuid: 'b' } }))).toEqual(['rows.chipGoto(name=Boss)']);
    expect(labels(cue({ endBehavior: { action: 'goto-item', targetUuid: 'x' } }))).toEqual(['rows.chipGotoMissing']);
    expect(labels(cue({ startBehavior: { action: 'play-item', targetUuid: 'b' } }))).toEqual(['rows.chipPlays(name=Boss)']);
    expect(labels(cue({ startBehavior: { action: 'play-item' } }))).toEqual(['rows.chipPlaysMissing']);
  });

  it('shows index targets in comma form', () => {
    expect(labels(cue({ endBehavior: { action: 'goto-index', targetIndex: [1, 0] } }))).toEqual(['rows.chipGoto(name=1,0)']);
    expect(labels(cue({ startBehavior: { action: 'play-index', targetIndex: [2] } }))).toEqual(['rows.chipPlays(name=2)']);
  });

  it('writes the crossfade with the locale decimal separator', () => {
    expect(labels(cue({ crossFade: 2.5 }), 'it')).toEqual(['rows.chipCrossfade(seconds=2,5)']);
    expect(labels(cue({ endBehavior: { action: 'next' }, crossFade: 2.5 }))).toEqual(['rows.chipThenNext', 'rows.chipCrossfade(seconds=2.5)']);
  });
});
