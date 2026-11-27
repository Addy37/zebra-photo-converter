// The static preview can serve checked-in classic scripts without a build.
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
import ts from 'typescript';

function tokens(source) {
  const scanner = ts.createScanner(ts.ScriptTarget.ESNext, true, ts.LanguageVariant.Standard, source);
  const result = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    result.push([kind, scanner.getTokenText()]);
  }
  return result;
}
for (const name of ['barcode', 'thermal', 'catalog']) {
  const typed = readFileSync('app/core/' + name + '.ts', 'utf8');
  const runtime = 'app/runtime/' + name + '.js';
  const compiled = stripTypeScriptTypes(typed, { mode: 'strip' });
  if (process.argv.includes('--write')) writeFileSync(runtime, compiled);
  assert.deepEqual(tokens(readFileSync(runtime, 'utf8')), tokens(compiled), runtime + ' is out of sync; run npm run generate:core');
  console.log(runtime + ': matches TypeScript source');
}
