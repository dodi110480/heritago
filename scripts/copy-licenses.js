/**
 * Copies the third-party license report into the deployed web root.
 *
 * The Angular production build emits `3rdpartylicenses.txt` one level above the
 * web root (`dist/heritago/`, while Nginx serves `dist/heritago/browser/`), which
 * made the bundled license texts - e.g. the MIT notice of `family-chart` -
 * unreachable over HTTP. This step keeps the copyright notices available next to
 * the application files.
 */
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'dist', 'heritago');
const source = path.join(outputDir, '3rdpartylicenses.txt');
const target = path.join(outputDir, 'browser', '3rdpartylicenses.txt');

if (!fs.existsSync(source)) {
  console.warn('[copy-licenses] 3rdpartylicenses.txt not found - skipping (build without extractLicenses?)');
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`[copy-licenses] written ${path.relative(process.cwd(), target)}`);
