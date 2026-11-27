// One-time migration verification. Expected to fail after intentional app changes.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const expected = {
  'index.html': '3c33d82c2db4543175e24a437726e287cadd4d95',
  'beta.html': '404fa10e81f6111c415a710d9e098cd50002a716',
};
for (const [page, sha] of Object.entries(expected)) {
  const source = readFileSync(page, 'utf8')
    .replace(/<script([^>]*?) src="\.\/(app\/[^"]+)" vite-ignore><\/script>/g,
      (_, attrs, path) => '<script' + attrs + '>' + readFileSync(path, 'utf8') + '</script>')
    .replace(/<link([^>]*?) rel="stylesheet" href="\.\/(app\/[^"]+)" vite-ignore>/g,
      (_, attrs, path) => '<style' + attrs + '>' + readFileSync(path, 'utf8') + '</style>')
    .replace(/ vite-ignore(?=>)/g, '');
  const bytes = Buffer.from(source);
  const hash = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  assert.equal(hash, sha, page + ' must reconstruct the exact approved original');
  console.log(page + ': byte-for-byte reconstruction verified');
}
