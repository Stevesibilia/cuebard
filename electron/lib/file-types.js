const path = require('path');

// Project and archive extensions, CueBard's own first. The LivePlay ones
// stay readable so E-LivePlay projects and archives keep working.
const PROJECT_EXTENSIONS = ['cuebard', 'liveplay'];
const ARCHIVE_EXTENSIONS = ['cbpack', 'lpa'];

const PROJECT_EXTENSION = PROJECT_EXTENSIONS[0];
const ARCHIVE_EXTENSION = ARCHIVE_EXTENSIONS[0];

const extensionOf = (filePath) =>
  path.extname(String(filePath)).slice(1).toLowerCase();

const isProjectFile = (filePath) => PROJECT_EXTENSIONS.includes(extensionOf(filePath));
const isArchiveFile = (filePath) => ARCHIVE_EXTENSIONS.includes(extensionOf(filePath));

module.exports = {
  PROJECT_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  PROJECT_EXTENSION,
  ARCHIVE_EXTENSION,
  isProjectFile,
  isArchiveFile,
};
