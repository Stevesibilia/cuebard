import { describe, it, expect } from 'vitest';
// @ts-expect-error CommonJS module without type declarations
import { parseLatestRelease, RELEASES_PAGE } from '../electron/lib/release-info';

const release = {
  tag_name: 'v1.9.0',
  body: '## What\'s Changed',
  published_at: '2026-09-30T10:00:00Z',
  html_url: 'https://github.com/Stevesibilia/enhanced-liveplay/releases/tag/v1.9.0',
};

describe('parseLatestRelease', () => {
  it('describes a newer release', () => {
    expect(parseLatestRelease(release, '1.8.1')).toEqual({
      currentVersion: '1.8.1',
      newVersion: '1.9.0',
      releaseNotes: '## What\'s Changed',
      releaseDate: '2026-09-30T10:00:00Z',
      downloadUrl: release.html_url,
      isManualUpdate: true,
    });
  });

  it('returns null when the release is not newer', () => {
    expect(parseLatestRelease(release, '1.9.0')).toBeNull();
    expect(parseLatestRelease(release, '1.10.0')).toBeNull();
  });

  it('falls back to the releases page for an unexpected link', () => {
    const info = parseLatestRelease({ ...release, html_url: 'https://example.com/x' }, '1.8.1');
    expect(info.downloadUrl).toBe(RELEASES_PAGE);
  });

  it('rejects a payload without a version tag', () => {
    expect(() => parseLatestRelease({ message: 'Not Found' }, '1.8.1')).toThrow(/tag/);
    expect(() => parseLatestRelease({ tag_name: 'nightly' }, '1.8.1')).toThrow(/tag/);
  });
});
