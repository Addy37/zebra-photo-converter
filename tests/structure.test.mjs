import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Script } from 'node:vm';

for (const page of ['index.html', 'beta.html']) {
  test(page + ' uses existing assets in the expected execution order', () => {
    const html = readFileSync(page, 'utf8');
    const scripts = [...html.matchAll(/<script\b[^>]*src="\.\/(app\/[^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(scripts, [
      page === 'beta.html' ? 'app/features/install-beta.js' : 'app/features/install.js',
      'app/runtime/barcode.js',
      'app/runtime/thermal.js',
      'app/runtime/catalog.js',
      'app/features/label-and-photo.js',
      'app/services/catalog.js',
      'app/features/scanner-and-product-search.js',
    ]);
    for (const path of scripts) new Script(readFileSync(path, 'utf8'), { filename: path });
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
      if (match[1].trim()) new Script(match[1], { filename: page });
    }
    const css = [...html.matchAll(/<link\b[^>]*rel="stylesheet" href="\.\/(app\/[^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(css, ['app/styles/application.css', 'app/styles/night-mode.css', 'app/styles/install.css']);
    for (const path of css) assert.ok(existsSync(path), path);
    const manifest = page === 'beta.html' ? 'beta.webmanifest' : 'manifest.webmanifest';
    for (const icon of JSON.parse(readFileSync(manifest, 'utf8')).icons) assert.ok(existsSync(icon.src), icon.src);
    assert.ok(existsSync('addy-buy-catalog-v2.csv.gz'));
    assert.ok(html.includes('id="addy-theme-script"'));
    assert.ok(html.includes('id="addy-splash-script"'));
  });
}

test('visible footer version matches release metadata', () => {
  const {version}=JSON.parse(readFileSync('package.json','utf8'));
  for (const page of ['index.html','beta.html']) {
    const html=readFileSync(page,'utf8');
    const channel=page==='beta.html'?' • Beta channel':'';
    assert.ok(html.includes('id="appVersion">ADDY BUY • v'+version+channel+'</span>'),page);
  }
});
