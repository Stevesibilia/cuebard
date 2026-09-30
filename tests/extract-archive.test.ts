import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');
const { extractArchive } = require('../electron/lib/extract-archive');

type Entry =
  | { name: string; data: string }
  | { symlink: string; target: string };

// Build a zip at test time with archiver (the same library export uses).
async function makeZip(file: string, entries: Entry[]) {
  const output = fs.createWriteStream(file);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });
  archive.pipe(output);
  for (const e of entries) {
    if ('symlink' in e) archive.symlink(e.symlink, e.target);
    else archive.append(e.data, { name: e.name });
  }
  await archive.finalize();
  await done;
}

// archiver strips a leading '../' from entry names, so write a same-length
// placeholder and patch the raw bytes (local header + central directory).
function patchName(file: string, from: string, to: string) {
  const buf = fs.readFileSync(file);
  const a = Buffer.from(from);
  const b = Buffer.from(to);
  let i = buf.indexOf(a);
  let count = 0;
  while (i !== -1) {
    b.copy(buf, i);
    count++;
    i = buf.indexOf(a, i + 1);
  }
  expect(count).toBe(2);
  fs.writeFileSync(file, buf);
}

let root: string;
let zip: string;
let target: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-extract-'));
  zip = path.join(root, 'show.lpa');
  target = path.join(root, 'out', 'show');
  fs.mkdirSync(path.join(root, 'out'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('extractArchive', () => {
  it('extracts regular files and folders and reports progress', async () => {
    await makeZip(zip, [
      { name: 'show.liveplay', data: '{"name":"Show"}' },
      { name: 'media/visuals/map.png', data: 'PNG' },
    ]);
    const progress: number[] = [];
    await extractArchive(zip, target, { onProgress: (p: number) => progress.push(p) });
    expect(fs.readFileSync(path.join(target, 'show.liveplay'), 'utf8')).toBe('{"name":"Show"}');
    expect(fs.readFileSync(path.join(target, 'media', 'visuals', 'map.png'), 'utf8')).toBe('PNG');
    expect(progress.at(-1)).toBe(100);
  });

  it('skips symlink entries and extracts the rest', async () => {
    await makeZip(zip, [
      { name: 'show.liveplay', data: '{}' },
      { symlink: 'media/passwd.png', target: '/etc/passwd' },
    ]);
    await extractArchive(zip, target);
    expect(fs.existsSync(path.join(target, 'show.liveplay'))).toBe(true);
    expect(() => fs.lstatSync(path.join(target, 'media', 'passwd.png'))).toThrow();
  });

  it('aborts on an entry named ../evil.txt and leaves no files', async () => {
    await makeZip(zip, [
      { name: 'show.liveplay', data: '{}' },
      { name: 'xx/evil.txt', data: 'EVIL' },
    ]);
    patchName(zip, 'xx/evil.txt', '../evil.txt');
    await expect(extractArchive(zip, target)).rejects.toThrow();
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(path.join(root, 'out', 'evil.txt'))).toBe(false);
    expect(fs.readdirSync(path.join(root, 'out'))).toEqual([]);
  });

  it('aborts when the uncompressed total exceeds the cap', async () => {
    await makeZip(zip, [
      { name: 'show.liveplay', data: '{}' },
      { name: 'media/big.png', data: 'x'.repeat(5000) },
    ]);
    await expect(extractArchive(zip, target, { maxTotalBytes: 1000 })).rejects.toThrow(/size/);
    expect(fs.existsSync(target)).toBe(false);
  });

  it('never writes into an existing folder', async () => {
    await makeZip(zip, [{ name: 'show.liveplay', data: 'NEW' }]);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'show.liveplay'), 'OLD');
    await expect(extractArchive(zip, target)).rejects.toThrow(/EEXIST/);
    expect(fs.readFileSync(path.join(target, 'show.liveplay'), 'utf8')).toBe('OLD');
  });

  it('never overwrites a file, even one it wrote itself', async () => {
    await makeZip(zip, [
      { name: 'show.liveplay', data: 'FIRST' },
      { name: 'show.liveplay', data: 'SECOND' },
    ]);
    await expect(extractArchive(zip, target)).rejects.toThrow(/EEXIST/);
    expect(fs.existsSync(target)).toBe(false);
  });
});
