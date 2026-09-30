// Characters Windows does not allow in a file name; the rest of the title is
// kept as is.
function sanitizeTitle(title) {
  return String(title).replace(/[<>:"/\\|?*]/g, '').substring(0, 200);
}

function decodeName(name) {
  try {
    return decodeURIComponent(name);
  } catch {
    // Not percent-encoded (e.g. "100% live.mp3")
    return name;
  }
}

// yt-dlp can write the file under a slightly different name than the output
// template (percent-encoding, case). Returns the .mp3 in `files` that belongs
// to `sanitizedTitle`, preferring the exact name, or null.
function findDownloadedFile(files, sanitizedTitle) {
  const expected = `${sanitizedTitle}.mp3`;
  if (files.includes(expected)) return expected;

  const base = sanitizedTitle.toLowerCase();
  return files.find(
    (file) => file.endsWith('.mp3') && decodeName(file).toLowerCase().startsWith(base)
  ) ?? null;
}

module.exports = { sanitizeTitle, findDownloadedFile };
