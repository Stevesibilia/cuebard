import { describe, it, expect } from 'vitest';
// @ts-expect-error CommonJS module without type declarations
import { ytDlpAssetName, isPythonScript, errorFromStderr, jsRuntimeArgs } from '../electron/lib/ytdlp-binary';

describe('ytDlpAssetName', () => {
  it('picks the standalone macOS build on both architectures', () => {
    expect(ytDlpAssetName('darwin', 'arm64')).toBe('yt-dlp_macos');
    expect(ytDlpAssetName('darwin', 'x64')).toBe('yt-dlp_macos');
  });

  it('picks the standalone Linux build for the architecture', () => {
    expect(ytDlpAssetName('linux', 'x64')).toBe('yt-dlp_linux');
    expect(ytDlpAssetName('linux', 'arm64')).toBe('yt-dlp_linux_aarch64');
  });

  it('picks the Windows build for the architecture', () => {
    expect(ytDlpAssetName('win32', 'x64')).toBe('yt-dlp.exe');
    expect(ytDlpAssetName('win32', 'arm64')).toBe('yt-dlp_arm64.exe');
    expect(ytDlpAssetName('win32', 'ia32')).toBe('yt-dlp_x86.exe');
  });
});

describe('isPythonScript', () => {
  it('recognises the zipapp by its shebang', () => {
    expect(isPythonScript(Buffer.from('#!/usr/bin/env python3\nPK'))).toBe(true);
  });

  it('accepts a native binary', () => {
    expect(isPythonScript(Buffer.from([0xcf, 0xfa, 0xed, 0xfe]))).toBe(false);
    expect(isPythonScript(Buffer.from('\x7fELF'))).toBe(false);
  });

  it('treats an empty file as not a script', () => {
    expect(isPythonScript(Buffer.alloc(0))).toBe(false);
  });
});

describe('errorFromStderr', () => {
  it('returns the last ERROR line without its prefix', () => {
    const stderr = [
      'WARNING: [youtube] No supported JavaScript runtime could be found.',
      'ERROR: [youtube] abc: Video unavailable',
      ''
    ].join('\n');
    expect(errorFromStderr(stderr)).toBe('[youtube] abc: Video unavailable');
  });

  it('falls back to the last line of a traceback', () => {
    const stderr = [
      'Traceback (most recent call last):',
      '  File "yt_dlp/__init__.py", line 4, in <module>',
      'ImportError: You are using an unsupported version of Python.'
    ].join('\n');
    expect(errorFromStderr(stderr)).toBe('ImportError: You are using an unsupported version of Python.');
  });

  it('returns null for empty output', () => {
    expect(errorFromStderr('\n \n')).toBeNull();
  });

  it('cuts a long message at 300 characters', () => {
    expect(errorFromStderr(`ERROR: ${'x'.repeat(500)}`)).toHaveLength(300);
  });
});

describe('jsRuntimeArgs', () => {
  it('points yt-dlp at the executable as its node runtime', () => {
    expect(jsRuntimeArgs('/Applications/CueBard.app/Contents/MacOS/CueBard')).toEqual([
      '--js-runtimes',
      'node:/Applications/CueBard.app/Contents/MacOS/CueBard'
    ]);
  });

  it('keeps a Windows drive letter in the path', () => {
    expect(jsRuntimeArgs('C:\\Program Files\\CueBard\\CueBard.exe')[1]).toBe(
      'node:C:\\Program Files\\CueBard\\CueBard.exe'
    );
  });

  it('relies on the RunAsNode fuse, which the build config must not turn off', async () => {
    const pkg = (await import('../package.json')).default as { build?: { electronFuses?: { runAsNode?: boolean } } };
    expect(pkg.build?.electronFuses?.runAsNode).not.toBe(false);
  });
});
