

(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
var sku=$('upcSkuInput'),upc=$('upcInput'),match=$('catalogMatch'),fileInput=$('catalogFile'),cancel=$('catalogCancel'),clear=$('catalogClear'),badge=$('catalogBadge'),status=$('catalogStatus'),progress=$('catalogProgress'),panel=$('catalogPanel');
var dbPromise=null,active=null,busy=false,cancelled=false,lookupTicket=0,lookupTimer=null,autoValue='',settingUPC=false;
var modelInput=$('catalogModel'),choices=$('catalogChoices'),selectingModel=false,modelSearching=false;
var searchCache=null,cacheBuild=null,cacheEpoch=0;
var DB='addy-buy-product-catalog-v1',LOCK='addy-buy-catalog-write-v1',SLOTS=['productsA','productsB'];
var skuKey=AddyBuyCatalog.skuKey,validUPC=AddyBuyCatalog.validUPC;
function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise(function(resolve,reject){
    if(!window.indexedDB){reject(new Error('Local browser storage is unavailable.'));return;}
    var req=indexedDB.open(DB,1);
    req.onupgradeneeded=function(){
      var db=req.result;SLOTS.forEach(function(name){db.createObjectStore(name,{keyPath:'sku'});});db.createObjectStore('meta');
    };
    req.onsuccess=function(){var db=req.result;db.onversionchange=function(){db.close();dbPromise=null;};resolve(db);};
    req.onerror=function(){reject(req.error||new Error('Could not open local storage.'));};
    req.onblocked=function(){reject(new Error('Close other ADDY BUY tabs and try again.'));};
  }).catch(function(e){dbPromise=null;throw e;});
  return dbPromise;
}
function done(tx){
  return new Promise(function(resolve,reject){
    tx.oncomplete=resolve;tx.onabort=function(){reject(tx.error||new Error('Storage transaction failed.'));};
    tx.onerror=function(){};
  });
}
function getMeta(db){
  return new Promise(function(resolve,reject){
    var tx=db.transaction('meta','readonly'),r=tx.objectStore('meta').get('active');
    r.onsuccess=function(){resolve(r.result||null);};r.onerror=function(){reject(r.error);};
  });
}
function clearSlot(db,slot){
  var tx=db.transaction(slot,'readwrite'),finished=done(tx);tx.objectStore(slot).clear();return finished;
}
function writeRows(db,slot,rows){
  var tx=db.transaction(slot,'readwrite'),finished=done(tx),store=tx.objectStore(slot);
  rows.forEach(function(row){store.add(row);});return finished;
}
function activate(db,metadata){
  var tx=db.transaction('meta','readwrite'),finished=done(tx);
  tx.objectStore('meta').put(metadata,'active');return finished;
}
function readSKU(db,key){
  return new Promise(function(resolve,reject){
    var tx=db.transaction(['meta'].concat(SLOTS),'readonly'),r=tx.objectStore('meta').get('active');
    tx.onabort=function(){reject(tx.error||new Error('Lookup failed.'));};
    r.onerror=function(){reject(r.error);};
    r.onsuccess=function(){
      var m=r.result;if(!m||SLOTS.indexOf(m.slot)<0){resolve({meta:null,row:null});return;}
      var q=tx.objectStore(m.slot).get(key);
      q.onsuccess=function(){resolve({meta:m,row:q.result||null});};q.onerror=function(){reject(q.error);};
    };
  });
}
var csvParser=AddyBuyCatalog.csvParser,getColumns=AddyBuyCatalog.getColumns,rowRecord=AddyBuyCatalog.rowRecord;
var hostedLoading=false,hostedController=null,hostedButton=$('loadHostedCatalog');
function say(text){status.textContent=text;if(hostedLoading&&!active)showMatch(text,'');}
function showMatch(text,state){match.hidden=!text;match.textContent=text;match.dataset.state=state||'';}
function sync(){
  badge.textContent=active?'· '+Number(active.count).toLocaleString()+' products':'· Not loaded';
  modelInput.disabled=busy;
  hostedButton.disabled=busy;
  clear.disabled=busy||!active;
  fileInput.disabled=busy;cancel.hidden=!busy;
}
function hideChoices(){choices.replaceChildren();choices.hidden=true;}
function clearAuto(){
  hideChoices();
  if(autoValue&&upc.value===autoValue){settingUPC=true;upc.value='';upc.dispatchEvent(new Event('input',{bubbles:true}));settingUPC=false;}
  autoValue='';showMatch('');document.dispatchEvent(new CustomEvent('addy-catalog-match',{detail:null}));
}
async function lookup(){
  var key=skuKey(sku.value),ticket=++lookupTicket;
  if(!key||busy)return;
  try{
    var result=await readSKU(await openDB(),key);
    if(ticket!==lookupTicket||key!==skuKey(sku.value)||busy)return;
    active=result.meta;sync();
    if(!result.meta){showMatch('Import the product catalog first, or enter the UPC manually.','error');return;}
    if(!result.row){clearAuto();showMatch('SKU not found in this catalog. Enter the verified UPC manually.','error');return;}
    applyRow(result.row,'');
  }catch(e){if(ticket===lookupTicket)showMatch('Local lookup failed. Manual UPC entry is available.','error');}
}
var modelKey=AddyBuyCatalog.modelKey;
function details(row,matchedModel){
  var out=Object.assign({},row),notes=[];
  if(!out.brand){
    var product=String(out.product||'').toUpperCase().trim();
    var brands=['FISHER & PAYKEL','GENERAL ELECTRIC','HISENSE','SAMSUNG','WHIRLPOOL','KITCHENAID','FRIGIDAIRE','MAYTAG','BOSCH','INSIGNIA','LG','GE','SONY','TCL','VIZIO','PANASONIC','SHARP','ELECTROLUX','AMANA','HAIER','MIDEA','DANBY','CAFE','MONOGRAM','THERMADOR','JENNAIR','DACOR','HITACHI','TOSHIBA','PHILIPS','DYSON','SHARK','BISSELL','NINJA','HISENSE','ROKU','APPLE','DELL','HP','LENOVO','ASUS','ACER','MSI','HARMAN KARDON','JBL','BOSE','PIONEER'];
    var brand=brands.find(function(b){return product===b||product.startsWith(b+' ')||product.startsWith(b+'-');});
    if(brand){out.brand=brand;notes.push('brand inferred from description');}
  }
  return {row:out,notes:notes};
}
function applyRow(row,matchedModel){
  var info=details(row,matchedModel);
  autoValue=row.upc;
  settingUPC=true;upc.value=autoValue;upc.dispatchEvent(new Event('input',{bubbles:true}));settingUPC=false;
  showMatch('');
  document.dispatchEvent(new CustomEvent('addy-catalog-match',{detail:info.row}));
}
function resetSearch(){
  clearTimeout(lookupTimer);++lookupTicket;modelSearching=false;clearAuto();
  if(upc.value){settingUPC=true;upc.value='';upc.dispatchEvent(new Event('input',{bubbles:true}));settingUPC=false;}
}
function schedule(){
  if(selectingModel)return;
  resetSearch();modelInput.value='';sync();
  if(active&&!busy&&skuKey(sku.value))lookupTimer=setTimeout(lookup,150);
}
function readBatch(db,slot,last){
  return new Promise(function(resolve,reject){
    var tx=db.transaction(slot,'readonly'),store=tx.objectStore(slot),range=last===null?undefined:IDBKeyRange.lowerBound(last,true),req=store.getAll(range,4000);
    req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error);};tx.onabort=function(){reject(tx.error||new Error('Read interrupted.'));};
  });
}
function cacheKey(meta){return meta.slot+'|'+meta.importedAt;}
function invalidateCache(){++cacheEpoch;searchCache=null;cacheBuild=null;}
async function warmCache(meta){
  if(!meta)return [];
  var key=cacheKey(meta),epoch=cacheEpoch;
  if(searchCache&&searchCache.key===key)return searchCache.rows;
  if(cacheBuild&&cacheBuild.key===key)return cacheBuild.promise;
  var promise=(async function(){
    var db=await openDB(),last=null,batch,rows=[];
    do{
      if(epoch!==cacheEpoch)throw new Error('Catalog changed.');
      batch=await readBatch(db,meta.slot,last);
      if(epoch!==cacheEpoch)throw new Error('Catalog changed.');
      for(var i=0;i<batch.length;i++){
        var row=batch[i];rows.push({row:row,model:modelKey(row.model),product:String(row.product||'').toUpperCase()});
      }
      if(batch.length)last=batch[batch.length-1].sku;
      await new Promise(function(resolve){setTimeout(resolve,0);});
    }while(batch.length===4000);
    var current=await getMeta(db);
    if(epoch!==cacheEpoch||!current||cacheKey(current)!==key)throw new Error('Catalog changed. Search again.');
    searchCache={key:key,rows:rows};return rows;
  })();
  cacheBuild={key:key,promise:promise};
  try{return await promise;}finally{if(cacheBuild&&cacheBuild.promise===promise)cacheBuild=null;}
}
// Only prewarm when the user enters a catalog-related task. Photo-only startup
// does not read the full catalog into memory. Searches share any in-flight build.
function prewarmForSearch(){if(active&&!busy)warmCache(active).catch(function(){});}
modelInput.addEventListener('focus',prewarmForSearch);
$('verifyMode').addEventListener('click',prewarmForSearch);
function selectProduct(row){
  selectingModel=true;sku.value=row.sku;sku.dispatchEvent(new Event('input',{bubbles:true}));
  selectingModel=false;modelInput.value=row.sku;hideChoices();applyRow(row,'');sync();
}
var catalogUPC=AddyBuyCatalog.catalogUPC,createProductRanker=AddyBuyCatalog.createProductRanker,ocrModelKeys=AddyBuyCatalog.ocrModelKeys,ocrRanker=AddyBuyCatalog.ocrRanker;
async function lookupModel(scan){
  var raw=modelInput.value.trim().toUpperCase(),key=modelKey(raw),numeric=/^\d+$/.test(raw),ticket=++lookupTicket;
  var ocr=scan&&scan.kind==='ocr'?ocrRanker(scan.value,scan.preferred):null;
  if((!ocr&&(numeric?raw.length:key.length)<3)||busy)return;
  if(!active){showMatch('Import a catalog or enter product details manually.','error');return;}
  modelSearching=true;hideChoices();showMatch('Searching…','');
  try{
    var db=await openDB(),meta=await getMeta(db);
    if(ticket!==lookupTicket||busy)return;
    if(!meta)throw new Error('Import a catalog first.');
    active=meta;
    // An exact seven-digit manual SKU is always the highest eligible rank.
    // Use the existing IndexedDB primary key rather than waiting for a full scan.
    if(!scan&&/^\d{7}$/.test(raw)){
      var direct=await readSKU(db,raw);
      if(ticket!==lookupTicket||busy)return;
      if(!direct.meta||cacheKey(direct.meta)!==cacheKey(meta)){showMatch('Catalog changed. Search again.','error');return;}
      if(direct.row&&direct.row.sku===raw){selectProduct(direct.row);return;}
    }
    var rows=await warmCache(meta),buckets=Array.from({length:7},function(){return []; }),total=0;
    var exactUPC=catalogUPC(raw),ranker=createProductRanker(raw,key,numeric);
    var barcodeUPC=scan&&scan.kind==='barcode'&&exactUPC;
    if(ticket!==lookupTicket||busy)return;
    for(var i=0;i<rows.length;i++){
      var rank=barcodeUPC?(rows[i].row.upc===exactUPC?0:-1):ocr?ocr(rows[i].model):ranker(rows[i]);
      if(rank>=0){total++;if(buckets[rank].length<10)buckets[rank].push(rows[i].row);}
      if(i>0&&i%20000===0){await new Promise(function(resolve){setTimeout(resolve,0);});if(ticket!==lookupTicket||busy)return;}
    }
    if(ticket!==lookupTicket||busy)return;
    var exactOCR=ocr&&(buckets[0].length||buckets[1].length);
    var results=[].concat.apply([],ocr&&exactOCR?buckets.slice(0,2):buckets).slice(0,10);
    if(!results.length){showMatch(ocr?'No catalog model matched the photo. Try a closer picture or enter the model.':'No matching SKU, model or UPC found.','error');return;}
    var manualExact=!scan&&((exactUPC&&buckets[0].length===1)||(/^\d{7}$/.test(raw)&&buckets[1].length===1)||(document.documentElement.dataset.toolMode==='verify'&&!buckets[0].length&&!buckets[1].length&&buckets[2].length===1));
    if(manualExact||(scan&&scan.kind==='barcode'&&total===1&&(buckets[0].length||buckets[1].length||buckets[2].length))){
      var latest=await readSKU(db,results[0].sku);
      if(ticket!==lookupTicket||busy)return;
      if(latest.meta&&cacheKey(latest.meta)===cacheKey(meta)&&latest.row&&latest.row.upc===results[0].upc){selectProduct(latest.row);if(scan)document.dispatchEvent(new CustomEvent('addy-scan-success',{detail:{message:'Scan successful: product matched',product:latest.row}}));return;}
      showMatch('Catalog changed. Scan again.','error');return;
    }
    showMatch(ocr&&!exactOCR?'Possible model matches. Verify and select the correct product.':results.length>1?'Select the correct product.':'Select product.','ok');
    results.forEach(function(row){
      var btn=document.createElement('button');btn.type='button';btn.className='catalog-result';
      var body=document.createElement('span');body.className='catalog-result-body';
      var title=document.createElement('strong');title.className='catalog-result-title';title.textContent=row.product||'Product';
      var resultMeta=document.createElement('span');resultMeta.className='catalog-result-meta';
      var skuLabel=document.createElement('span');skuLabel.className='catalog-result-sku';skuLabel.textContent='SKU '+row.sku;
      var modelLabel=document.createElement('span');modelLabel.textContent=row.model||'No model';
      var upcLabel=document.createElement('span');upcLabel.textContent='UPC '+row.upc;
      resultMeta.append(skuLabel,modelLabel,upcLabel);body.append(title,resultMeta);
      var arrow=document.createElement('span');arrow.className='catalog-result-arrow';arrow.setAttribute('aria-hidden','true');
      btn.append(body,arrow);
      btn.addEventListener('click',async function(){
        try{
          var latest=await readSKU(db,row.sku);
          if(ticket!==lookupTicket||busy)return;
          if(!latest.meta||cacheKey(latest.meta)!==cacheKey(meta)||!latest.row||latest.row.upc!==row.upc){hideChoices();showMatch('Catalog changed. Search again.','error');return;}
          selectProduct(latest.row);if(scan)document.dispatchEvent(new CustomEvent('addy-scan-success',{detail:{message:'Scan successful: product matched',product:latest.row}}));
        }catch(e){showMatch('Could not retrieve product. Try again.','error');}
      });choices.appendChild(btn);
    });choices.hidden=false;choices.scrollTop=0;
  }catch(e){if(ticket===lookupTicket)showMatch(e.message||'Local search failed.','error');}
  finally{if(ticket===lookupTicket){modelSearching=false;sync();}}
}
document.addEventListener('addy-product-scan',function(e){
  if(busy){showMatch('Catalog is still loading. Try again when ready.','error');return;}
  var scan=e.detail;
  if(!scan||!['ocr','barcode'].includes(scan.kind))return;
  resetSearch();selectingModel=true;sku.value='';sku.dispatchEvent(new Event('input',{bubbles:true}));selectingModel=false;
  modelInput.value=scan.kind==='ocr'?'':String(scan.value||'').trim();
  if(scan.kind==='ocr'&&!ocrModelKeys(scan.value).size&&modelKey(scan.preferred).length<4){showMatch('No model number read. Try a closer photo.','error');return;}
  lookupModel(scan);
});
sku.addEventListener('input',schedule);
modelInput.addEventListener('input',function(){
  resetSearch();selectingModel=true;sku.value='';sku.dispatchEvent(new Event('input',{bubbles:true}));selectingModel=false;sync();
  if(modelInput.value.trim().length>=3)lookupTimer=setTimeout(lookupModel,120);
});
modelInput.addEventListener('keydown',function(e){
  if(e.key==='Enter'){e.preventDefault();clearTimeout(lookupTimer);lookupModel();}
  if(e.key==='ArrowDown'&&!choices.hidden){e.preventDefault();choices.querySelector('button')?.focus();}
  if(e.key==='Escape'){++lookupTicket;hideChoices();showMatch('');}
});
upc.addEventListener('input',function(){if(!settingUPC){clearTimeout(lookupTimer);++lookupTicket;modelSearching=false;autoValue='';hideChoices();showMatch('');sync();}});
function withLock(task){
  if(!navigator.locks)return Promise.reject(new Error('This browser does not support safe catalog updates. Use an up-to-date Chrome or Safari browser.'));
  return navigator.locks.request(LOCK,{ifAvailable:true},function(lock){if(!lock)throw new Error('Another ADDY BUY tab is updating the catalog. Close it or try again.');return task();});
}
function checkCancel(){if(cancelled){var e=new Error('Import canceled.');e.name='AbortError';throw e;}}
async function importFile(file,builtIn){
  if(busy||!file)return;
  if(!file.size){say('The CSV is empty.');return;}
  busy=true;cancelled=false;invalidateCache();clearTimeout(lookupTimer);++lookupTicket;modelSearching=false;hideChoices();progress.hidden=false;progress.value=0;sync();say('Preparing local storage…');
  try{
    if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(function(){});
    await withLock(async function(){
      var db=await openDB(),previous=await getMeta(db),slot=previous&&previous.slot===SLOTS[0]?SLOTS[1]:SLOTS[0];
      var activated=false,count=0,skipped=0,rows=[],cols=null,parser=csvParser(),decoder=new TextDecoder('utf-8',{fatal:true}),offset=0;
      try{
        say('Preparing replacement catalog storage…');await clearSlot(db,slot);checkCancel();say('Reading CSV…');
        var batchSize=4000,chunkSize=512*1024;
        while(offset<file.size){
          checkCancel();
          var end=Math.min(file.size,offset+chunkSize),bytes=await file.slice(offset,end).arrayBuffer();
          offset=end;
          var parsed=parser(decoder.decode(bytes,{stream:offset<file.size}),offset===file.size);
          for(var i=0;i<parsed.length;i++){
            if(!cols){cols=getColumns(parsed[i]);continue;}
            var rec=rowRecord(parsed[i],cols);
            if(rec)rows.push(rec);else skipped++;
            if(rows.length>=batchSize){checkCancel();await writeRows(db,slot,rows);count+=rows.length;rows=[];}
          }
          progress.value=Math.floor(offset/file.size*100);
          say('Importing… '+count.toLocaleString()+' saved · '+progress.value+'%');
          await new Promise(function(resolve){setTimeout(resolve,0);});
        }
        checkCancel();
        if(rows.length){await writeRows(db,slot,rows);count+=rows.length;rows=[];}
        checkCancel();
        if(!cols||!count)throw new Error('No usable SKU/UPC records found.');
        if(builtIn&&(count!==361872||skipped!==0))throw new Error('Built-in catalog is incomplete. Try again.');
        var metadata={slot:slot,count:count,importedAt:new Date().toISOString(),skipped:skipped,source:builtIn?'built-in-v2':'manual'};
        await activate(db,metadata);activated=true;active=metadata;
        if(previous&&previous.slot!==slot){say('New catalog saved. Cleaning up old catalog…');try{await clearSlot(db,previous.slot);}catch(e){}}
        say('Catalog ready: '+count.toLocaleString()+' products.'+(skipped?' '+skipped.toLocaleString()+' invalid or placeholder rows skipped.':''));
      }catch(e){
        if(!activated){try{await clearSlot(db,slot);}catch(ignore){}}
        throw e;
      }
    });
  }catch(e){
    var message=e.name==='ConstraintError'?'Duplicate SKU found. Import rejected to avoid ambiguous UPCs.':e.name==='QuotaExceededError'?'Not enough browser storage. Free space or import a smaller authorized catalog.':e.message||'Catalog import failed.';
    say(message+' Existing catalog, if any, was kept.');
  }finally{
    busy=false;cancel.hidden=true;progress.hidden=true;
    try{active=await getMeta(await openDB());}catch(e){}
    sync();if(active){if(document.documentElement.dataset.toolMode==='verify'||document.activeElement===modelInput)prewarmForSearch();if(modelKey(modelInput.value).length>=3)lookupModel();else if(skuKey(sku.value))schedule();}
  }
}
async function loadHostedCatalog(){
  if(busy||hostedLoading)return;
  hostedLoading=true;busy=true;cancelled=false;hostedController=new AbortController();
  var controller=hostedController;
  clearTimeout(lookupTimer);++lookupTicket;modelSearching=false;hideChoices();
  progress.hidden=false;progress.removeAttribute('value');sync();
  say('Downloading product catalog…');
  try{
    var response=await fetch(new URL('addy-buy-catalog-v2.csv.gz',location.href),{signal:controller.signal,cache:'default'});
    if(!response.ok)throw new Error('Built-in catalog unavailable.');
    var blob=await response.blob();
    checkCancel();
    var magic=new Uint8Array(await blob.slice(0,2).arrayBuffer());
    if(magic[0]===31&&magic[1]===139){
      if(typeof DecompressionStream!=='function')throw new Error('Update your browser to load the built-in catalog.');
      say('Preparing product catalog…');
      blob=await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();
    }
    checkCancel();
    var headerText=await blob.slice(0,4096).text();
    var firstLine=headerText.split(/\r\n|\n|\r/,1)[0].replace(/^\uFEFF/,'');
    // Accept standard quoted CSV headers as well as unquoted ones.
    var headerRows=csvParser()(firstLine,true);
    if(headerRows.length!==1)throw new Error('Built-in catalog has an unexpected format.');
    var columns=getColumns(headerRows[0]);
    if(columns[4]<0||columns[5]<0)throw new Error('Built-in catalog is missing Model or Dept.');
    // Hand off to the existing atomic CSV importer, with validation before activation.
    busy=false;await importFile(blob,true);
    if(active){showMatch('');}
    else{showMatch('Catalog setup failed. Tap Load built-in catalog to retry.','error');}
  }catch(e){
    var message=cancelled||e.name==='AbortError'?'Catalog setup canceled.':(e.message||'Built-in catalog unavailable.');
    status.textContent=message;
    if(!active)showMatch(message+' Open Local product catalog to retry or import manually.','error');
  }finally{
    hostedLoading=false;hostedController=null;busy=false;progress.hidden=true;sync();
  }
}
hostedButton.addEventListener('click',loadHostedCatalog);
fileInput.addEventListener('change',function(){var file=fileInput.files&&fileInput.files[0];fileInput.value='';importFile(file);});
cancel.addEventListener('click',function(){cancelled=true;if(hostedController)hostedController.abort();say('Canceling catalog setup…');});
clear.addEventListener('click',async function(){
  if(busy||!active||!window.confirm('Remove the imported product catalog from this browser?'))return;
  busy=true;invalidateCache();clearTimeout(lookupTimer);++lookupTicket;modelSearching=false;hideChoices();sync();
  try{await withLock(async function(){
    var db=await openDB(),tx=db.transaction(['meta'].concat(SLOTS),'readwrite'),finished=done(tx);
    tx.objectStore('meta').delete('active');SLOTS.forEach(function(slot){tx.objectStore(slot).clear();});await finished;
    active=null;clearAuto();say('Catalog removed. Manual UPC entry is available.');
  });}catch(e){say(e.message||'Could not remove catalog.');}finally{busy=false;sync();}
});
openDB().then(getMeta).then(function(m){active=m;sync();if(m){say('Catalog ready: '+Number(m.count).toLocaleString()+' products.');if(document.documentElement.dataset.toolMode==='verify'||document.activeElement===modelInput)prewarmForSearch();if(modelKey(modelInput.value).length>=3)lookupModel();else if(skuKey(sku.value))schedule();}else{loadHostedCatalog();}}).catch(function(){say('Local storage unavailable. Manual UPC entry is available.');});
sync();
})();

