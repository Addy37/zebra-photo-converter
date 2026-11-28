
(function(){
'use strict';
var W=812,H=609,MX=26,MY=20;
var input=document.getElementById('picker');
var area=document.getElementById('pickArea');
var canvas=document.getElementById('preview');
var ctx=canvas.getContext('2d');
var quality=document.getElementById('quality');
var share=document.getElementById('share');
var rotate=document.getElementById('rotate');
var download=document.getElementById('download');
var view=document.getElementById('view');
var status=document.getElementById('status');
var photoMode=document.getElementById('photoMode'),barcodeMode=document.getElementById('barcodeMode'),verifyMode=document.getElementById('verifyMode');
var photoPanel=document.getElementById('photoPanel'),barcodePanel=document.getElementById('barcodePanel');
var upcInput=document.getElementById('upcInput'),upcForm=document.getElementById('upcForm'),previewMeta=document.getElementById('previewMeta');
var upcSkuInput=document.getElementById('upcSkuInput');
var formatPanel=document.getElementById('formatPanel'),labelFormat=document.getElementById('labelFormat'),dispositionFields=document.getElementById('dispositionFields'),upcGenerate=document.getElementById('upcGenerate');
var disp={},catalogFilled={},selectedProduct=null,brandEdited=false;
var more=document.getElementById('dispMore'),manualFields=document.getElementById('manualFields'),editDetails=document.getElementById('editProductDetails');
['Type','Category','Channel','Dept','Brand','Model','Product','Lpn','Order','OrderBarcode','Date'].forEach(function(k){disp[k]=document.getElementById('disp'+k);});
function resetLabelDate(){var now=new Date();disp.Date.value=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');}
resetLabelDate();
var orderInput=document.getElementById('orderInput'),lpnInput=document.getElementById('lpnInput'),standardUPC=document.getElementById('standardUPC'),standardLPN=document.getElementById('standardLPN'),includeOrder=document.getElementById('standardIncludeOrder'),standardKind='UPC';
var mode='photo';
var printCopies=document.getElementById('printCopies'),findPrinters=document.getElementById('findPrinters'),directPrint=document.getElementById('directPrint'),printerSelect=document.getElementById('printerSelect');
var laptopPrint=document.getElementById('laptopPrint'),shareZpl=document.getElementById('shareZpl'),saveZpl=document.getElementById('saveZpl'),printStatus=document.getElementById('printStatus'),printImage=document.getElementById('printImage');
var printGraphic='',printers=[],bridgeBase='',printBusy=false,discoverBusy=false;
var batchQueue=[],batchBusy=false;
var batchAddCurrent=document.getElementById('batchAddCurrent'),batchPicker=document.getElementById('batchPicker'),batchClear=document.getElementById('batchClear'),batchList=document.getElementById('batchList'),batchCount=document.getElementById('batchCount'),batchPrint=document.getElementById('batchPrint'),batchShare=document.getElementById('batchShare'),batchStatus=document.getElementById('batchStatus'),batchSheet=document.getElementById('batchSheet');
var source=null,sourceUrl='',outputUrl='',outputFile=null,fileName='photo',degrees=0,revision=0;
var isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
var iosSetupKey='addy-buy-ios-zebra-setup-v1',iosSetupComplete=false,iosDialog=document.getElementById('iosPrintDialog'),iosSetupLink=document.getElementById('iosPrintSetupLink'),iosCopies=document.getElementById('iosPrintCopies'),iosMessage=document.getElementById('iosPrintMessage');
if(isIOS){try{iosSetupComplete=localStorage.getItem(iosSetupKey)==='1';}catch(e){}}
iosSetupLink.hidden=!isIOS;
document.getElementById('needsBrowser').hidden=true;
if(isIOS){document.getElementById('iosNote').style.display='block';}else{share.textContent='Share PNG';}
ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
var layoutMode=document.getElementById('layoutMode'),layoutHint=document.getElementById('layoutHint'),printIntro=document.getElementById('printIntro'),systemPrintHelp=document.getElementById('systemPrintHelp');
var desktopQuery=window.matchMedia('(min-width: 1000px) and (pointer: fine)');
var layoutPreference='auto';
try{var savedLayout=localStorage.getItem('zebra-beta-layout');if(['auto','desktop','mobile'].indexOf(savedLayout)>=0)layoutPreference=savedLayout;}catch(e){}
layoutMode.value=layoutPreference;
function effectiveLayout(preference,wide){return preference==='auto'?(wide?'desktop':'mobile'):preference;}
function applyLayout(){
  var actual=effectiveLayout(layoutMode.value,desktopQuery.matches&&!isIOS&&!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  document.documentElement.setAttribute('data-layout',actual);
  layoutHint.textContent=(layoutMode.value==='auto'?'Auto · ':'')+(actual==='desktop'?'Desktop workspace':'Mobile layout');
  laptopPrint.textContent=actual==='desktop'?'Print label':'System print';
  printIntro.textContent=actual==='desktop'?'Generate a label and use Print label to open your Windows printer dialog.':'Save or share the PNG with your existing printing app. System print is available if your device supports it.';
  systemPrintHelp.textContent=actual==='desktop'?'Select your paired Zebra printer (e.g. Mobile Zebra), 4 × 3-inch stock, actual size, no margins or headers. Set copies in the print dialog.':'System print requires a compatible installed printer service. If unavailable, use Share / Save PNG or your existing Zebra utility.';
  if(isIOS){laptopPrint.textContent='Print label';printIntro.textContent='Print with your Zebra printer using the iPhone setup guide.';systemPrintHelp.textContent='One-time setup with the Zebra app. Safari shares the label file; the Zebra app sends it to the printer.';}
}
layoutMode.addEventListener('change',function(){try{localStorage.setItem('zebra-beta-layout',layoutMode.value);}catch(e){}applyLayout();});
if(desktopQuery.addEventListener)desktopQuery.addEventListener('change',applyLayout);
else if(desktopQuery.addListener)desktopQuery.addListener(applyLayout);
applyLayout();
function setStatus(msg){status.textContent=msg;}
function safeName(name){return (name||'photo').replace(/\.[^.]*$/,'').replace(/[^a-z0-9_ -]/gi,'').trim()||'photo';}
function disableOutput(){
  share.disabled=true;
  [download,view].forEach(function(a){a.classList.add('disabled');a.setAttribute('aria-disabled','true');a.removeAttribute('href');});
  outputFile=null;
  batchAddCurrent.disabled=true;
  resetPrintOutput();
  if(outputUrl){URL.revokeObjectURL(outputUrl);outputUrl='';}
}
function activateOutput(file,blob,zplPixels){
  outputFile=file;
  outputUrl=URL.createObjectURL(blob);
  download.href=outputUrl;download.download=file.name;
  view.href=outputUrl;
  [download,view].forEach(function(a){a.classList.remove('disabled');a.removeAttribute('aria-disabled');});
  share.disabled=false;
  batchAddCurrent.disabled=batchBusy||batchQueue.length>=50;
  preparePrintOutput(zplPixels);
  setStatus('Ready! Choose Share / Save, Download, or Open PNG.');
}
function printMessage(message){printStatus.textContent=message;}
function updatePrintButtons(){
  var ready=!!outputFile&&!!printGraphic;
  laptopPrint.disabled=!ready||printBusy;
  shareZpl.disabled=!ready||printBusy;
  saveZpl.disabled=!ready||printBusy;
  directPrint.disabled=!ready||!bridgeBase||printerSelect.value===''||printBusy||discoverBusy;
  findPrinters.disabled=discoverBusy||printBusy;
  printerSelect.disabled=!printers.length||discoverBusy||printBusy;
}
function resetPrintOutput(){
  printGraphic='';printImage.removeAttribute('src');
  updatePrintButtons();
}
var rasterGraphic=AddyBuyThermal.rasterGraphic;
function preparePrintOutput(zplPixels){
  try{
    printGraphic=rasterGraphic(zplPixels||ctx.getImageData(0,0,W,H).data,W,H);
    printImage.src=outputUrl;
    printMessage('Label ready for printing or ZPL export.');
  }catch(err){printGraphic='';printMessage('Could not prepare ZPL. PNG is still available.');}
  updatePrintButtons();
}
function copiesValue(){
  var n=Number(printCopies.value);
  if(!Number.isInteger(n)||n<1||n>100)throw new Error('Enter a whole number from 1 to 100.');
  return n;
}
function makeZpl(graphic,copies){
  return '^XA\n^PW'+W+'\n^LL'+H+'\n^LH0,0\n'+graphic+'\n^PQ'+copies+',0,1,N\n^XZ\n';
}
function zplFile(){
  if(!outputFile||!printGraphic)throw new Error('Generate a label first.');
  return new File([makeZpl(printGraphic,copiesValue())],outputFile.name.replace(/\.png$/i,'.zpl'),{type:'application/octet-stream'});
}
function downloadZpl(file){
  var url=URL.createObjectURL(file),a=document.createElement('a');
  a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},60000);
}
saveZpl.addEventListener('click',function(){
  try{downloadZpl(zplFile());printMessage('ZPL file downloaded. Send it with a compatible Zebra utility.');}
  catch(e){printMessage(e.message);}
});
shareZpl.addEventListener('click',function(){
  try{
    if(!outputFile||!printGraphic)throw new Error('Generate a label first.');
    var file=new File([makeZpl(printGraphic,copiesValue())],outputFile.name.replace(/\.png$/i,'_ZPL.txt'),{type:'text/plain'});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      navigator.share({files:[file]}).then(function(){printMessage('Share sheet closed. Check your printer before sending again.');}).catch(function(e){printMessage(e.name==='AbortError'?'Share canceled.':'Share failed ('+e.name+'). Use Download ZPL file, then import it in Nucleus Connector.');});
    }else{printMessage('This browser cannot share the text file. Use Download ZPL file, then import it in Nucleus Connector.');}
  }catch(e){printMessage(e.message);}
});
laptopPrint.addEventListener('click',function(){
  if(!outputFile||!printGraphic)return;
  if(isIOS&&iosDialog.showModal){openIOSPrint(false);return;}
  systemPrintLabel();
});
function systemPrintLabel(){
  if(!outputFile||!printGraphic)return;
  printMessage('Select the Bluetooth ZQ630 in the print dialog. Set stock to 4 × 3 inches, actual size, no margins or headers. Set copies there.');
  if(printImage.complete&&printImage.naturalWidth){document.body.removeAttribute('data-print-job');window.print();}
  else{printMessage('Print preview is still loading. Try Print label again.');}
}
function iosPrintScreen(screen){
  var titles={welcome:'Let’s get you printing!',steps:'Connect your Zebra printer',ready:'Print your label'};
  document.getElementById('iosPrintTitle').textContent=titles[screen];
  ['Welcome','Steps','Ready'].forEach(function(s){document.getElementById('iosPrint'+s).hidden=s.toLowerCase()!==screen;});
  iosMessage.textContent='';
  var ready=!!outputFile&&!!printGraphic&&!printBusy;
  ['iosSendLabel','iosSaveLabel','iosAirPrint'].forEach(function(id){document.getElementById(id).disabled=!ready;});
  if(screen==='ready'&&!ready)iosMessage.textContent='Setup saved. Generate a label to print.';
}
function openIOSPrint(setup){
  if(!isIOS||!iosDialog.showModal)return;
  iosCopies.value=printCopies.value;
  iosPrintScreen(setup?'steps':iosSetupComplete?'ready':'welcome');
  if(!iosDialog.open)iosDialog.showModal();
}
function completeIOSSetup(){
  iosSetupComplete=true;try{localStorage.setItem(iosSetupKey,'1');}catch(e){}
  iosPrintScreen('ready');
}
function iosLabelFile(){
  if(!outputFile||!printGraphic)throw new Error('Generate a label first.');
  var n=Number(iosCopies.value);
  if(!Number.isInteger(n)||n<1||n>100)throw new Error('Enter a whole number from 1 to 100.');
  printCopies.value=String(n);
  return zplFile();
}
function iosSaveFile(){
  try{downloadZpl(iosLabelFile());iosMessage.textContent='Save the ZPL to Files if prompted. Open Zebra Setup → Available Files → select or import the file → Send to Printer. Check that it printed before sending again.';}
  catch(e){iosMessage.textContent=e.message;}
}
function iosShareFile(){
  try{
    var file=iosLabelFile();
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      navigator.share({files:[file]}).then(function(){iosMessage.textContent='Share sheet closed. Check the Zebra app and printer before sending again.';}).catch(function(e){iosMessage.textContent=e.name==='AbortError'?'Sharing canceled. Your label is still ready.':'Sharing unavailable. Use Save ZPL file instead, then open Available Files in Zebra Setup.';});
    }else{iosMessage.textContent='This browser cannot share this ZPL file. Use Save ZPL file instead, then open Available Files in Zebra Setup.';}
  }catch(e){iosMessage.textContent=e.message;}
}
iosSetupLink.addEventListener('click',function(){openIOSPrint(true);});
document.getElementById('iosPrintClose').addEventListener('click',function(){iosDialog.close();});
document.getElementById('iosMaybeLater').addEventListener('click',function(){iosDialog.close();});
document.getElementById('iosStartSetup').addEventListener('click',function(){iosPrintScreen('steps');});
document.getElementById('iosSetupBack').addEventListener('click',function(){iosPrintScreen(iosSetupComplete?'ready':'welcome');});
document.getElementById('iosSetupDone').addEventListener('click',completeIOSSetup);
document.getElementById('iosAlreadySetup').addEventListener('click',completeIOSSetup);
document.getElementById('iosRepeatSetup').addEventListener('click',function(){iosPrintScreen('steps');});
document.getElementById('iosSaveLabel').addEventListener('click',iosSaveFile);
document.getElementById('iosSendLabel').addEventListener('click',iosShareFile);
document.getElementById('iosAirPrint').addEventListener('click',function(){iosDialog.close();systemPrintLabel();});
async function bridgeRequest(base,path,options){
  var ctrl=new AbortController(),timer=setTimeout(function(){ctrl.abort();},path==='write'?30000:6000);
  try{
    var response=await fetch(base+path,Object.assign({cache:'no-store',credentials:'omit',signal:ctrl.signal,redirect:'error'},options||{}));
    if(!response.ok)throw new Error('Browser Print returned '+response.status);
    return response;
  }finally{clearTimeout(timer);}
}
findPrinters.addEventListener('click',async function(){
  if(discoverBusy||printBusy)return;
  discoverBusy=true;printers=[];bridgeBase='';printerSelect.replaceChildren(new Option('No printer selected',''));updatePrintButtons();
  printMessage('Looking for local Zebra Browser Print. Approve printer access if prompted.');
  var bases=['http://127.0.0.1:9100/','https://localhost:9101/'];
  try{
    for(var i=0;i<bases.length;i++){
      try{
        var response=await bridgeRequest(bases[i],'available');
        var data=await response.json();
        if(!data||typeof data!=='object')continue;
        var list=Array.isArray(data.printer)?data.printer:[];
        printers=list.filter(function(d){return d&&typeof d.uid==='string'&&d.uid.length>0;});
        bridgeBase=bases[i];
        if(printers.length)break;
      }catch(e){}
    }
    if(!printers.length){printMessage(bridgeBase?'Browser Print found, but no printers are listed. Enable Bluetooth discovery and pair the ZQ630.':'Could not reach Browser Print. Open the companion app, allow local access if prompted, and try again. ZPL and PNG remain available.');return;}
    printers.forEach(function(d,i){printerSelect.add(new Option((d.name||d.uid)+(d.connection?' · '+d.connection:''),String(i)));});
    printMessage('Choose your ZQ630 from the printer list. Nothing is sent until you tap Print.');
  }finally{discoverBusy=false;updatePrintButtons();}
});
printerSelect.addEventListener('change',updatePrintButtons);
directPrint.addEventListener('click',async function(){
  if(printBusy||!outputFile||!printGraphic||!bridgeBase||printerSelect.value==='')return;
  var printer=printers[Number(printerSelect.value)],zpl;
  if(!printer)return;
  try{zpl=makeZpl(printGraphic,copiesValue());}catch(e){printMessage(e.message);return;}
  printBusy=true;updatePrintButtons();printMessage('Sending label to '+(printer.name||printer.uid)+'…');
  try{
    await bridgeRequest(bridgeBase,'write',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({device:printer,data:zpl})});
    printMessage('Browser Print accepted the job. Check the physical printer for the result.');
  }catch(e){printMessage('Print delivery could not be confirmed. Check the printer before retrying to avoid duplicate labels.');}
  finally{printBusy=false;updatePrintButtons();}
});
function batchMessage(message){batchStatus.textContent=message;}
function batchTotal(){return batchQueue.reduce(function(n,item){return n+item.copies;},0);}
function refreshBatchButtons(){
  var total=batchTotal();
  batchCount.textContent=batchQueue.length+' entries · '+total+' labels';
  batchPrint.textContent=total?'Print '+total+' label'+(total===1?'':'s'):'Print queue';
  batchPrint.disabled=batchBusy||!total||total>100;
  batchShare.disabled=batchBusy||!batchQueue.length;
  batchClear.disabled=batchBusy||!batchQueue.length;
  batchPicker.disabled=batchBusy||batchQueue.length>=50;
  batchAddCurrent.disabled=batchBusy||!outputFile||batchQueue.length>=50;
  Array.from(batchList.querySelectorAll('input,button')).forEach(function(el){el.disabled=batchBusy||el.dataset.boundary==='true';});
}
function clearBatchSheet(){document.body.removeAttribute('data-print-job');batchSheet.replaceChildren();}
function makeBatchEntry(file){return {file:file,url:URL.createObjectURL(file),copies:1};}
function renderBatch(){
  batchList.replaceChildren();
  batchQueue.forEach(function(item,index){
    var card=document.createElement('article');card.className='batch-card';
    var thumb=document.createElement('img');thumb.src=item.url;thumb.alt='Label '+(index+1);
    var name=document.createElement('div');name.className='batch-name';name.textContent=(index+1)+'. '+item.file.name;
    var controls=document.createElement('div');controls.className='batch-controls';
    var label=document.createElement('label');label.textContent='Copies';label.htmlFor='batchQty'+index;
    var qty=document.createElement('input');qty.id=label.htmlFor;qty.type='number';qty.min='1';qty.max='100';qty.step='1';qty.value=item.copies;qty.inputMode='numeric';
    qty.addEventListener('change',function(){var n=Number(qty.value);if(!Number.isInteger(n)||n<1||n>100)n=item.copies;item.copies=n;qty.value=n;refreshBatchButtons();batchMessage(batchTotal()>100?'Queue exceeds 100 labels. Reduce copies before printing.':'Queue updated.');});
    controls.append(label,qty);
    function action(title,description,handler,boundary){
      var btn=document.createElement('button');btn.type='button';btn.className='secondary';btn.textContent=title;btn.setAttribute('aria-label',description);if(boundary)btn.dataset.boundary='true';btn.addEventListener('click',handler);controls.appendChild(btn);
    }
    function move(to){if(batchBusy||to<0||to>=batchQueue.length)return;batchQueue.splice(index,1);batchQueue.splice(to,0,item);renderBatch();batchMessage('Queue reordered.');}
    action('↑','Move label '+(index+1)+' up',function(){move(index-1);},index===0);
    action('↓','Move label '+(index+1)+' down',function(){move(index+1);},index===batchQueue.length-1);
    action('Remove','Remove label '+(index+1),function(){if(batchBusy)return;URL.revokeObjectURL(item.url);batchQueue.splice(index,1);renderBatch();batchMessage('Label removed.');});
    card.append(thumb,name,controls);batchList.appendChild(card);
  });
  refreshBatchButtons();
}
batchAddCurrent.addEventListener('click',function(){
  if(batchBusy||!outputFile||batchQueue.length>=50)return;
  batchQueue.push(makeBatchEntry(outputFile));renderBatch();batchMessage('Current label added. Generate another label or print the queue.');
});
batchClear.addEventListener('click',function(){
  if(batchBusy)return;
  batchQueue.forEach(function(item){URL.revokeObjectURL(item.url);});batchQueue=[];renderBatch();batchMessage('Queue cleared.');
});
function loadBatchPhoto(file){
  return new Promise(function(resolve,reject){
    var url=URL.createObjectURL(file),img=new Image();
    img.onload=function(){URL.revokeObjectURL(url);resolve(img);};
    img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('Could not open image'));};
    img.src=url;
  });
}
async function addBatchImages(files){
  if(batchBusy||!files.length)return;
  var available=50-batchQueue.length;
  if(available<=0){batchMessage('Queue is full. Remove labels first.');return;}
  var selected=files.slice(0,available),added=0,failed=0,shading=quality.value;
  batchBusy=true;refreshBatchButtons();
  var scratch=document.createElement('canvas');scratch.width=W;scratch.height=H;
  var scratchCtx=scratch.getContext('2d');
  try{
    for(var i=0;i<selected.length;i++){
      batchMessage('Converting image '+(i+1)+' of '+selected.length+'…');
      try{
        var img=await loadBatchPhoto(selected[i]);
        paintPhoto(scratchCtx,img,0,shading);
        var blob=await withPrintDpi(await toPngBlob(scratch));
        batchQueue.push(makeBatchEntry(new File([blob],safeName(selected[i].name)+'_Zebra_4x3.png',{type:'image/png'})));added++;
      }catch(e){failed++;}
    }
    batchMessage(added+' images added.'+(failed?' '+failed+' could not be converted. Try JPG or PNG.':'')+(files.length>selected.length?' Queue limited to 50 entries.':'')+(batchTotal()>100?' Reduce copies to 100 labels or fewer before printing.':''));
  }finally{scratch.width=0;scratch.height=0;batchBusy=false;renderBatch();}
}
batchPicker.addEventListener('change',function(){var files=Array.from(batchPicker.files||[]);batchPicker.value='';addBatchImages(files);});
function printPage(url){
  var page=document.createElement('div');page.className='batch-page';var img=document.createElement('img');img.alt='';
  var ready=new Promise(function(resolve,reject){img.onload=resolve;img.onerror=function(){reject(new Error('Label image failed to load.'));};});
  page.appendChild(img);img.src=url;return {element:page,ready:ready};
}
batchPrint.addEventListener('click',async function(){
  var total=batchTotal();if(batchBusy||!total||total>100)return;
  batchBusy=true;refreshBatchButtons();batchMessage('Preparing '+total+' separate labels…');clearBatchSheet();
  try{
    var loads=[];
    batchQueue.forEach(function(item){for(var i=0;i<item.copies;i++){var page=printPage(item.url);batchSheet.appendChild(page.element);loads.push(page.ready);}});
    await Promise.all(loads);
    document.body.setAttribute('data-print-job','batch');
    batchMessage('Select Mobile Zebra, actual size, no margins or headers and 1 copy in the print dialog.');
    window.print();
  }catch(e){clearBatchSheet();batchMessage('Could not prepare the batch print. Try again.');}
  finally{batchBusy=false;refreshBatchButtons();}
});
window.addEventListener('afterprint',clearBatchSheet);
batchShare.addEventListener('click',function(){
  if(batchBusy||!batchQueue.length)return;
  var files=batchQueue.map(function(item){return item.file;});
  try{
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:files}))){
      navigator.share({files:files}).then(function(){batchMessage('Share sheet closed. Confirm printing in your app.');}).catch(function(e){batchMessage(e.name==='AbortError'?'Sharing canceled.':'Multiple PNG sharing unavailable. Share individual labels instead.');});
    }else{batchMessage('This browser cannot share multiple PNGs. Use system printing or share individual labels.');}
  }catch(e){batchMessage('Multiple PNG sharing unavailable.');}
});
renderBatch();
function chooseFile(file){
  if(!file||mode!=='photo')return;
  if(!(file.type.indexOf('image/')===0||/\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name||''))){setStatus('Choose a photo, JPG or PNG.');return;}
  var requested=++revision;
  disableOutput();rotate.disabled=true;
  if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl='';}
  source=null;
  sourceUrl=URL.createObjectURL(file);
  var image=new Image();
  setStatus('Opening photo…');
  image.onload=function(){
    if(requested!==revision)return;
    source=image;fileName=safeName(file.name);degrees=0;rotate.disabled=false;
    convert();
  };
  image.onerror=function(){if(requested===revision)setStatus('This photo could not open. Try a JPG or PNG instead.');};
  image.src=sourceUrl;
}
input.addEventListener('change',function(){var files=Array.from(input.files||[]);input.value='';if(files.length>1)addBatchImages(files);else chooseFile(files[0]);});
['dragenter','dragover'].forEach(function(evt){area.addEventListener(evt,function(e){e.preventDefault();area.classList.add('drag');});});
['dragleave','drop'].forEach(function(evt){area.addEventListener(evt,function(e){e.preventDefault();area.classList.remove('drag');});});
area.addEventListener('drop',function(e){if(e.dataTransfer&&e.dataTransfer.files){var files=Array.from(e.dataTransfer.files);if(files.length>1)addBatchImages(files);else chooseFile(files[0]);}});
quality.addEventListener('change',convert);
rotate.addEventListener('click',function(){if(!source)return;degrees=(degrees+90)%360;convert();});
var normalizeUPC=AddyBuyBarcode.normalizeUPC,upcBits=AddyBuyBarcode.upcBits;
function clearPreview(){
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
}
function drawStandard(value,sku,model,order,kind,geometry){
  clearPreview();ctx.fillStyle='#000';
  var left=68,width=676,rows=[];
  if(sku)rows.push(['SKU: '+sku,52]);
  if(model)rows.push(['MODEL: '+model,48]);
  if(order)rows.push(['ORDER: '+order,42]);
  var y=60;
  rows.forEach(function(row){thermalText(row[0],left,y,width,row[1]);y+=66;});
  var titleY=Math.max(92,y+5),barY=titleY+30,barHeight=Math.min(280,490-barY);
  thermalText(kind,left,titleY,width,32);
  if(kind==='UPC'){
    var bits=upcBits(value),module=6;
    for(var i=0;i<bits.length;i++){
      if(bits[i]!=='1')continue;
      var guard=i<3||(i>=45&&i<50)||i>=92;
      ctx.fillRect(left+i*module,barY,module,barHeight+(guard?16:0));
    }
  }else{
    var x=geometry.x;
    for(var j=0;j<geometry.pattern.length;j++){
      var w=Number(geometry.pattern.charAt(j))*geometry.module;
      if(j%2===0)ctx.fillRect(x,barY,w,barHeight);
      x+=w;
    }
  }
  thermalText(value,kind==='UPC'?left:W/2,barY+barHeight+48,width,41,kind==='UPC'?'left':'center');
}
var CODE128_PATTERNS=AddyBuyBarcode.CODE128_PATTERNS;
function barcodeGeometry(words){return AddyBuyBarcode.barcodeGeometry(words,W,MX);}
function dispositionText(value,x,y,maxWidth,size,align){
  if(!value)return;
  ctx.textAlign=align||'left';ctx.textBaseline='middle';
  ctx.font='bold '+size+'px Arial, sans-serif';
  while(ctx.measureText(value).width>maxWidth&&size>17){size--;ctx.font='bold '+size+'px Arial, sans-serif';}
  if(ctx.measureText(value).width>maxWidth){
    while(value.length>1&&ctx.measureText(value+'…').width>maxWidth)value=value.slice(0,-1);
    value+='…';
  }
  ctx.fillText(value,x,y);
}
var compactCode128=AddyBuyBarcode.compactCode128;
function disp128(value,width,label){
  var pattern;
  try{pattern=compactCode128(value).map(function(w){return CODE128_PATTERNS[w];}).join('');}
  catch(e){throw new Error(label+' must contain standard letters, digits or punctuation.');}
  var modules=0;for(var i=0;i<pattern.length;i++)modules+=Number(pattern[i]);
  var module=Math.min(4,Math.floor(width/(modules+20)));
  if(module<2)throw new Error(label+' is too long for a readable barcode in this layout. Use a shorter value or a standard product label with LPN selected.');
  return {pattern:pattern,modules:modules,module:module};
}
function drawDisp128(g,left,width,y,height){
  var x=left+Math.floor((width-g.modules*g.module)/2);
  for(var i=0;i<g.pattern.length;i++){
    var n=Number(g.pattern[i])*g.module;
    if(i%2===0)ctx.fillRect(x,y,n,height);
    x+=n;
  }
}
// Match the photographed warehouse label: condensed, left aligned, staggered bars.
function thermalText(value,x,y,maxWidth,size,align,clip){
  if(!value)return;
  value=String(value);
  ctx.save();
  // Condensed bold lettering with explicit character separation, like the reference.
  var sx=.73, sy=1.06, tracking=(size<=29?.9:.6)/sx;
  ctx.translate(x,y);ctx.scale(sx,sy);
  ctx.textAlign='left';ctx.textBaseline='middle';
  function setFont(){ctx.font='bold '+size+'px Arial, sans-serif';}
  function width(text){
    var chars=Array.from(text),w=0;
    chars.forEach(function(ch,i){w+=ctx.measureText(ch).width+(i?tracking:0);});
    return w;
  }
  setFont();
  if(clip){
    while(value.length>1&&width(value)*sx>maxWidth)value=value.slice(0,-1);
  }else{
    while(width(value)*sx>maxWidth&&size>16){size--;setFont();}
  }
  var total=width(value),pos=align==='right'?-total:align==='center'?-total/2:0;
  // A restrained outline restores the reference weight without closing small counters.
  ctx.strokeStyle='#000';ctx.lineWidth=size<=29?.55:.75;ctx.lineJoin='round';
  Array.from(value).forEach(function(ch){
    if(ch!==' ')ctx.strokeText(ch,pos,0);
    ctx.fillText(ch,pos,0);
    pos+=ctx.measureText(ch).width+tracking;
  });
  ctx.restore();
}
function drawDisposition(value,sku){
  var d={};Object.keys(disp).forEach(function(k){d[k]=k==='OrderBarcode'?disp[k].checked:disp[k].value.trim();});
  if(!d.Type)throw new Error('Choose a disposition.');
  if(!d.Lpn)throw new Error('Enter an LPN.');
  var order=d.Order;
  if(/^(?:N\/?A|NONE|-)$/i.test(order))order='';
  if(d.OrderBarcode&&!order)throw new Error('Enter an order number or turn off the order barcode.');
  if(value==='000000000000')throw new Error('An all-zero UPC is not a product barcode.');
  var left=68, lpnLeft=320, lpnWidth=470;
  var lpnGeometry=disp128(d.Lpn,lpnWidth,'LPN');
  // The reference barcode is about half the label width. Keep integer printer dots and quiet zones.
  var lpnStart=lpnLeft;
  var lpnBarX=lpnStart+10*lpnGeometry.module;
  var orderGeometry=order&&d.OrderBarcode?disp128(order,690,'Order number'):null;
  clearPreview();ctx.fillStyle='#000';
  thermalText(d.Type==='LIQUIDATION'?'LIQ':d.Type,left,30,325,32);
  thermalText(d.Category,420,30,340,30);
  thermalText(d.Channel,523,61,245,29);
  thermalText(d.Brand,left,63,330,33);
  thermalText(d.Model,left,98,680,37);
  thermalText(d.Product,left,143,350,37,'left',true);
  thermalText(sku?'SKU: '+sku:'',left,188,330,38);
  thermalText(d.Dept?'Dept: '+d.Dept:'',400,188,355,36);
  thermalText('UPC',left,224,220,27);
  var bits=upcBits(value),module=3,y=246,h=54;
  for(var i=0;i<bits.length;i++)if(bits[i]==='1')ctx.fillRect(left+i*module,y,module,h);
  thermalText(value,left,319,325,27);
  thermalText('LPN',lpnBarX,340,230,27);
  drawDisp128(lpnGeometry,lpnStart,(lpnGeometry.modules+20)*lpnGeometry.module,360,57);
  thermalText(d.Lpn,lpnBarX,438,Math.max(50,778-lpnBarX),29);
  // The original has no order strip. Print the optional extension only when a real order exists.
  if(orderGeometry){
    thermalText('ORDER',left,464,220,23);
    drawDisp128(orderGeometry,left,690,481,50);
    thermalText(order,413,548,690,25,'center');
  }else if(order){
    thermalText('Order: '+order,left,485,690,30);
  }
  if(d.Date){var p=d.Date.split('-');thermalText(p.length===3?p[1]+'/'+p[2]+'/'+p[0]:d.Date,770,581,350,36,'right');}
}
var solidThermalPixels=AddyBuyThermal.solidThermalPixels;
function sharpenDisposition(){
  var image=ctx.getImageData(0,0,W,H);
  solidThermalPixels(image.data);
  ctx.putImageData(image,0,0);
}
function switchMode(next,force){
  if(next===mode&&!force)return;
  mode=next;document.documentElement.dataset.toolMode=mode;++revision;disableOutput();clearPreview();
  var barcode=mode==='barcode',photo=mode==='photo';
  photoMode.setAttribute('aria-pressed',String(photo));
  barcodeMode.setAttribute('aria-pressed',String(barcode));
  verifyMode.setAttribute('aria-pressed',String(mode==='verify'));
  formatPanel.hidden=!barcode;
  if(mode==='verify'){photoPanel.hidden=true;barcodePanel.hidden=false;syncStandardFields();return;}
  var advanced=barcode&&labelFormat.value==='disposition';
  dispositionFields.hidden=!advanced;
  upcGenerate.textContent='Generate label';
  document.getElementById(advanced?'dispositionManualSlot':'standardManualSlot').appendChild(manualFields);
  document.getElementById('standardManualSlot').hidden=advanced;
  editDetails.hidden=!advanced;
  document.getElementById(advanced?'dispositionModelSlot':'standardModelSlot').appendChild(document.getElementById('sharedModelControl'));
  document.getElementById('sharedModelLabel').textContent=advanced?'Model override':'Model (optional)';
  updateSummary();
  if(advanced)more.open=false;
  photoPanel.hidden=!photo;barcodePanel.hidden=!barcode;syncStandardFields();
  previewMeta.textContent=advanced?'812 × 609 pixels • disposition':barcode?'812 × 609 pixels • '+(standardKind==='LPN'?'Code 128':'UPC-A'):'812 × 609 pixels • no crop';
  canvas.setAttribute('aria-label',barcode?'Product barcode label preview':'Converted black and white label preview');
  upcInput.removeAttribute('aria-invalid');lpnInput.removeAttribute('aria-invalid');
  if(barcode){setStatus(advanced?'Find a product to start.':'Find a product or enter the '+standardKind+' and optional details.');}
  else if(source){rotate.disabled=false;convert();}
  else{input.value='';setStatus('Choose a photo to start.');}
}
photoMode.addEventListener('click',function(){switchMode('photo');});
barcodeMode.addEventListener('click',function(){switchMode('barcode');});
verifyMode.addEventListener('click',function(){switchMode('verify');});
function createVerifiedStandardLabel(e){
  if(mode!=='verify'||!e.detail)return;
  var row=e.detail;
  // The verified catalog row is authoritative. Do not restart the search or
  // inherit an order number, LPN, or disposition from a previous label.
  labelFormat.value='standard';standardKind='UPC';
  includeOrder.checked=false;orderInput.value='';lpnInput.value='';
  brandEdited=false;
  upcSkuInput.value=String(row.sku||'');upcInput.value=String(row.upc||'');
  document.dispatchEvent(new CustomEvent('addy-catalog-match',{detail:row}));
  switchMode('barcode');
  // Use the same validation, drawing, export and print preparation as Generate.
  upcForm.requestSubmit(upcGenerate);
  document.getElementById('previewPanel').scrollIntoView({block:'nearest',behavior:'auto'});
}
document.addEventListener('addy-verify-label',createVerifiedStandardLabel);
labelFormat.addEventListener('change',function(){switchMode('barcode',true);});
function syncStandardFields(){
  var standard=mode==='barcode'&&labelFormat.value==='standard',lpn=standard&&standardKind==='LPN';
  document.getElementById('standardBarcodeType').hidden=!standard;
  document.getElementById('standardOptions').hidden=!standard;
  document.getElementById('sharedUPCFields').hidden=lpn;
  document.getElementById('standardLpnFields').hidden=!lpn;
  document.getElementById('standardOrderFields').hidden=!standard||!includeOrder.checked;
  standardUPC.setAttribute('aria-pressed',String(standardKind==='UPC'));
  standardLPN.setAttribute('aria-pressed',String(standardKind==='LPN'));
  if(standard)previewMeta.textContent='812 × 609 pixels • '+(lpn?'Code 128':'UPC-A');
}
function setStandardKind(kind){if(standardKind===kind)return;standardKind=kind;syncStandardFields();++revision;disableOutput();clearPreview();setStatus('Enter the '+kind+' or scan it.');}
standardUPC.addEventListener('click',function(){setStandardKind('UPC');});
standardLPN.addEventListener('click',function(){setStandardKind('LPN');});
includeOrder.addEventListener('change',function(){syncStandardFields();++revision;disableOutput();clearPreview();setStatus('Tap Generate label when ready.');});
function invalidateDisposition(field){
  if(mode!=='barcode'||(labelFormat.value!=='disposition'&&field!=='Model'))return;
  ++revision;disableOutput();clearPreview();setStatus(labelFormat.value==='disposition'?'Tap Generate disposition label when ready.':'Tap Generate label when ready.');
}
function updateSummary(){
  var card=document.getElementById('productSummary');card.hidden=!selectedProduct||labelFormat.value!=='disposition';
  if(!selectedProduct)return;
  var values={Product:disp.Product.value,Model:disp.Model.value,Sku:upcSkuInput.value,Upc:upcInput.value,Dept:disp.Dept.value,Brand:disp.Brand.value};
  Object.keys(values).forEach(function(k){document.getElementById('summary'+k).textContent=values[k]||'Not available';});
}
editDetails.addEventListener('click',function(){more.open=true;more.querySelector('summary').focus();});
Object.keys(disp).forEach(function(k){
  disp[k].addEventListener('input',function(){if(k==='Brand')brandEdited=true;updateSummary();invalidateDisposition(k);});
  disp[k].addEventListener('change',function(){updateSummary();invalidateDisposition(k);});
});
function clearCatalogFields(){
  Object.keys(catalogFilled).forEach(function(k){if(disp[k].value===catalogFilled[k]&&!(k==='Brand'&&brandEdited))disp[k].value='';});
  catalogFilled={};selectedProduct=null;updateSummary();invalidateDisposition();
}
upcSkuInput.addEventListener('input',clearCatalogFields);
document.addEventListener('addy-catalog-match',function(e){
  clearCatalogFields();var row=e.detail;if(!row)return;selectedProduct=row;
  var mapping={Product:'product',Brand:'brand',Model:'model',Dept:'dept',Category:'category',Channel:'channel'};
  Object.keys(mapping).forEach(function(k){
    if(k==='Brand'&&brandEdited)return;
    var v=row[mapping[k]];
    if(v!=null&&String(v)!==''){disp[k].value=String(v);catalogFilled[k]=disp[k].value;}
    else if(['Product','Model','Dept','Brand'].indexOf(k)>=0)disp[k].value='';
  });
  updateSummary();invalidateDisposition('Model');
});
[upcInput,upcSkuInput].forEach(function(field){
  field.addEventListener('input',function(){
    if(mode!=='barcode')return;
    updateSummary();++revision;disableOutput();clearPreview();upcInput.removeAttribute('aria-invalid');
    setStatus(labelFormat.value==='disposition'?'Tap Generate disposition label when ready.':'Tap Generate label when ready.');
  });
});
function clearBarcodeForm(){
  if(mode!=='barcode')return;
  // Reuse the search input reset path to cancel in-flight lookups and hide suggestions.
  var search=document.getElementById('catalogModel');
  search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
  upcForm.reset();
  search.value='';upcSkuInput.value='';upcInput.value='';
  catalogFilled={};selectedProduct=null;brandEdited=false;
  resetLabelDate();more.open=false;standardKind='UPC';syncStandardFields();updateSummary();
  upcInput.removeAttribute('aria-invalid');lpnInput.removeAttribute('aria-invalid');
  ++revision;disableOutput();clearPreview();
  setStatus('Form cleared.');
  if(!search.disabled)search.focus();
}
document.getElementById('clearBarcodeForm').addEventListener('click',clearBarcodeForm);
[orderInput,lpnInput].forEach(function(field){
  field.addEventListener('input',function(){
    if(mode!=='barcode'||labelFormat.value!=='standard')return;
    ++revision;disableOutput();clearPreview();lpnInput.removeAttribute('aria-invalid');
    setStatus('Tap Generate label when ready.');
  });
});
upcForm.addEventListener('submit',async function(e){
  e.preventDefault();if(mode!=='barcode')return;
  var mine=++revision,value,geometry,advanced=labelFormat.value==='disposition',kind=advanced?'UPC':standardKind;
  disableOutput();clearPreview();upcInput.removeAttribute('aria-invalid');lpnInput.removeAttribute('aria-invalid');
  try{
    if(kind==='LPN'){
      value=lpnInput.value.trim();
      if(!value)throw new Error('Enter or scan an LPN.');
      geometry=barcodeGeometry(compactCode128(value));
    }else{value=normalizeUPC(upcInput.value);upcInput.value=value;}
  }catch(err){
    (kind==='LPN'?lpnInput:upcInput).setAttribute('aria-invalid','true');if(advanced)more.open=true;setStatus(err.message);return;
  }
  try{
    if(advanced){drawDisposition(value,upcSkuInput.value.trim());}
    else{drawStandard(value,upcSkuInput.value.trim(),disp.Model.value.trim(),includeOrder.checked?orderInput.value.trim():'',kind,geometry);}
    sharpenDisposition();
    setStatus('Generating label…');
    var blob=await withPrintDpi(await toPngBlob());
    if(mine!==revision||mode!=='barcode')return;
    var file=new File([blob],(advanced?'Disposition':kind)+'_'+value.replace(/[^a-z0-9_-]/gi,'_')+'_Zebra_4x3.png',{type:'image/png'});
    activateOutput(file,blob);setStatus((advanced?'Label':kind+' '+value)+' ready.');
  }catch(err){if(mine===revision){clearPreview();setStatus(err.message||'Could not export this barcode. Try again.');}}
});
function paintPhoto(ctx,source,degrees,shading){return AddyBuyThermal.paintPhoto(ctx,source,degrees,shading,W,H,MX,MY);}
var crcTable=(function(){var t=[],n,c,k;for(n=0;n<256;n++){c=n;for(k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
function crc32(b){var c=0xffffffff;for(var j=0;j<b.length;j++)c=crcTable[(c^b[j])&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function pngChunk(type,data){
  var b=new Uint8Array(data.length+12),dv=new DataView(b.buffer),i;
  dv.setUint32(0,data.length,false);
  for(i=0;i<4;i++)b[4+i]=type.charCodeAt(i);
  b.set(data,8);dv.setUint32(data.length+8,crc32(b.subarray(4,8+data.length)),false);
  return b;
}
function readArrayBuffer(blob){
  if(blob.arrayBuffer)return blob.arrayBuffer();
  return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(r.result);};r.onerror=reject;r.readAsArrayBuffer(blob);});
}
async function withPrintDpi(blob){
  var buf=new Uint8Array(await readArrayBuffer(blob)),parts=[buf.subarray(0,8)];
  var signature=[137,80,78,71,13,10,26,10];
  for(var q=0;q<8;q++)if(buf[q]!==signature[q])throw new Error('Not a PNG');
  var phy=new Uint8Array(9),meta=new DataView(phy.buffer);
  meta.setUint32(0,7992,false);meta.setUint32(4,7992,false);phy[8]=1;
  var pos=8,inserted=false;
  while(pos+12<=buf.length){
    var len=new DataView(buf.buffer,buf.byteOffset+pos,4).getUint32(0,false);
    if(pos+12+len>buf.length)throw new Error('Incomplete PNG');
    var type=String.fromCharCode(buf[pos+4],buf[pos+5],buf[pos+6],buf[pos+7]);
    if(type==='IDAT'&&!inserted){parts.push(pngChunk('pHYs',phy));inserted=true;}
    if(type!=='pHYs')parts.push(buf.subarray(pos,pos+12+len));
    pos+=12+len;if(type==='IEND')break;
  }
  if(!inserted)throw new Error('Invalid PNG');
  return new Blob(parts,{type:'image/png'});
}
function toPngBlob(target){
  target=target||canvas;
  return new Promise(function(resolve,reject){
    if(target.toBlob){target.toBlob(function(b){if(b)resolve(b);else reject(new Error('PNG export failed'));},'image/png');}
    else{
      try{
        var uri=target.toDataURL('image/png'),base64=atob(uri.split(',')[1]),bytes=new Uint8Array(base64.length);
        for(var i=0;i<base64.length;i++)bytes[i]=base64.charCodeAt(i);
        resolve(new Blob([bytes],{type:'image/png'}));
      }catch(e){reject(e);}
    }
  });
}
async function convert(){
  if(!source||mode!=='photo')return;
  var mine=++revision;
  disableOutput();setStatus('Converting photo…');
  try{
    var shading=quality.value;
    paintPhoto(ctx,source,degrees,shading);
    // Native ZPL requires one-bit dots. Retain the existing normal photo
    // dithering for ZPL export, independent of the grayscale system-print PNG.
    var zplPixels;
    if(shading==='android'){
      var scratch=document.createElement('canvas');scratch.width=W;scratch.height=H;
      var scratchCtx=scratch.getContext('2d',{willReadFrequently:true});
      paintPhoto(scratchCtx,source,degrees,'normal');
      zplPixels=scratchCtx.getImageData(0,0,W,H).data;
    }
    var blob=await withPrintDpi(await toPngBlob());
    if(mine!==revision)return;
    var name=fileName+'_Zebra_4x3.png';
    var file=new File([blob],name,{type:'image/png'});
    activateOutput(file,blob,zplPixels);
  }catch(e){if(mine===revision)setStatus('Could not convert this photo. Please try another image.');}
}
share.addEventListener('click',function(){
  if(!outputFile)return;
  // The file is built BEFORE the tap, allowing iOS to show its native share sheet.
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[outputFile]}))){
    try{
      var result=navigator.share({files:[outputFile]});
      Promise.resolve(result).then(function(){setStatus('Use Save Image or Save to Files in the share sheet.');}).catch(function(err){
        if(err&&err.name==='AbortError')setStatus('Share canceled. Your PNG is still ready.');
        else setStatus('Sharing is unavailable here. Try Open PNG instead.');
      });
      return;
    }catch(e){}
  }
  setStatus('This viewer cannot show the iPhone share sheet. Tap Open PNG, then Share > Save Image.');
});
view.addEventListener('click',function(){setStatus('In the new image view, use Share > Save Image (or long-press the image).');});
download.addEventListener('click',function(){setStatus('If Safari opens the image instead of downloading, use Share > Save Image or Save to Files.');});
})();
