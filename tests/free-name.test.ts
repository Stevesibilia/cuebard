import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
// @ts-expect-error CommonJS module without type declarations
import { nextFreeName, copyFileNoOverwrite } from '../electron/lib/free-name';

describe('nextFreeName', () => {
  it('uses the name itself on the first attempt', () => {
    expect(nextFreeName('track.mp3', 1)).toBe('track.mp3');
  });

  it('numbers later attempts before the extension', () => {
    expect(nextFreeName('track.mp3', 2)).toBe('track (2).mp3');
    expect(nextFreeName('track.mp3', 3)).toBe('track (3).mp3');
  });

  it('keeps only the last extension and inner dots', () => {
    expect(nextFreeName('live.set.v2.wav', 2)).toBe('live.set.v2 (2).wav');
  });

  it('handles names without an extension and dotfiles', () => {
    expect(nextFreeName('README', 2)).toBe('README (2)');
    expect(nextFreeName('.hidden', 2)).toBe('.hidden (2)');
  });
});

describe('copyFileNoOverwrite', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'liveplay-free-name-'));
    fs.mkdirSync(path.join(dir, 'a'));
    fs.mkdirSync(path.join(dir, 'b'));
    fs.mkdirSync(path.join(dir, 'media'));
    fs.writeFileSync(path.join(dir, 'a', 'track.mp3'), 'first');
    fs.writeFileSync(path.join(dir, 'b', 'track.mp3'), 'second');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('keeps both files when two sources share a name', async () => {
    const dest = path.join(dir, 'media', 'track.mp3');
    const first = await copyFileNoOverwrite(path.join(dir, 'a', 'track.mp3'), dest);
    const second = await copyFileNoOverwrite(path.join(dir, 'b', 'track.mp3'), dest);
    const third = await copyFileNoOverwrite(path.join(dir, 'b', 'track.mp3'), dest);
    expect(first).toBe(dest);
    expect(second).toBe(path.join(dir, 'media', 'track (2).mp3'));
    expect(third).toBe(path.join(dir, 'media', 'track (3).mp3'));
    expect(fs.readFileSync(first, 'utf8')).toBe('first');
    expect(fs.readFileSync(second, 'utf8')).toBe('second');
  });

  it('fails without writing when every name is taken', async () => {
    const dest = path.join(dir, 'media', 'track.mp3');
    fs.writeFileSync(dest, 'existing');
    await expect(copyFileNoOverwrite(path.join(dir, 'a', 'track.mp3'), dest, 1)).rejects.toThrow('No free file name');
    expect(fs.readFileSync(dest, 'utf8')).toBe('existing');
  });

  it('passes other errors through', async () => {
    await expect(copyFileNoOverwrite(path.join(dir, 'missing.mp3'), path.join(dir, 'media', 'x.mp3')))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });
});
