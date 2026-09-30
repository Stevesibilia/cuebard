import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';
// @ts-expect-error CommonJS module without type declarations
import { mergeManifests, refreshChecksums, run } from '../scripts/update-manifests';

const sha512 = (content: string) => crypto.createHash('sha512').update(content).digest('base64');

const x64 = {
  version: '1.9.0',
  files: [
    { url: 'E-LivePlay-1.9.0-mac.zip', sha512: 'stale', size: 1 },
    { url: 'E-LivePlay-1.9.0.dmg', sha512: 'stale', size: 1 },
  ],
  path: 'E-LivePlay-1.9.0-mac.zip',
  sha512: 'stale',
  releaseDate: '2026-09-30T00:00:00.000Z',
};
const arm64 = {
  version: '1.9.0',
  files: [
    { url: 'E-LivePlay-1.9.0-arm64-mac.zip', sha512: 'stale', size: 1 },
    { url: 'E-LivePlay-1.9.0-arm64.dmg', sha512: 'stale', size: 1 },
  ],
  path: 'E-LivePlay-1.9.0-arm64-mac.zip',
  sha512: 'stale',
  releaseDate: '2026-09-30T00:00:01.000Z',
};

describe('mergeManifests', () => {
  it('lists the files of every architecture once', () => {
    const merged = mergeManifests([x64, arm64, arm64]);
    expect(merged.files.map((f: { url: string }) => f.url)).toEqual([
      'E-LivePlay-1.9.0-mac.zip',
      'E-LivePlay-1.9.0.dmg',
      'E-LivePlay-1.9.0-arm64-mac.zip',
      'E-LivePlay-1.9.0-arm64.dmg',
    ]);
    expect(merged.path).toBe('E-LivePlay-1.9.0-mac.zip');
  });

  it('does not change its inputs', () => {
    mergeManifests([x64, arm64]);
    expect(x64.files).toHaveLength(2);
  });

  it('rejects manifests of different versions', () => {
    expect(() => mergeManifests([x64, { ...arm64, version: '1.8.1' }])).toThrow(/version/);
  });

  it('rejects an empty list', () => {
    expect(() => mergeManifests([])).toThrow();
  });
});

describe('manifests on disk', () => {
  let root: string;
  const write = (dir: string, name: string, content: string) => {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(path.join(root, dir, name), content);
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'manifests-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('recomputes sha512, size and blockMapSize from the files', () => {
    write('out', 'Setup.exe', 'installer');
    write('out', 'Setup.exe.blockmap', 'map');
    const doc = {
      version: '1.9.0',
      files: [{ url: 'Setup.exe', sha512: 'stale', size: 1, blockMapSize: 99 }],
      path: 'Setup.exe',
      sha512: 'stale',
    };
    const result = refreshChecksums(doc, path.join(root, 'out'));
    expect(result.files[0]).toEqual({ url: 'Setup.exe', sha512: sha512('installer'), size: 9, blockMapSize: 3 });
    expect(result.sha512).toBe(sha512('installer'));
  });

  it('fails when a listed file is missing', () => {
    fs.mkdirSync(path.join(root, 'out'));
    expect(() => refreshChecksums(x64, path.join(root, 'out'))).toThrow(/E-LivePlay-1.9.0-mac.zip/);
  });

  it('merges the macOS directories and refreshes every manifest', () => {
    write('out', 'Setup.exe', 'installer');
    write('out', 'latest.yml', yaml.dump({
      version: '1.9.0', files: [{ url: 'Setup.exe', sha512: 'stale', size: 1 }], path: 'Setup.exe', sha512: 'stale',
    }));
    for (const [dir, doc] of [['x64', x64], ['arm64', arm64]] as const) {
      write(dir, 'latest-mac.yml', yaml.dump(doc));
      for (const file of doc.files) write(dir, file.url, `${dir}:${file.url}`);
    }

    const out = path.join(root, 'out');
    expect(run(out, [path.join(root, 'x64'), path.join(root, 'arm64')])).toEqual(['latest-mac.yml', 'latest.yml']);

    const mac = yaml.load(fs.readFileSync(path.join(out, 'latest-mac.yml'), 'utf8')) as typeof x64;
    expect(mac.files).toHaveLength(4);
    for (const file of mac.files) {
      const content = fs.readFileSync(path.join(out, file.url), 'utf8');
      expect(file.sha512).toBe(sha512(content));
      expect(file.size).toBe(content.length);
    }
    expect(mac.sha512).toBe(sha512('x64:E-LivePlay-1.9.0-mac.zip'));

    const win = yaml.load(fs.readFileSync(path.join(out, 'latest.yml'), 'utf8')) as typeof x64;
    expect(win.files[0].sha512).toBe(sha512('installer'));
  });
});
