import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
// @ts-expect-error CommonJS module without type declarations
import { migrateLegacyData, MARKER } from '../electron/lib/legacy-data';

let appData: string;
let userData: string;
let legacy: string;
const log = { log: vi.fn(), error: vi.fn() };

const write = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const read = (file: string) => fs.readFileSync(file, 'utf8');

beforeEach(() => {
  appData = fs.mkdtempSync(path.join(os.tmpdir(), 'cuebard-appdata-'));
  userData = path.join(appData, 'CueBard');
  legacy = path.join(appData, 'E-LivePlay');
  write(path.join(legacy, 'Local Storage', 'leveldb', '000003.log'), 'locale=it');
  write(path.join(legacy, 'midi-config.json'), '{"bindings":{"stop-all":1}}');
  write(path.join(legacy, 'bin', 'yt-dlp'), 'binary');
  write(path.join(legacy, 'Cache', 'data_0'), 'cache');
  log.log.mockClear();
  log.error.mockClear();
});

afterEach(() => {
  fs.rmSync(appData, { recursive: true, force: true });
});

describe('migrateLegacyData', () => {
  it('copies the language, MIDI mapping and yt-dlp, and nothing else', () => {
    expect(migrateLegacyData({ appData, userData, log })).toEqual(['Local Storage', 'midi-config.json', 'bin']);
    expect(read(path.join(userData, 'Local Storage', 'leveldb', '000003.log'))).toBe('locale=it');
    expect(read(path.join(userData, 'midi-config.json'))).toBe('{"bindings":{"stop-all":1}}');
    expect(read(path.join(userData, 'bin', 'yt-dlp'))).toBe('binary');
    expect(fs.existsSync(path.join(userData, 'Cache'))).toBe(false);
  });

  it('leaves the E-LivePlay folder unchanged', () => {
    migrateLegacyData({ appData, userData, log });
    expect(read(path.join(legacy, 'midi-config.json'))).toBe('{"bindings":{"stop-all":1}}');
    expect(fs.existsSync(path.join(legacy, 'Local Storage'))).toBe(true);
  });

  it('keeps what CueBard already has', () => {
    write(path.join(userData, 'midi-config.json'), '{"bindings":{}}');
    expect(migrateLegacyData({ appData, userData, log })).toEqual(['Local Storage', 'bin']);
    expect(read(path.join(userData, 'midi-config.json'))).toBe('{"bindings":{}}');
  });

  it('runs only once', () => {
    migrateLegacyData({ appData, userData, log });
    fs.rmSync(path.join(userData, 'midi-config.json'));
    expect(migrateLegacyData({ appData, userData, log })).toEqual([]);
    expect(fs.existsSync(path.join(userData, 'midi-config.json'))).toBe(false);
  });

  it('marks a machine without E-LivePlay as migrated', () => {
    fs.rmSync(legacy, { recursive: true });
    expect(migrateLegacyData({ appData, userData, log })).toEqual([]);
    expect(fs.existsSync(path.join(userData, MARKER))).toBe(true);
  });

  it('uses the dev folder name when the product-name folder is missing', () => {
    const dev = path.join(appData, 'e-liveplay');
    if (fs.existsSync(dev) && fs.realpathSync(dev) === fs.realpathSync(legacy)) return; // case-insensitive disk
    fs.renameSync(legacy, dev);
    expect(migrateLegacyData({ appData, userData, log })).toContain('midi-config.json');
  });

  it('ignores a legacy folder that is the CueBard folder itself', () => {
    expect(migrateLegacyData({ appData, userData: legacy, log })).toEqual([]);
  });

  it('keeps going when one item cannot be copied', () => {
    const failing = {
      ...fs,
      cpSync: (from: string, to: string, options: fs.CopySyncOptions) => {
        if (from.endsWith('bin')) throw new Error('disk full');
        return fs.cpSync(from, to, options);
      },
    };
    expect(migrateLegacyData({ appData, userData, fs: failing, log })).toEqual(['Local Storage', 'midi-config.json']);
    expect(log.error).toHaveBeenCalled();
  });

  it('never throws', () => {
    const broken = { ...fs, existsSync: () => { throw new Error('boom'); } };
    expect(migrateLegacyData({ appData, userData, fs: broken, log })).toEqual([]);
    expect(log.error).toHaveBeenCalled();
  });
});
