import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
// @ts-expect-error CommonJS module without type declarations
import { pathIsInProjectFolder, pathIsInFolder } from '../electron/lib/path-guard';

// The guard receives the project *file* path and derives the folder from it.
const projectFile = path.join(path.sep, 'home', 'user', 'shows', 'my-show', 'project.liveplay');
const projectFolder = path.dirname(projectFile);

describe('pathIsInProjectFolder', () => {
  it('accepts a path inside the project folder', () => {
    const requested = path.join(projectFolder, 'media', 'song.mp3');
    expect(pathIsInProjectFolder(requested, projectFile)).toBe(requested);
  });

  it('accepts the project folder itself', () => {
    expect(pathIsInProjectFolder(projectFolder, projectFile)).toBe(projectFolder);
  });

  it('rejects an absolute path outside the project folder', () => {
    expect(pathIsInProjectFolder(path.join(path.sep, 'etc', 'passwd'), projectFile)).toBeNull();
  });

  it('rejects path traversal escaping the project folder', () => {
    const requested = path.join(projectFolder, '..', '..', '..', 'etc', 'passwd');
    expect(pathIsInProjectFolder(requested, projectFile)).toBeNull();
  });

  it('rejects sibling folders sharing the project folder as a name prefix', () => {
    const sibling = projectFolder + '-evil';
    expect(pathIsInProjectFolder(path.join(sibling, 'file.mp3'), projectFile)).toBeNull();
  });

  it('resolves traversal that stays inside the project folder', () => {
    const requested = path.join(projectFolder, 'media', '..', 'media', 'song.mp3');
    expect(pathIsInProjectFolder(requested, projectFile)).toBe(
      path.join(projectFolder, 'media', 'song.mp3')
    );
  });

  it('allows any path when no project is loaded', () => {
    const requested = path.join(path.sep, 'anywhere', 'file.mp3');
    expect(pathIsInProjectFolder(requested, null)).toBe(requested);
    expect(pathIsInProjectFolder(requested, undefined)).toBe(requested);
  });
});

describe('pathIsInProjectFolder on a real filesystem', () => {
  // os.tmpdir() is itself behind a symlink on macOS (/var -> /private/var),
  // which also exercises realpath on the project folder.
  let root: string;
  let project: string;
  let projectFile: string;
  let outside: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-guard-'));
    project = path.join(root, 'show');
    outside = path.join(root, 'outside');
    fs.mkdirSync(path.join(project, 'media'), { recursive: true });
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'x');
    fs.writeFileSync(path.join(project, 'media', 'song.mp3'), 'x');
    projectFile = path.join(project, 'show.liveplay');
    fs.writeFileSync(projectFile, '{}');
    fs.symlinkSync(outside, path.join(project, 'escape'), 'dir');
    fs.symlinkSync(path.join(project, 'media'), path.join(project, 'media-link'), 'dir');
    fs.symlinkSync(path.join(outside, 'not-yet.txt'), path.join(project, 'dangling'));
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects a path through a symlink inside the project that points outside', () => {
    expect(pathIsInProjectFolder(path.join(project, 'escape', 'secret.txt'), projectFile)).toBeNull();
    expect(pathIsInProjectFolder(path.join(project, 'escape'), projectFile)).toBeNull();
  });

  it('rejects a new file under a symlink that points outside', () => {
    expect(pathIsInProjectFolder(path.join(project, 'escape', 'new', 'file.json'), projectFile)).toBeNull();
  });

  it('rejects a dangling symlink (a write would follow it outside)', () => {
    expect(pathIsInProjectFolder(path.join(project, 'dangling'), projectFile)).toBeNull();
  });

  it('accepts a symlink that stays inside the project', () => {
    const requested = path.join(project, 'media-link', 'song.mp3');
    expect(pathIsInProjectFolder(requested, projectFile)).toBe(requested);
  });

  it('accepts an existing file given by its resolved path', () => {
    const real = fs.realpathSync.native(path.join(project, 'media', 'song.mp3'));
    expect(pathIsInProjectFolder(real, projectFile)).toBe(real);
  });

  it('accepts a non-existent write target inside the project', () => {
    const requested = path.join(project, 'waveforms', 'deep', 'new.json');
    expect(pathIsInProjectFolder(requested, projectFile)).toBe(requested);
  });

  it('rejects a non-existent write target outside the project', () => {
    expect(pathIsInProjectFolder(path.join(outside, 'new.json'), projectFile)).toBeNull();
  });

  it('does not throw when no ancestor up to the root exists', () => {
    const requested = path.join(path.parse(root).root, 'lp-guard-missing-xyz', 'a', 'b.txt');
    expect(() => pathIsInProjectFolder(requested, projectFile)).not.toThrow();
    expect(pathIsInProjectFolder(requested, projectFile)).toBeNull();
  });

  it('accepts a name that only starts with two dots', () => {
    const requested = path.join(project, '..notes.txt');
    expect(pathIsInProjectFolder(requested, projectFile)).toBe(requested);
  });

  it('pathIsInFolder confines to a sub-folder root', () => {
    const media = path.join(project, 'media');
    expect(pathIsInFolder(path.join(media, 'song.mp3'), media)).toBe(path.join(media, 'song.mp3'));
    expect(pathIsInFolder(projectFile, media)).toBeNull();
  });
});

describe('pathIsInProjectFolder with a project at a filesystem root', () => {
  it('accepts paths inside it', () => {
    const fsRoot = path.parse(process.cwd()).root;
    const requested = path.join(fsRoot, 'media', 'song.mp3');
    expect(pathIsInProjectFolder(requested, path.join(fsRoot, 'show.liveplay'))).toBe(requested);
  });
});
