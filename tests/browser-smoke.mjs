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
// Geometry of the actual dialog, video element and guide, with the preview
// exposed in a permission-denied test. This does not simulate camera pixels.
async function checkScannerGeometry(page, profile){
  const bounds=await page.evaluate(()=>{
    const d=document.getElementById('scanDialog'),p=document.getElementById('scanPreview'),v=document.getElementById('scanVideo'),g=document.getElementById('scanGuide');
    p.hidden=false;
    const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
    const vv=window.visualViewport;
    const normal=box(g);p.classList.add('model-camera');const model=box(g);p.classList.remove('model-camera');
    const out={dialog:box(d),preview:box(p),video:box(v),normal,model,viewport:{x:vv?.offsetLeft||0,y:vv?.offsetTop||0,w:vv?.width||innerWidth,h:vv?.height||innerHeight},ios:d.hasAttribute('data-ios-viewport'),fit:getComputedStyle(v).objectFit,position:getComputedStyle(v).objectPosition,inline:v.playsInline};
    p.hidden=true;return out;
  });
  const center=(r,k)=>r[k]+r[k==='x'?'w':'h']/2;
  const near=(a,b,msg,tolerance=2)=>assert.ok(Math.abs(a-b)<=tolerance,msg+': '+a+' vs '+b);
  for(const axis of ['x','y']){
    near(center(bounds.dialog,axis),center(bounds.viewport,axis),profile+' dialog center '+axis,4);
    near(center(bounds.video,axis),center(bounds.preview,axis),profile+' video center '+axis);
    near(center(bounds.normal,axis),center(bounds.video,axis),profile+' barcode guide center '+axis);
    near(center(bounds.model,axis),center(bounds.video,axis),profile+' model guide center '+axis);
  }
  assert.ok(bounds.dialog.w<=bounds.viewport.w&&bounds.dialog.h<=bounds.viewport.h);
  assert.ok(bounds.preview.w>0&&bounds.preview.h>0);
  assert.equal(bounds.fit,'cover');assert.equal(bounds.position,'50% 50%');
  assert.equal(bounds.inline,true);
  if(profile==='iPhone WebKit')assert.equal(bounds.ios,true);
  else assert.equal(bounds.ios,false);
  console.log(profile+' layout: '+JSON.stringify(bounds));
}
async function test(browserType, profile, options, path) {
  const browser=await browserType.launch();
  const context=await browser.newContext({...options,reducedMotion:'reduce',acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await context.route(base+'/__fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Test fixture</title>'}));
    await context.route('https://pisces.bbystatic.com/**',route=>route.fulfill({contentType:'image/png',body:png}));
    await context.route('https://cdn.jsdelivr.net/**',route=>route.abort());
    await context.route('https://tessdata.projectnaptha.com/**',route=>route.abort());
    await context.route('https://unpkg.com/**',route=>route.abort());
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
    await page.waitForFunction(()=>document.documentElement.dataset.scannerPreparation==='ready',null,{timeout:90000});
    assert.equal(await page.evaluate(()=>window.__cameraCalls),0);
    assert.equal(await page.evaluate(()=>typeof window.ZXingBrowser),'object');
    assert.ok(await page.evaluate(()=>window.Tesseract&&typeof window.Tesseract.createWorker==='function'));
    log(profile,'both scanners prepared before camera activation, no permission request');
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
    await checkScannerGeometry(page,profile);
    if(profile==='iPhone WebKit'){
      const original=page.viewportSize();
      await page.setViewportSize({width:original.width,height:650});
      await page.waitForFunction(()=>Math.abs(parseFloat(document.getElementById('scanDialog').style.getPropertyValue('--scan-vh'))-window.visualViewport.height)<2);
      await checkScannerGeometry(page,profile);
      await page.setViewportSize(original);
      await page.waitForFunction(()=>Math.abs(parseFloat(document.getElementById('scanDialog').style.getPropertyValue('--scan-vh'))-window.visualViewport.height)<2);
    }
    log(profile,'centered scanner dialog, inline video and barcode/model guides');
    // Decode a real UPC-A image via the actual locally hosted ZXing library.
    // Camera permission is mocked, but the decoder and upload flow are not.
    assert.ok(await page.evaluate(()=>window.ZXingBrowser&&typeof window.ZXingBrowser.BrowserMultiFormatReader==='function'));
    const barcode=await page.evaluate(upc=>{
      const c=document.createElement('canvas');c.width=575;c.height=240;
      const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);
      const bits=AddyBuyBarcode.upcBits(upc);x.fillStyle='black';
      for(let i=0;i<bits.length;i++)if(bits[i]==='1')x.fillRect(50+i*5,20,5,180);
      return c.toDataURL('image/png').split(',')[1];
    },fixture.upc);
    await page.locator('#scanUploadOptions summary').click();
    await page.locator('#scanBarcodePhoto').setInputFiles({name:'upc-fixture.png',mimeType:'image/png',buffer:Buffer.from(barcode,'base64')});
    await page.waitForFunction(()=>/^(0)?036000291452$/.test(document.getElementById('scanReadout').value));
    await page.locator('#scanUse').click();
    await page.locator('#scanDialog').waitFor({state:'hidden'});
    await page.locator('#verifyCreateLabel').waitFor({state:'visible'});
    assert.equal(await page.locator('#upcInput').inputValue(),fixture.upc);
    log(profile,'actual local ZXing UPC decoding and catalog match with CDN blocked');
    log(profile,'model search, automatic camera request and close (permission mocked)');
    await page.locator('#verifyClear').click();
    await page.locator('#verifyScanProduct').click();
    await page.waitForFunction(()=>document.getElementById('scanStatus').textContent.includes('Camera permission denied'));
    const ocrTrace=[];
    await page.exposeFunction('reportOCRStatus',value=>{ocrTrace.push(value);console.log(profile+' OCR: '+value);});
    await page.evaluate(()=>{const status=document.getElementById('scanStatus');new MutationObserver(()=>window.reportOCRStatus(status.textContent)).observe(status,{childList:true,characterData:true,subtree:true});});
    const modelPhoto=await page.evaluate(model=>{
      const c=document.createElement('canvas');c.width=1600;c.height=480;
      const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);
      x.fillStyle='black';x.font='bold 80px monospace';x.fillText('MODEL: '+model,60,220);
      return c.toDataURL('image/png').split(',')[1];
    },fixture.model);
    await page.locator('#scanUploadOptions summary').click();
    await page.locator('#scanModelPhoto').setInputFiles({name:'model-fixture.png',mimeType:'image/png',buffer:Buffer.from(modelPhoto,'base64')});
    await page.waitForFunction(()=>!document.getElementById('scanUse').disabled,null,{timeout:60000});
    const ocrResult=await page.locator('#scanReadout').inputValue();
    console.log(profile+' OCR result: '+JSON.stringify(ocrResult)+'; status: '+await page.locator('#scanStatus').textContent());
    assert.equal(ocrResult,fixture.model,'OCR must recognize the actual model number');
    await page.locator('#scanUse').click();
    await page.locator('#scanDialog').waitFor({state:'hidden'});
    // OCR intentionally requires confirmation of the matching catalog product.
    const match=page.locator('#catalogChoices .catalog-result').filter({hasText:'SKU '+fixture.sku});
    await match.waitFor({state:'visible'});
    assert.equal(await match.count(),1);
    await match.click();
    await page.locator('#verifyCreateLabel').waitFor({state:'visible'});
    assert.equal(await page.locator('#upcInput').inputValue(),fixture.upc);
    log(profile,'actual local Tesseract model recognition and catalog match with CDN blocked');
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
    console.error(profile+' FAILED',await page.locator('#status').textContent().catch(()=>''),await page.locator('#catalogMatch').textContent().catch(()=>''), 'scanner:',await page.locator('#scanStatus').textContent().catch(()=>''),'readout:',await page.locator('#scanReadout').inputValue().catch(()=>''),errors);
    throw error;
  } finally {await browser.close();}
}
try {
  for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break;}catch{}if(i===79)throw Error('Preview server unavailable');await delay(250);}
  const failures=[];
  for(const [engine,profile,options,path] of [[chromium,'Desktop',{viewport:{width:1440,height:1000}},'/'],[chromium,'Android emulation',devices['Pixel 7'],'/beta.html'],[webkit,'iPhone WebKit',devices['iPhone 14 Pro Max'],'/beta.html']]){
    try{await test(engine,profile,options,path);}catch(e){failures.push(profile+': '+e.stack);}
  }
  if(failures.length)throw new Error(failures.join('\n\n'));
} finally {server.kill();}
