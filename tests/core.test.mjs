import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function core(name, global) {
  const context = vm.createContext({});
  return vm.runInContext(readFileSync('app/runtime/' + name + '.js', 'utf8') + '\n' + global, context);
}
const barcode = core('barcode', 'AddyBuyBarcode');
const thermal = core('thermal', 'AddyBuyThermal');
const catalog = core('catalog', 'AddyBuyCatalog');
const plain = value => JSON.parse(JSON.stringify(value));

test('UPC retains leading zeros, validates check digit and has 95 barcode modules', () => {
  assert.equal(barcode.normalizeUPC('03600029145'), '036000291452');
  assert.equal(barcode.normalizeUPC('036000291452'), '036000291452');
  assert.throws(() => barcode.normalizeUPC('036000291453'), /check digit/);
  assert.throws(() => barcode.normalizeUPC('123'), /11 or 12/);
  const bits = barcode.upcBits('036000291452');
  assert.equal(bits.length, 95);
  assert.equal(bits.slice(0,3), '101');
  assert.equal(bits.slice(45,50), '01010');
  assert.equal(bits.slice(-3), '101');
});
test('Code 128 numeric compaction and checksum, geometry and rejection', () => {
  assert.deepEqual(plain(barcode.compactCode128('123456')), [105,12,34,56,44,106]);
  assert.deepEqual(plain(barcode.compactCode128('A')), [104,33,34,106]);
  assert.throws(() => barcode.compactCode128('é'), /Invalid Code 128/);
  const g = barcode.barcodeGeometry(barcode.compactCode128('123456'),812,26);
  assert.equal(g.modules,68);
  assert.equal(g.module,5);
  assert.equal(g.x,236);
});
test('thermal threshold and ZPL packing preserve transparency and row padding', () => {
  const p = new Uint8ClampedArray([0,0,0,255,255,255,255,255,0,0,0,0]);
  assert.equal(thermal.rasterGraphic(p,3,1),'^FO0,0^GFA,1,1,1,80^FS');
  const t = new Uint8ClampedArray([149,149,149,255,150,150,150,255,0,0,0,0]);
  assert.equal(thermal.solidThermalPixels(t), t);
  assert.deepEqual([...t],[0,0,0,255,255,255,255,255,255,255,255,255]);
});
test('CSV streaming handles quotes, commas, CRLF and chunk boundaries', () => {
  const parse = catalog.csvParser();
  assert.deepEqual(plain(parse('SKU,Product,UPC\r',false)), [['SKU','Product','UPC']]);
  assert.deepEqual(plain(parse('\n0007,"TV, 55',false)), []);
  assert.deepEqual(plain(parse('""",036000291452\r\n',true)), [['0007','TV, 55"','036000291452']]);
  assert.throws(() => catalog.csvParser()('"unfinished',true), /quoted field/);
  assert.deepEqual(plain(catalog.rowRecord(['0007','TV','036000291452'],[0,1,2,-1,-1,-1])), {sku:'7',product:'TV',upc:'036000291452'});
  assert.equal(catalog.rowRecord(['7','TV','000000000000'],[0,1,2,-1,-1,-1]),null);
});
test('catalog ranking and OCR keep existing priorities', () => {
  const row = {row:{sku:'6549413',upc:'036000291452'},model:'GDT670SGVBB',product:'GE DISHWASHER'};
  assert.equal(catalog.catalogUPC('0036000291452'),'036000291452');
  assert.equal(catalog.rankProduct(row,'036000291452','036000291452',true),0);
  assert.equal(catalog.rankProduct(row,'6549413','6549413',true),1);
  assert.equal(catalog.rankProduct(row,'GDT670SGVBB','GDT670SGVBB',false),2);
  assert.equal(catalog.rankProduct(row,'654','654',true),3);
  assert.equal(catalog.rankProduct(row,'GDT670','GDT670',false),4);
  assert.equal(catalog.rankProduct(row,'DISHWASHER','DISHWASHER',false),5);
  assert.equal(catalog.rankProduct(row,'NOPE','NOPE',false),-1);
  assert.equal(catalog.modelKey('gdt-670 sgvbb'),'GDT670SGVBB');
  assert.equal(catalog.ocrRanker('MODEL: GDT670SGVBB','GDT670SGVBB')('GDT670SGVBB'),0);
  assert.equal(catalog.ocrRanker('MODEL: GDT67OSGVBB','GDT67OSGVBB')('GDT670SGVBB'),2);
  assert.ok(plain(catalog.modelCandidates('MODEL: GDT670SGVBB')).includes('GDT670SGVBB'));
});
