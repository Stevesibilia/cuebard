#!/usr/bin/env node
// Prepares the electron-updater manifests (latest*.yml) for a release.
//
//   node scripts/update-manifests.js <artifacts-dir> [<mac-arch-dir>...]
//
// Each macOS architecture is built by its own job and writes its own
// latest-mac.yml listing only that architecture's files. electron-updater
// filters one manifest's `files` by the running architecture, so a release
// needs a single latest-mac.yml that lists both. The per-architecture
// directories are merged into <artifacts-dir>, then every manifest there gets
// its checksums and sizes recomputed from the files that will be published.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

const MAC_MANIFEST = 'latest-mac.yml';

// Union of the `files` lists (by url), on top of the first manifest.
function mergeManifests(docs) {
  if (docs.length === 0) {
    throw new Error('No manifest to merge');
  }
  const versions = new Set(docs.map((doc) => doc.version));
  if (versions.size > 1) {
    throw new Error(`Manifests disagree on the version: ${[...versions].join(', ')}`);
  }

  const merged = { ...docs[0], files: [...(docs[0].files || [])] };
  const seen = new Set(merged.files.map((file) => file.url));
  for (const doc of docs.slice(1)) {
    for (const file of doc.files || []) {
      if (!seen.has(file.url)) {
        merged.files.push(file);
        seen.add(file.url);
      }
    }
  }
  return merged;
}

function sha512Base64(filePath) {
  return crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64');
}

// Returns the manifest with sha512, size and blockMapSize taken from the
// files in `dir`. Throws when a listed file is not there.
function refreshChecksums(doc, dir) {
  const files = (doc.files || []).map((file) => {
    const filePath = path.join(dir, file.url);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Manifest lists a file that is not in ${dir}: ${file.url}`);
    }
    const refreshed = { ...file, sha512: sha512Base64(filePath), size: fs.statSync(filePath).size };
    if ('blockMapSize' in file && fs.existsSync(`${filePath}.blockmap`)) {
      refreshed.blockMapSize = fs.statSync(`${filePath}.blockmap`).size;
    }
    return refreshed;
  });

  const result = { ...doc, files };
  // The top-level path/sha512 mirror one of the files entries.
  const top = files.find((file) => file.url === doc.path);
  if (top) {
    result.sha512 = top.sha512;
  }
  return result;
}

function readManifest(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function writeManifest(filePath, doc) {
  fs.writeFileSync(filePath, yaml.dump(doc, { lineWidth: -1 }));
}

function run(artifactsDir, macDirs) {
  fs.mkdirSync(artifactsDir, { recursive: true });

  const macDocs = [];
  for (const dir of macDirs) {
    for (const name of fs.readdirSync(dir)) {
      if (name === MAC_MANIFEST) {
        macDocs.push(readManifest(path.join(dir, name)));
      } else {
        fs.copyFileSync(path.join(dir, name), path.join(artifactsDir, name));
      }
    }
  }
  if (macDirs.length > 0) {
    writeManifest(path.join(artifactsDir, MAC_MANIFEST), mergeManifests(macDocs));
  }

  const manifests = fs.readdirSync(artifactsDir).filter((name) => /^latest.*\.yml$/.test(name)).sort();
  for (const name of manifests) {
    const manifestPath = path.join(artifactsDir, name);
    const doc = refreshChecksums(readManifest(manifestPath), artifactsDir);
    writeManifest(manifestPath, doc);
    console.log(`${name}:`);
    for (const file of doc.files) {
      console.log(`  ${file.url}  size=${file.size}  sha512=${file.sha512.slice(0, 16)}...`);
    }
  }
  return manifests;
}

if (require.main === module) {
  const [artifactsDir, ...macDirs] = process.argv.slice(2);
  if (!artifactsDir) {
    console.error('Usage: update-manifests.js <artifacts-dir> [<mac-arch-dir>...]');
    process.exit(2);
  }
  try {
    run(artifactsDir, macDirs);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { mergeManifests, refreshChecksums, run };
