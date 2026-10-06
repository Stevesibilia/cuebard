const { compareVersions } = require('./version');

// Where releases are published. electron-updater reads the same repository
// from the app-update.yml that electron-builder writes from `build.publish`.
const RELEASE_REPO = 'Stevesibilia/cuebard';
const LATEST_RELEASE_API = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${RELEASE_REPO}/releases/latest`;

// Turns the GitHub "latest release" payload into the info the update modal
// shows, or null when that release is not newer than the running version.
function parseLatestRelease(release, currentVersion) {
  const tag = release && typeof release.tag_name === 'string' ? release.tag_name : '';
  const newVersion = tag.replace(/^v/, '');
  if (!/^\d+(\.\d+)*$/.test(newVersion)) {
    throw new Error(`Unexpected release tag: ${JSON.stringify(release && release.tag_name)}`);
  }
  if (compareVersions(newVersion, currentVersion) <= 0) return null;

  return {
    currentVersion,
    newVersion,
    releaseNotes: typeof release.body === 'string' ? release.body : '',
    releaseDate: release.published_at || '',
    downloadUrl: typeof release.html_url === 'string' && release.html_url.startsWith('https://github.com/')
      ? release.html_url
      : RELEASES_PAGE,
    isManualUpdate: true,
  };
}

module.exports = { LATEST_RELEASE_API, RELEASES_PAGE, parseLatestRelease };
