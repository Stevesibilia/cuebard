import { describe, it, expect } from 'vitest';
// @ts-expect-error CommonJS module without type declarations
import { sanitizeTitle, findDownloadedFile } from '../electron/lib/youtube-filename';

describe('sanitizeTitle', () => {
  it('removes the characters a file name cannot hold', () => {
    expect(sanitizeTitle('AC/DC: "Back in Black" <live>?*|\\')).toBe('ACDC Back in Black live');
  });

  it('keeps accents and other scripts', () => {
    expect(sanitizeTitle('Città vuota – 東京')).toBe('Città vuota – 東京');
  });

  it('cuts the title at 200 characters', () => {
    expect(sanitizeTitle('a'.repeat(250))).toHaveLength(200);
  });
});

describe('findDownloadedFile', () => {
  it('prefers the exact file name', () => {
    expect(findDownloadedFile(['Song.mp3', 'Song (remix).mp3'], 'Song')).toBe('Song.mp3');
  });

  it('matches a percent-encoded name', () => {
    expect(findDownloadedFile(['Tavern%20Music.mp3'], 'Tavern Music')).toBe('Tavern%20Music.mp3');
  });

  it('matches without regard to case', () => {
    expect(findDownloadedFile(['tavern music.mp3'], 'Tavern Music')).toBe('tavern music.mp3');
  });

  it('ignores files that are not mp3', () => {
    expect(findDownloadedFile(['Song.webm', 'Song.mp3.part'], 'Song')).toBeNull();
  });

  it('does not fail on a name with a literal percent sign', () => {
    expect(findDownloadedFile(['100% live.mp3', 'other.mp3'], 'Song')).toBeNull();
    expect(findDownloadedFile(['100% Live.mp3'], '100% live')).toBe('100% Live.mp3');
  });

  it('returns null for an empty folder', () => {
    expect(findDownloadedFile([], 'Song')).toBeNull();
  });
});
