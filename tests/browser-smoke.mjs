import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const base = 'http://127.0.0.1:4173';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'], {stdio:'inherit'});
const fixture = {sku:'6549413',upc:'036000291452',model:'GDT670SGVBB',product:'GE DISHWASHER TEST',brand:'GE',dept:'10'};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a1sAAAAASUVORK5CYII=','base64');
const wait = async (page, id) => page.waitForFunction(id => !document.getElementById(id).disabled, id);
const log = (profile, step) => console.log(profile + ' PASS ' + step);
async function test(browserType, profile, options, path) {
  const browser=await browserType.launch();
  const context=await browser.newContext({...options,reducedMotion:'reduce',acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await context.route(base+'/__fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Test fixture</title>'}));
    await context.route('https://pisces.bbystatic.com/**',route=>route.fulfill({contentType:'image/png',body:png}));
    await page.goto(base+'/__fixture');
    await page.evaluate(async row=>{
      const db=await new Promise((resolve,reject)=>{
        const r=indexedDB.open('addy-buy-product-catalog-v1',1);
        r.onupgradeneeded=()=>{for(const name of ['productsA','productsB'])r.result.createObjectStore(name,{keyPath:'sku'});r.result.createObjectStore('meta');};
        r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
      });
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(['productsA','meta'],'readwrite');
        tx.objectStore('productsA').add(row);
        tx.objectStore('meta').put({slot:'productsA',count:1,importedAt:'2026-01-01T00:00:00Z',source:'manual'},'active');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });db.close();
    },fixture);
    await context.addInitScript(()=>{
      window.__printCalls=0;window.print=()=>{window.__printCalls++;};
      window.__cameraCalls=0;
      // Headless WebKit may omit the native mediaDevices interface entirely.
      // Supply an explicit test-only interface in every browser profile.
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.__cameraCalls++;throw new DOMException('Test denied','NotAllowedError');}}});
    });
    await page.goto(base+path);
    await page.waitForFunction(()=>document.getElementById('catalogBadge').textContent.includes('1 products'));
    assert.equal(await page.locator('html').getAttribute('data-layout'),profile==='Desktop'?'desktop':'mobile');
    await page.locator('#nightModeToggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.reload();
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    await page.locator('#nightModeToggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    log(profile,'startup, layout, stored theme and catalog metadata');
    await page.locator('#verifyMode').click();
    await page.locator('#catalogModel').fill(fixture.sku);
    await page.locator('#verifyCreateLabel').waitFor({state:'visible'});
    assert.equal(await page.locator('#upcInput').inputValue(),fixture.upc);
    if(profile==='Desktop') await page.locator('#searchPreviewWrap .product-visual-photo').waitFor({state:'visible'});
    await page.locator('#verifyCreateLabel').click();
    await wait(page,'saveZpl');
    assert.equal(await page.locator('html').getAttribute('data-tool-mode'),'barcode');
    assert.match(await page.locator('#download').getAttribute('download'),/^UPC_/);
    log(profile,'direct SKU lookup, product preview and create-label action');
    await page.locator('#clearBarcodeForm').click();
    await page.locator('#upcInput').fill('036000291453');
    await page.locator('#upcGenerate').click();
    assert.equal(await page.locator('#upcInput').getAttribute('aria-invalid'),'true');
    await page.locator('#upcInput').fill(fixture.upc);
    await page.locator('#upcGenerate').click();
    await wait(page,'saveZpl');
    await page.waitForFunction(()=>{const img=document.getElementById('printImage');return img.complete&&img.naturalWidth===812&&img.naturalHeight===609;});
    const output=await page.evaluate(async()=>{const b=await fetch(document.getElementById('download').href).then(r=>r.arrayBuffer());const d=new DataView(b);return [d.getUint32(16),d.getUint32(20),new TextDecoder().decode(b).includes('pHYs')];});
    assert.deepEqual(output,[812,609,true]);
    if(profile==='iPhone WebKit'){
      await page.locator('#laptopPrint').click();
      await page.locator('#iosPrintDialog').waitFor({state:'visible'});
      await page.locator('#iosAlreadySetup').click();
      await wait(page,'iosSendLabel');
      await page.locator('#iosPrintClose').click();
    }else{
      await page.locator('#laptopPrint').click();
      assert.equal(await page.evaluate(()=>window.__printCalls),1);
    }
    log(profile,'UPC validation, PNG dimensions/DPI and print handoff (mocked)');
    await page.locator('#batchAddCurrent').click();
    assert.equal(await page.locator('#batchCount').textContent(),'1 entries · 1 labels');
    await page.locator('#batchClear').click();
    await page.locator('#standardLPN').click();
    await page.locator('#lpnInput').fill('LPN12345678');
    await page.locator('#upcGenerate').click();
    await wait(page,'saveZpl');
    assert.match(await page.locator('#download').getAttribute('download'),/^LPN_/);
    await page.locator('#labelFormat').selectOption('disposition');
    await page.locator('#dispType').selectOption('BULK');
    await page.locator('#dispLpn').fill('LPN12345678');
    await page.locator('#dispMore summary').click();
    await page.locator('#upcInput').fill(fixture.upc);
    await page.locator('#upcGenerate').click();
    await wait(page,'saveZpl');
    assert.match(await page.locator('#download').getAttribute('download'),/^Disposition_/);
    log(profile,'batch queue, LPN and disposition label');
    await page.locator('#verifyMode').click();
    await page.locator('#catalogModel').fill(fixture.model);
    await page.locator('#verifyCreateLabel').waitFor({state:'visible'});
    assert.equal(await page.locator('#upcInput').inputValue(),fixture.upc);
    await page.locator('#verifyClear').click();
    await page.locator('#verifyScanProduct').click();
    await page.locator('#scanDialog').waitFor({state:'visible'});
    await page.waitForFunction(()=>window.__cameraCalls>0);
    await page.waitForFunction(()=>document.getElementById('scanStatus').textContent.includes('Camera permission denied'));
    await page.locator('#scanClose').click();
    await page.locator('#scanDialog').waitFor({state:'hidden'});
    log(profile,'model search, automatic camera request and close (permission mocked)');
    await page.locator('#photoMode').click();
    const photo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=30;const x=c.getContext('2d');x.fillStyle='#222';x.fillRect(0,0,40,30);return c.toDataURL('image/png').split(',')[1];});
    await page.locator('#picker').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
    await wait(page,'saveZpl');
    assert.equal(await page.locator('#download').getAttribute('download'),'fixture_Zebra_4x3.png');
    await page.locator('#rotate').click();
    await wait(page,'saveZpl');
    log(profile,'photo conversion and rotation');
    assert.deepEqual(errors,[]);
    log(profile,'no uncaught browser exceptions');
  } catch(error) {
    console.error(profile+' FAILED',await page.locator('#status').textContent().catch(()=>''),await page.locator('#catalogMatch').textContent().catch(()=>''),errors);
    throw error;
  } finally {await browser.close();}
}
try {
  for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break;}catch{}if(i===79)throw Error('Preview server unavailable');await delay(250);}
  await test(chromium,'Desktop',{viewport:{width:1440,height:1000}},'/');
  await test(chromium,'Android emulation',devices['Pixel 7'],'/beta.html');
  await test(webkit,'iPhone WebKit',devices['iPhone 13'],'/beta.html');
} finally {server.kill();}
