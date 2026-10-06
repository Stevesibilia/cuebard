import { describe, it, expect } from 'vitest';
// @ts-expect-error CommonJS module without type declarations
import { isProjectFile, isArchiveFile, PROJECT_EXTENSION, ARCHIVE_EXTENSION } from '../electron/lib/file-types';

describe('file types', () => {
  it('uses the CueBard extensions for new files', () => {
    expect(PROJECT_EXTENSION).toBe('cuebard');
    expect(ARCHIVE_EXTENSION).toBe('cbpack');
  });

  it('recognises CueBard and LivePlay projects', () => {
    expect(isProjectFile('/shows/Session 12.cuebard')).toBe(true);
    expect(isProjectFile('C:\\shows\\old.liveplay')).toBe(true);
    expect(isProjectFile('/shows/OLD.LIVEPLAY')).toBe(true);
    expect(isProjectFile('/shows/show.cbpack')).toBe(false);
    expect(isProjectFile('/shows/cuebard')).toBe(false);
  });

  it('recognises CueBard and LivePlay archives', () => {
    expect(isArchiveFile('/shows/show.cbpack')).toBe(true);
    expect(isArchiveFile('/shows/show.lpa')).toBe(true);
    expect(isArchiveFile('/shows/show.cuebard')).toBe(false);
    expect(isArchiveFile('/shows/show.lpa.zip')).toBe(false);
  });
});
