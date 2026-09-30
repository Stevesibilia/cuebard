// Pure request/URL checks for the main process. No electron imports, so they
// are unit-testable.

// URLs the open-external handler may hand to the OS: web pages and mail links.
const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function isSafeExternalUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    return SAFE_EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
  } catch (_) {
    return false;
  }
}

module.exports = { isSafeExternalUrl };
