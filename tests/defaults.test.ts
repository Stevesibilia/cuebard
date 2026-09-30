import { describe, it, expect } from 'vitest';
import { createDefaultAudioItem, createDefaultCartAudioItem, createDefaultGroupItem } from '../app/types/project';

// Every object or array reachable from `a`, paired with the value at the same path in `b`.
function sharedNested(a: any, b: any, path = ''): string[] {
  const shared: string[] = [];
  for (const key of Object.keys(a)) {
    const va = a[key];
    if (va && typeof va === 'object') {
      if (va === b[key]) shared.push(`${path}${key}`);
      shared.push(...sharedNested(va, b[key], `${path}${key}.`));
    }
  }
  return shared;
}

describe.each([
  ['createDefaultAudioItem', createDefaultAudioItem],
  ['createDefaultCartAudioItem', createDefaultCartAudioItem],
  ['createDefaultGroupItem', createDefaultGroupItem],
])('%s', (_name, factory) => {
  it('returns results that share no nested object', () => {
    const first = factory();
    const second = factory();
    expect(sharedNested(first, second)).toEqual([]);
    expect(first).toEqual(second);
  });
});

describe('default audio item', () => {
  it('editing one item\'s end behaviour leaves the next item on the default', () => {
    const first = createDefaultAudioItem();
    const second = createDefaultAudioItem();
    first.endBehavior!.action = 'loop';
    first.customActions!.push({ timePoint: 1, action: { type: 'stop-all' } });
    expect(second.endBehavior!.action).toBe('next');
    expect(second.customActions).toEqual([]);
    expect(createDefaultAudioItem().endBehavior!.action).toBe('next');
  });
});
