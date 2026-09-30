const net = require('net');

// Pure request/URL checks for the main process. No electron imports, so they
// are unit-testable.

// Loopback peers: the operator's own machine.
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isLoopback(remoteAddress) {
  return LOOPBACK_ADDRESSES.has(remoteAddress);
}

// A request a browser sends on behalf of some web page (an <img> or fetch on
// a page the operator has open). curl and scripts send neither header; a URL
// typed in the address bar carries Sec-Fetch-Site: none.
function isCrossSiteBrowserRequest(headers) {
  if (headers.origin !== undefined) return true;
  const site = headers['sec-fetch-site'];
  return site !== undefined && site !== 'none' && site !== 'same-origin';
}

// DNS-rebinding defence: the Host header must name this machine directly —
// an IP literal (the QR code uses the LAN IP), localhost, or one of
// `localNames` (host name, host name + .local) — never a foreign domain that
// was made to resolve to us. The port, if any, is not checked.
function isAllowedHost(hostHeader, localNames = []) {
  if (typeof hostHeader !== 'string' || !hostHeader) return false;
  const ipv6 = /^\[([^\]]+)\](?::\d+)?$/.exec(hostHeader);
  if (ipv6) {
    return net.isIPv6(ipv6[1]);
  }
  const hostPort = /^([^:]+)(?::\d+)?$/.exec(hostHeader);
  if (!hostPort) return false;
  const host = hostPort[1].toLowerCase();
  if (net.isIPv4(host)) return true;
  if (host === 'localhost') return true;
  return localNames.some((name) => typeof name === 'string' && name.toLowerCase() === host);
}

// Remote Control index path: '1,0' -> [1, 0]. Comma-separated non-negative
// base-10 integers only; anything else -> null.
function parseIndexPath(str) {
  if (typeof str !== 'string' || str === '') return null;
  const parts = str.split(',').map((p) => p.trim());
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const numbers = parts.map((p) => Number(p));
  return numbers.every(Number.isSafeInteger) ? numbers : null;
}

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

module.exports = {
  isLoopback,
  isCrossSiteBrowserRequest,
  isAllowedHost,
  parseIndexPath,
  isSafeExternalUrl,
};
