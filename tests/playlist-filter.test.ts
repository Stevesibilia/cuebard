import { describe, it, expect } from 'vitest';
import {
  normalizeQuery,
  itemMatches,
  visibleItems,
  countCues,
} from '../app/composables/usePlaylistFilter';

const audio = (displayName: string) => ({ uuid: displayName, type: 'audio', displayName }) as any;
const group = (displayName: string, children: any[]) =>
  ({ uuid: displayName, type: 'group', displayName, children }) as any;

// Act 1
// ├── Tavern ambience
// └── Rain
// Act 2
// ├── Crypt drone
// └── Boss
//     └── Drone of doom
// Victory fanfare
const playlist = () => [
  group('Act 1', [audio('Tavern ambience'), audio('Rain')]),
  group('Act 2', [audio('Crypt drone'), group('Boss', [audio('Drone of doom')])]),
  audio('Victory fanfare'),
];

const names = (items: any[]) => items.map(item => item.displayName);

describe('playlist filter', () => {
  it('normalizes the typed text', () => {
    expect(normalizeQuery('  DRone ')).toBe('drone');
    expect(normalizeQuery('   ')).toBe('');
  });

  it('shows everything without a query', () => {
    const items = playlist();
    expect(visibleItems(items, '')).toBe(items);
    expect(countCues(items, '')).toEqual({ shown: 5, total: 5 });
  });

  it('keeps a group whose descendant matches, ignoring case', () => {
    const items = playlist();
    expect(names(visibleItems(items, 'drone'))).toEqual(['Act 2']);
    expect(names(visibleItems(items[1].children, 'drone'))).toEqual(['Crypt drone', 'Boss']);
    expect(names(visibleItems(items[1].children[1].children, 'drone'))).toEqual(['Drone of doom']);
    expect(countCues(items, 'drone')).toEqual({ shown: 2, total: 5 });
  });

  it('shows every child of a group whose name matches', () => {
    const items = playlist();
    expect(names(visibleItems(items, 'act 1'))).toEqual(['Act 1']);
    expect(names(visibleItems(items[0].children, 'act 1', true))).toEqual(['Tavern ambience', 'Rain']);
    expect(countCues(items, 'act 1')).toEqual({ shown: 2, total: 5 });
  });

  it('hides a group with no match inside', () => {
    expect(itemMatches(group('Act 3', [audio('Sea')]), 'drone')).toBe(false);
    expect(itemMatches(group('Empty', []), 'drone')).toBe(false);
  });

  it('counts nothing shown when nothing matches', () => {
    expect(visibleItems(playlist(), 'zzz')).toEqual([]);
    expect(countCues(playlist(), 'zzz')).toEqual({ shown: 0, total: 5 });
  });
});
