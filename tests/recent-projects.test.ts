import { describe, it, expect } from 'vitest';
import {
  MAX_RECENT_PROJECTS,
  sanitizeRecentProjects,
  addRecentProject,
  pruneMissingProjects
  // @ts-expect-error CommonJS module without type declarations
} from '../electron/lib/recent-projects';
import { formatOpenedAt } from '../app/utils/recentDate';

const entry = (n: number) => ({ path: `/p/${n}.cuebard`, name: `P${n}`, openedAt: `2026-10-0${n}T00:00:00.000Z` });

describe('addRecentProject', () => {
  it('puts a new project first', () => {
    const list = addRecentProject([entry(1)], '/p/2.cuebard', 'P2', 'now');
    expect(list.map((e: { path: string }) => e.path)).toEqual(['/p/2.cuebard', '/p/1.cuebard']);
    expect(list[0]).toEqual({ path: '/p/2.cuebard', name: 'P2', openedAt: 'now' });
  });

  it('moves an already listed path to the top instead of listing it twice', () => {
    const list = addRecentProject([entry(1), entry(2), entry(3)], '/p/3.cuebard', 'Renamed', 'now');
    expect(list.map((e: { path: string }) => e.path)).toEqual(['/p/3.cuebard', '/p/1.cuebard', '/p/2.cuebard']);
    expect(list[0].name).toBe('Renamed');
  });

  it('drops the oldest entry when a ninth project is added', () => {
    const eight = [8, 7, 6, 5, 4, 3, 2, 1].map(entry);
    const list = addRecentProject(eight, '/p/9.cuebard', 'P9', 'now');
    expect(MAX_RECENT_PROJECTS).toBe(8);
    expect(list).toHaveLength(8);
    expect(list[0].path).toBe('/p/9.cuebard');
    expect(list.some((e: { path: string }) => e.path === '/p/1.cuebard')).toBe(false);
  });

  it('does not change the list it was given', () => {
    const before = [entry(1)];
    addRecentProject(before, '/p/2.cuebard', 'P2', 'now');
    expect(before).toEqual([entry(1)]);
  });
});

describe('pruneMissingProjects', () => {
  it('drops entries whose file is gone and keeps the order', () => {
    const exists = (p: string) => p !== '/p/2.cuebard';
    const { list, changed } = pruneMissingProjects([entry(3), entry(2), entry(1)], exists);
    expect(list.map((e: { path: string }) => e.path)).toEqual(['/p/3.cuebard', '/p/1.cuebard']);
    expect(changed).toBe(true);
  });

  it('reports no change when every file exists', () => {
    const { list, changed } = pruneMissingProjects([entry(1)], () => true);
    expect(list).toEqual([entry(1)]);
    expect(changed).toBe(false);
  });
});

describe('sanitizeRecentProjects', () => {
  it('returns an empty list for anything but an array', () => {
    expect(sanitizeRecentProjects(null)).toEqual([]);
    expect(sanitizeRecentProjects({ path: '/p/1.cuebard' })).toEqual([]);
  });

  it('skips malformed entries and duplicate paths, keeps the first', () => {
    const raw = [entry(1), { name: 'no path' }, 'text', { path: '' }, { ...entry(1), name: 'dup' }, { path: '/p/x.cuebard', name: 5 }];
    expect(sanitizeRecentProjects(raw)).toEqual([
      entry(1),
      { path: '/p/x.cuebard', name: '', openedAt: '' }
    ]);
  });

  it('caps a stored list longer than the limit', () => {
    const raw = Array.from({ length: 12 }, (_, i) => ({ path: `/p/${i}`, name: '', openedAt: '' }));
    expect(sanitizeRecentProjects(raw)).toHaveLength(8);
  });
});

describe('formatOpenedAt', () => {
  const now = new Date(2026, 9, 6, 15, 0); // 6 October 2026

  it('says today, yesterday and days ago', () => {
    expect(formatOpenedAt(new Date(2026, 9, 6, 1, 0).toISOString(), now, 'en')).toBe('Today');
    expect(formatOpenedAt(new Date(2026, 9, 5, 23, 0).toISOString(), now, 'en')).toBe('Yesterday');
    expect(formatOpenedAt(new Date(2026, 9, 3).toISOString(), now, 'en')).toBe('3 days ago');
  });

  it('says last week, then weeks ago', () => {
    expect(formatOpenedAt(new Date(2026, 8, 28).toISOString(), now, 'en')).toBe('Last week');
    expect(formatOpenedAt(new Date(2026, 8, 20).toISOString(), now, 'en')).toBe('2 weeks ago');
  });

  it('names the month, with the year when it is not this year', () => {
    expect(formatOpenedAt(new Date(2026, 7, 1).toISOString(), now, 'en')).toBe('August');
    expect(formatOpenedAt(new Date(2025, 11, 1).toISOString(), now, 'en')).toBe('Dec 2025');
  });

  it('follows the UI language', () => {
    expect(formatOpenedAt(new Date(2026, 9, 6).toISOString(), now, 'it')).toBe('Oggi');
    expect(formatOpenedAt(new Date(2026, 7, 1).toISOString(), now, 'it')).toBe('Agosto');
  });

  it('shows nothing for a missing or broken date', () => {
    expect(formatOpenedAt('', now, 'en')).toBe('');
    expect(formatOpenedAt('soon', now, 'en')).toBe('');
  });
});
