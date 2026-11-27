import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

for (const page of ['index.html', 'beta.html']) {
  const html = readFileSync(resolve('dist', page), 'utf8');
  const source = readFileSync(page, 'utf8');
  const refs = value => [...value.matchAll(/(?:src|href)="(\.\/app\/[^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(refs(html), refs(source), page + ' script/CSS order');
  for (const ref of refs(html)) {
    assert.deepEqual(readFileSync(resolve('dist', ref)), readFileSync(resolve(ref)), ref);
  }
  const manifestName = page === 'beta.html' ? 'beta.webmanifest' : 'manifest.webmanifest';
  assert.ok(html.includes('href="' + manifestName + '"') || html.includes('href="./' + manifestName + '"'), 'manifest link');
  const manifest = JSON.parse(readFileSync(resolve('dist', manifestName), 'utf8'));
  for (const icon of manifest.icons) assert.ok(existsSync(resolve('dist', icon.src)), icon.src);
}
assert.deepEqual(readFileSync('dist/addy-buy-catalog-v2.csv.gz'), readFileSync('addy-buy-catalog-v2.csv.gz'));
console.log('Both static pages, source assets, manifests, icons and catalog verified.');
