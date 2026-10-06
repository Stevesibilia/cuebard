// The plain `yt-dlp` release asset is a Python zipapp that runs on whatever
// python3 is first on PATH; an app started from the Dock gets the system
// Python, which yt-dlp no longer supports. These assets bundle their own Python.
function ytDlpAssetName(platform, arch) {
  if (platform === 'win32') {
    if (arch === 'arm64') return 'yt-dlp_arm64.exe';
    if (arch === 'ia32') return 'yt-dlp_x86.exe';
    return 'yt-dlp.exe';
  }
  if (platform === 'darwin') return 'yt-dlp_macos';
  if (platform === 'linux') return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  return 'yt-dlp';
}

// True for the zipapp asset, which starts with a `#!/usr/bin/env python3` line.
// Takes the first bytes of the file.
function isPythonScript(head) {
  return head.subarray(0, 2).toString('latin1') === '#!';
}

// The line worth showing when yt-dlp fails: its last `ERROR:` line, or the
// last line of a Python traceback, or null when stderr is empty.
function errorFromStderr(stderr) {
  const lines = String(stderr)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const errors = lines.filter((line) => line.startsWith('ERROR:'));
  const line = errors.length ? errors[errors.length - 1] : lines[lines.length - 1];
  if (!line) return null;
  return line.replace(/^ERROR:\s*/, '').substring(0, 300);
}

module.exports = { ytDlpAssetName, isPythonScript, errorFromStderr };
