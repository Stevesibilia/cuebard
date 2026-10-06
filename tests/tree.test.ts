import { describe, it, expect } from 'vitest';
import { findPathToUuid, isSelfOrDescendant, normalizeMoveSet, canDropOnto } from '../app/utils/tree';

// outer
// ├── a
// └── inner
//     ├── b
//     └── deepest
//         └── c
// sibling
const tree = () => [
  {
    uuid: 'outer', type: 'group', children: [
      { uuid: 'a', type: 'audio' },
      {
        uuid: 'inner', type: 'group', children: [
          { uuid: 'b', type: 'audio' },
          { uuid: 'deepest', type: 'group', children: [{ uuid: 'c', type: 'audio' }] },
        ],
      },
    ],
  },
  { uuid: 'sibling', type: 'audio' },
];

describe('findPathToUuid', () => {
  it('returns the ancestor chain ending at the item', () => {
    expect(findPathToUuid(tree(), 'c')?.map(n => n.uuid)).toEqual(['outer', 'inner', 'deepest', 'c']);
  });

  it('returns null for an unknown uuid', () => {
    expect(findPathToUuid(tree(), 'nope')).toBeNull();
  });
});

describe('isSelfOrDescendant', () => {
  it('is true for the item itself and anything below it', () => {
    expect(isSelfOrDescendant(tree(), 'inner', 'inner')).toBe(true);
    expect(isSelfOrDescendant(tree(), 'inner', 'c')).toBe(true);
  });

  it('is false for siblings and ancestors', () => {
    expect(isSelfOrDescendant(tree(), 'inner', 'a')).toBe(false);
    expect(isSelfOrDescendant(tree(), 'inner', 'outer')).toBe(false);
  });
});

describe('canDropOnto', () => {
  it('refuses a drop onto the dragged item itself', () => {
    expect(canDropOnto(tree(), ['outer'], 'outer')).toBe(false);
  });

  it('refuses a drop onto a child of the dragged group', () => {
    expect(canDropOnto(tree(), ['outer'], 'inner')).toBe(false);
  });

  it('refuses a drop onto a grandchild of the dragged group', () => {
    expect(canDropOnto(tree(), ['outer'], 'deepest')).toBe(false);
    expect(canDropOnto(tree(), ['outer'], 'c')).toBe(false);
  });

  it('allows a drop onto a sibling', () => {
    expect(canDropOnto(tree(), ['outer'], 'sibling')).toBe(true);
  });

  it('allows moving a nested item up to its ancestor', () => {
    expect(canDropOnto(tree(), ['c'], 'outer')).toBe(true);
  });

  it('refuses when any one of several moving items contains the target', () => {
    expect(canDropOnto(tree(), ['sibling', 'inner'], 'b')).toBe(false);
  });
});

describe('normalizeMoveSet', () => {
  it('moves a child selected with its group only once, inside the group', () => {
    expect(normalizeMoveSet(tree(), ['b', 'outer'])).toEqual(['outer']);
  });

  it('drops grandchildren of a moving group too', () => {
    expect(normalizeMoveSet(tree(), ['c', 'inner', 'sibling'])).toEqual(['inner', 'sibling']);
  });

  it('keeps unrelated items in tree order, dropping unknown and duplicate uuids', () => {
    expect(normalizeMoveSet(tree(), ['sibling', 'a', 'nope', 'a'])).toEqual(['a', 'sibling']);
  });
});
