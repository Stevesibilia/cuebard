// Draws the PNG icons the build needs from the SVG sources in
// app/assets/icons/src, using Chromium so the result matches a browser.
//
//   npx electron scripts/build-icons.js     (or: just icons)
//
// Outputs (committed, so a build never needs this script):
//   app/assets/icons/app/     app icon, window icon, document and archive icons
//   app/assets/icons/linux/   the sizes electron-builder takes for Linux
//   public/assets/icons/      the in-app logo
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ICONS = path.join(__dirname, '..', 'app', 'assets', 'icons');
const SRC = path.join(ICONS, 'src');
const APP = path.join(ICONS, 'app');
const LINUX = path.join(ICONS, 'linux');
const PUBLIC = path.join(__dirname, '..', 'public', 'assets', 'icons');

// [source svg, size in px, output path]
const JOBS = [
  ['app-icon.svg', 1024, path.join(APP, 'app-icon.png')],
  ['app-icon.svg', 256, path.join(APP, 'window-icon.png')],
  ['cuebard-document.svg', 1024, path.join(APP, 'cuebard-document.png')],
  ['cuebard-archive.svg', 1024, path.join(APP, 'cuebard-archive.png')],
  ...[512, 256, 128, 64, 48].map((size) => ['app-icon.svg', size, path.join(LINUX, `${size}x${size}.png`)]),
  // Below 48 px the full quill turns to mush: use the simplified mark
  ...[32, 16].map((size) => ['app-icon-small.svg', size, path.join(LINUX, `${size}x${size}.png`)]),
];

async function render(svgFile, size) {
  const svg = fs.readFileSync(path.join(SRC, svgFile), 'utf8');
  const html = `<!doctype html><html><body style="margin:0;background:transparent">
    <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"
         width="${size}" height="${size}" style="display:block"></body></html>`;

  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  win.webContents.setFrameRate(1);

  const painted = new Promise((resolve) => {
    win.webContents.on('paint', (_event, _dirty, image) => {
      const { width, height } = image.getSize();
      if (width === size && height === size) resolve(image);
    });
  });
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
  win.webContents.invalidate();
  const image = await painted;
  win.destroy();
  return image.toPNG();
}

// Each render closes its window; keep the app alive between them
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  try {
    for (const dir of [APP, LINUX, PUBLIC]) fs.mkdirSync(dir, { recursive: true });
    for (const [svg, size, out] of JOBS) {
      fs.writeFileSync(out, await render(svg, size));
      console.log(`${path.relative(process.cwd(), out)}  ${size}px`);
    }
    fs.copyFileSync(path.join(SRC, 'cuebard-mark.svg'), path.join(PUBLIC, 'cuebard-mark.svg'));
    console.log(`${path.relative(process.cwd(), path.join(PUBLIC, 'cuebard-mark.svg'))}  svg`);
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
