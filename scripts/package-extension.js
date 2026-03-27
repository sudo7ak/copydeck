const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

const DIST_DIR = path.join(repoRoot, 'dist');
const EXT_DIR = path.join(DIST_DIR, 'extension');

const INCLUDE_PATHS = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup',
  'icons',
  'LICENSE',
  'README.md',
];

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function readManifestVersion() {
  const manifestPath = path.join(repoRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.version) {
    throw new Error('manifest.json is missing "version"');
  }
  return manifest.version;
}

function zipDirMac(zipPath, dirToZip) {
  // Uses the system zip (available by default on macOS). The -r flag recurses.
  execFileSync('zip', ['-r', zipPath, '.'], {
    cwd: dirToZip,
    stdio: 'inherit',
  });
}

function main() {
  const version = readManifestVersion();

  rmrf(DIST_DIR);
  fs.mkdirSync(EXT_DIR, { recursive: true });

  for (const rel of INCLUDE_PATHS) {
    const src = path.join(repoRoot, rel);
    if (!fs.existsSync(src)) {
      console.warn(`[package] Skipping missing path: ${rel}`);
      continue;
    }
    copyRecursive(src, path.join(EXT_DIR, rel));
  }

  const zipName = `copydeck-${version}.zip`;
  const zipPath = path.join(DIST_DIR, zipName);

  // Ensure we don't include macOS metadata files if they exist.
  for (const junk of ['.DS_Store', '__MACOSX']) {
    rmrf(path.join(EXT_DIR, junk));
  }

  zipDirMac(zipPath, EXT_DIR);

  console.log(`\n[package] Created: ${zipPath}`);
  console.log('[package] Upload this ZIP in the Chrome Web Store Developer Dashboard.');
}

main();
