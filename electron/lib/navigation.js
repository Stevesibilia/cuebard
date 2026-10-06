// Navigation guard check: may a window loaded from `appUrl` navigate to
// `targetUrl`? Used by hardenWebContents (windows.js) for will-navigate and
// will-redirect.
//   http(s): same origin (dev server, e.g. http://localhost:3000)
//   file:    same file (the app's index / player page; query and hash free)
//   other (data:, no appUrl): never
function isSameAppUrl(targetUrl, appUrl) {
  let target;
  let app;
  try {
    target = new URL(targetUrl);
    app = new URL(appUrl);
  } catch (_) {
    return false;
  }
  if (target.protocol !== app.protocol) return false;
  if (app.protocol === 'http:' || app.protocol === 'https:') {
    return target.origin === app.origin;
  }
  if (app.protocol === 'file:') {
    return target.host === app.host && target.pathname === app.pathname;
  }
  return false;
}

module.exports = { isSameAppUrl };
