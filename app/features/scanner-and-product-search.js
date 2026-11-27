
(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
var dialog=$('scanDialog'),video=$('scanVideo'),preview=$('scanPreview'),status=$('scanStatus'),live=$('scanLive'),barcodePhoto=$('scanBarcodePhoto'),modelPhoto=$('scanModelPhoto'),confirm=$('scanConfirm'),readout=$('scanReadout'),use=$('scanUse');
if(!dialog||!video)return;
var target='',session=0,stream=null,controls=null,worker=null,loaded={},pending=false,returnFocus=null,kind='barcode';
function say(s){status.textContent=s;}
var modelLive=$('scanModelLive'),capture=$('scanCapture'),torch=$('scanTorch'),cameraTools=$('scanCameraTools'),modelMode=false,stillMode=false;
var css=document.createElement('style');
css.textContent=`#scanPreview.model-camera #scanGuide{inset:36% 6%}
#scanPreview.still-camera .scan-beam{display:none}
#scanPreview.model-camera{touch-action:manipulation}
.scan-success-toast{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99999;width:min(310px,calc(100vw - 36px));box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:16px;padding:28px 22px 26px;border:1px solid #d6e2f2;border-radius:26px;background:#fff;color:#12325b;box-shadow:0 16px 60px #10274755;pointer-events:none;font:600 17px system-ui,sans-serif;text-align:center}
.scan-success-toast[hidden]{display:none!important}
.scan-toast-mark{position:relative;display:grid;place-items:center;width:76px;height:76px;flex:0 0 76px;border-radius:50%;background:#0046be;color:#fff}
.scan-toast-mark svg{width:44px;height:44px;overflow:visible}
.scan-toast-spark{position:absolute;right:-7px;top:-6px;width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:#ffe000;color:#12325b;font-size:20px;line-height:1}
.scan-toast-copy{min-width:0;display:grid;gap:6px}
.scan-toast-product{display:grid;justify-items:center;gap:6px;width:100%;min-width:0}
.scan-toast-product[hidden],.scan-toast-product img[hidden]{display:none!important}
.scan-toast-product img{display:block;width:128px;height:112px;object-fit:contain;background:#fff;border-radius:10px}
.scan-toast-product .scan-product-name{font:650 15px/1.3 system-ui,sans-serif;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.scan-toast-product .scan-product-meta{font:500 12px/1.35 system-ui,sans-serif;color:#526880;overflow-wrap:anywhere}
.scan-success-toast:has(.scan-toast-product:not([hidden])){gap:10px;padding:18px 20px;max-height:calc(100dvh - 24px);overflow:hidden}
.scan-success-toast:has(.scan-toast-product:not([hidden])) .scan-toast-mark{width:52px;height:52px;flex-basis:52px}
.scan-success-toast:has(.scan-toast-product:not([hidden])) .scan-toast-mark svg{width:32px;height:32px}
@media(max-height:470px){.scan-toast-product img{height:72px;width:100px}.scan-success-toast:has(.scan-toast-product:not([hidden])){gap:5px;padding:10px 16px}.scan-success-toast:has(.scan-toast-product:not([hidden])) .scan-toast-mark{width:38px;height:38px;flex-basis:38px}}
.scan-toast-copy strong{font-size:26px;line-height:1.2;color:#003b9c}
.scan-toast-copy span{font-size:16px;font-weight:500;line-height:1.4;overflow-wrap:anywhere}
.scan-success-toast.toast-pop{animation:scanToastPop .45s cubic-bezier(.22,.75,.3,1) both}
.scan-success-toast.toast-pop .scan-toast-mark svg{animation:scanCheckPop .5s .12s both}
.scan-success-toast.toast-out{animation:scanToastOut .4s ease-in-out both}
@keyframes scanToastPop{from{opacity:0;transform:translate(-50%,-46%) scale(.94)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes scanCheckPop{from{opacity:0;transform:scale(.75)}to{opacity:1;transform:scale(1)}}
@keyframes scanToastOut{from{opacity:1;transform:translate(-50%,-50%) scale(1)}to{opacity:0;transform:translate(-50%,-52%) scale(.98)}}
@media(prefers-reduced-motion:reduce){.scan-success-toast.toast-pop,.scan-success-toast.toast-pop .scan-toast-mark svg,.scan-success-toast.toast-out{animation:none}}`;
document.head.appendChild(css);
var toastTimer,toastExitTimer,toast=null,lastVibration=0,productImageTicket=0;
var pageProduct=$('productVisualPreview'),verifyDialog=$('productVerifyDialog'),verifyProduct=verifyDialog.querySelector('.product-visual'),currentVisualRow=null;
var verifyStart=$('verifyStart'),verifyActions=$('verifyActions');
var pagePhoto=pageProduct.querySelector('.product-visual-photo'),searchPreviewPanel=$('searchPreviewPanel'),searchPreviewWrap=$('searchPreviewWrap'),searchPreviewEmpty=$('searchPreviewEmpty'),searchPreviewSku=$('searchPreviewSku'),searchPreviewHint=$('searchPreviewHint');
var searchDesktopQuery=window.matchMedia('(min-width:851px)');
function syncSearchPreview(){
  var root=document.documentElement;
  var desktop=root.dataset.toolMode==='verify'&&root.dataset.layout==='desktop'&&searchDesktopQuery.matches;
  var host=desktop?searchPreviewWrap:pageProduct;
  if(pagePhoto.parentNode!==host){
    if(desktop)host.appendChild(pagePhoto);else host.insertBefore(pagePhoto,host.firstChild);
  }
  pagePhoto.hidden=!currentVisualRow;
  searchPreviewEmpty.hidden=!!currentVisualRow;
  searchPreviewSku.textContent=currentVisualRow?'SKU '+String(currentVisualRow.sku||''):'No product selected';
  searchPreviewPanel.classList.toggle('is-expanded',desktop&&pageProduct.classList.contains('is-expanded'));
  searchPreviewHint.hidden=!currentVisualRow||pagePhoto.querySelector('.product-visual-zoom').hidden;
}
new MutationObserver(syncSearchPreview).observe(document.documentElement,{attributes:true,attributeFilter:['data-layout','data-tool-mode']});
if(searchDesktopQuery.addEventListener)searchDesktopQuery.addEventListener('change',syncSearchPreview);
else if(searchDesktopQuery.addListener)searchDesktopQuery.addListener(syncSearchPreview);
syncSearchPreview();
function setVisualMatch(row){
  currentVisualRow=row||null;renderProductVisual(pageProduct,currentVisualRow);syncSearchPreview();
  verifyStart.hidden=!!row;verifyActions.hidden=!row;
  document.querySelectorAll('[data-verify-field]').forEach(function(field){var value=row&&row[field.dataset.verifyField];field.textContent=value==null||value===''?'Not available':String(value);});
}
function clearVerifyProduct(){var search=$('catalogModel');search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));setVisualMatch(null);}
function startVerifyScan(clear){if(clear)clearVerifyProduct();var button=document.querySelector('[data-scan-target="product"]');if(button)openScanner(button);}
$('verifyScanProduct').addEventListener('click',function(){startVerifyScan(false);});
$('verifyNextProduct').addEventListener('click',function(){startVerifyScan(true);});
$('verifyClear').addEventListener('click',function(){clearVerifyProduct();$('catalogModel').focus();});
$('verifyCreateLabel').addEventListener('click',function(){if(currentVisualRow)document.dispatchEvent(new CustomEvent('addy-verify-label',{detail:currentVisualRow}));});
function renderProductVisual(panel,row){
  var ticket=(panel._imageTicket||0)+1;panel._imageTicket=ticket;
  var photo=panel===pageProduct?pagePhoto:panel.querySelector('.product-visual-photo');
  var zoom=photo.querySelector('.product-visual-zoom'),old=zoom.querySelector('img'),img=old.cloneNode(false),state=photo.querySelector('.product-visual-state');
  img.removeAttribute('src');old.replaceWith(img);zoom.hidden=true;panel.classList.remove('is-expanded');zoom.setAttribute('aria-label','Enlarge product photo');zoom.setAttribute('aria-expanded','false');
  panel.hidden=!row;state.hidden=false;state.textContent='';
  if(!row)return;
  var sku=String(row.sku||'').trim();
  panel.querySelector('.product-visual-name').textContent=row.product||'Product';
  panel.querySelector('.product-visual-meta').textContent=[sku?'SKU '+sku:'',row.model?'Model '+row.model:'',row.brand||'',row.upc?'UPC '+row.upc:''].filter(Boolean).join(' · ');
  state.textContent='Loading product photo…';
  if(!/^\d{7}$/.test(sku)){state.textContent='Product photo unavailable';return;}
  img.onload=function(){if(panel._imageTicket!==ticket)return;zoom.hidden=false;state.hidden=true;if(panel===pageProduct)syncSearchPreview();};
  img.onerror=function(){if(panel._imageTicket!==ticket)return;zoom.hidden=true;state.hidden=false;state.textContent='Product photo unavailable';if(panel===pageProduct)syncSearchPreview();};
  img.src='https://pisces.bbystatic.com/image2/BestBuy_US/images/products/'+sku.slice(0,4)+'/'+sku+'_sd.jpg;maxHeight=600;maxWidth=600';
}
[pageProduct,verifyProduct].forEach(function(panel){
  var zoom=(panel===pageProduct?pagePhoto:panel).querySelector('.product-visual-zoom');
  zoom.addEventListener('click',function(){var expanded=panel.classList.toggle('is-expanded');zoom.setAttribute('aria-label',expanded?'Reduce product photo':'Enlarge product photo');zoom.setAttribute('aria-expanded',String(expanded));if(panel===pageProduct)syncSearchPreview();});
});
document.addEventListener('addy-catalog-match',function(e){
  setVisualMatch(e.detail||null);
});
[['upcSkuInput','sku'],['upcInput','upc'],['dispModel','model']].forEach(function(pair){
  $(pair[0]).addEventListener('input',function(){if(currentVisualRow&&String(this.value).trim().toUpperCase()!==String(currentVisualRow[pair[1]]||'').trim().toUpperCase()){setVisualMatch(null);}});
});
function showProductVerification(row){
  hideScanToast();renderProductVisual(verifyProduct,row);
  if(!verifyDialog.open)verifyDialog.showModal();
  $('verifyContinue').focus({preventScroll:true});
}
$('verifyContinue').addEventListener('click',function(){verifyDialog.close();});
$('verifyScanAgain').addEventListener('click',function(){verifyDialog.close();var button=document.querySelector('[data-scan-target="product"]');if(button)openScanner(button);});
verifyDialog.addEventListener('close',function(){if(!verifyDialog.open)renderProductVisual(verifyProduct,null);});
function scanVibrate(){var now=Date.now();if(now-lastVibration<650)return;lastVibration=now;if(navigator.vibrate){try{navigator.vibrate(300);}catch(err){}}}
function hideScanToast(){++productImageTicket;clearTimeout(toastTimer);clearTimeout(toastExitTimer);if(toast){toast.hidden=true;toast.classList.remove('toast-pop','toast-out');var product=toast.querySelector('.scan-toast-product');product.hidden=true;product.querySelector('img')?.remove();}}
function fadeScanToast(){if(!toast||toast.hidden)return;toast.classList.remove('toast-pop');toast.classList.add('toast-out');toastExitTimer=setTimeout(hideScanToast,400);}
function populateScanProduct(row){
  var panel=toast.querySelector('.scan-toast-product'),ticket=++productImageTicket;
  panel.hidden=true;panel.querySelector('img')?.remove();
  if(!row)return;
  var sku=String(row.sku||'').trim();
  panel.querySelector('.scan-product-name').textContent=row.product||'Product';
  panel.querySelector('.scan-product-meta').textContent=[sku?'SKU '+sku:'',row.model?'Model '+row.model:'',row.brand||''].filter(Boolean).join(' · ');
  panel.hidden=false;
  if(!/^\d{7}$/.test(sku))return;
  var img=document.createElement('img');
  img.alt='Product photo';img.hidden=true;img.decoding='async';img.referrerPolicy='no-referrer';
  img.onload=function(){if(ticket!==productImageTicket||toast.hidden)return;img.hidden=false;};
  img.onerror=function(){img.remove();};
  panel.prepend(img);
  // Best Buy legacy SKU-based CDN image path; no API credentials or extra catalog download.
  img.src='https://pisces.bbystatic.com/image2/BestBuy_US/images/products/'+sku.slice(0,4)+'/'+sku+'_sd.jpg;maxHeight=240;maxWidth=280';
}
function showScanToast(title,detail,product){
  var parent=dialog.open?dialog:document.body;
  if(!toast){
    toast=document.createElement('div');toast.className='scan-success-toast';toast.hidden=true;
    toast.innerHTML='<span class="scan-toast-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg><span class="scan-toast-spark">✦</span></span><span class="scan-toast-copy"><strong></strong><span></span></span><div class="scan-toast-product" hidden><span class="scan-product-name"></span><span class="scan-product-meta"></span></div>';
  }
  if(toast.parentNode!==parent)parent.appendChild(toast);
  if(dialog.open){toast.setAttribute('aria-hidden','true');toast.removeAttribute('role');}
  else{toast.removeAttribute('aria-hidden');toast.setAttribute('role','status');}
  toast.querySelector('strong').textContent=title;
  toast.querySelector('.scan-toast-copy span').textContent=detail;
  populateScanProduct(product);
  clearTimeout(toastTimer);clearTimeout(toastExitTimer);toast.classList.remove('toast-pop','toast-out');toast.hidden=false;void toast.offsetWidth;toast.classList.add('toast-pop');
  toastTimer=setTimeout(fadeScanToast,2500);
}
function detected(message,title,detail){scanVibrate();say('✓ '+message);showScanToast(title,detail);}
document.addEventListener('addy-scan-success',function(e){
  scanVibrate();
  var matched=e.detail&&e.detail.message==='Scan successful: product matched';
  if(matched&&e.detail.product){if(document.documentElement.dataset.toolMode==='verify'){hideScanToast();return;}showProductVerification(e.detail.product);return;}
  showScanToast(matched?'Product matched!':'All set!',matched?'Product details filled in.':'Scanned value added.');
});
function notifySuccess(){document.dispatchEvent(new CustomEvent('addy-scan-success',{detail:{message:'Scan successful'}}));}
function setCameraMode(model,still){modelMode=model;stillMode=!!still;live.setAttribute('aria-pressed',String(!model));modelLive.setAttribute('aria-pressed',String(model));preview.classList.toggle('model-camera',model);preview.classList.toggle('still-camera',stillMode);preview.querySelector('.scan-aim').textContent=model?'Align model number inside the frame':'Align the barcode inside the frame';capture.textContent='Capture model number';cameraTools.hidden=true;torch.hidden=true;torch.setAttribute('aria-pressed','false');torch.textContent='Flashlight';}
function track(){return stream&&stream.getVideoTracks()[0];}
function caps(t){try{return t&&t.getCapabilities?t.getCapabilities():{};}catch(e){return {};}}
function freshVideo(){var next=video.cloneNode(false);video.replaceWith(next);video=next;}
async function startModelCamera(){
  cancelWork();freshVideo();var ticket=session;confirm.hidden=true;readout.value='';setCameraMode(true,true);setBusy(true);say('Opening model camera…');
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('Live camera unavailable. Upload an existing photo instead.');
    var media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
    if(!isCurrent(ticket)){media.getTracks().forEach(function(t){t.stop();});return;}
    stream=media;preview.hidden=false;video.srcObject=media;await video.play();if(!isCurrent(ticket))return;
    var t=track(),c=caps(t);if(c.focusMode&&c.focusMode.includes('continuous')){try{await t.applyConstraints({advanced:[{focusMode:'continuous'}]});}catch(e){}}
    if(!isCurrent(ticket))return;
    torch.hidden=!c.torch;cameraTools.hidden=false;capture.disabled=false;say('Center the model number in the frame, then tap Capture.');
  }catch(e){if(isCurrent(ticket)){stopVideo();setBusy(false);say(e.name==='NotAllowedError'?'Camera permission denied. Allow access or upload an existing photo.':(e.message||'Could not open camera.'));}}
}
modelLive.addEventListener('click',startModelCamera);
torch.addEventListener('click',async function(){var t=track(),next=torch.getAttribute('aria-pressed')!=='true';if(!t||!caps(t).torch)return;try{await t.applyConstraints({advanced:[{torch:next}]});if(track()===t){torch.setAttribute('aria-pressed',String(next));torch.textContent=next?'Flashlight on':'Flashlight';}}catch(e){say('Flashlight unavailable on this camera.');}});
preview.addEventListener('click',async function(e){if(e.target!==video||!stillMode||!stream)return;var t=track(),c=caps(t);if(!c.focusMode||!c.focusMode.includes('single-shot'))return;try{var rect=video.getBoundingClientRect(),p={x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))};var constraint={focusMode:'single-shot'};if(c.pointsOfInterest)constraint.pointsOfInterest=[p];await t.applyConstraints({advanced:[constraint]});}catch(err){}});
capture.addEventListener('click',function(){
  if(!stillMode||!stream||!video.videoWidth||!video.videoHeight)return;
  var frame=video.getBoundingClientRect(),guide=$('scanGuide').getBoundingClientRect(),vw=video.videoWidth,vh=video.videoHeight;
  var scale=Math.max(frame.width/vw,frame.height/vh),ox=(vw*scale-frame.width)/2,oy=(vh*scale-frame.height)/2;
  var x=Math.max(0,(guide.left-frame.left+ox)/scale),y=Math.max(0,(guide.top-frame.top+oy)/scale);
  var w=Math.min(vw-x,guide.width/scale),h=Math.min(vh-y,guide.height/scale);if(w<1||h<1)return;
  var canvas=document.createElement('canvas');var up=Math.min(2,2400/Math.max(w,h));canvas.width=Math.max(1,Math.round(w*up));canvas.height=Math.max(1,Math.round(h*up));
  canvas.getContext('2d').drawImage(video,x,y,w,h,0,0,canvas.width,canvas.height);
  capture.disabled=true;photoModel(canvas);
});
function stopVideo(){
  if(controls){try{var stopped=controls.stop();if(stopped&&stopped.catch)stopped.catch(function(){});}catch(e){}controls=null;}
  if(stream){stream.getTracks().forEach(function(t){t.stop();});stream=null;}
  video.pause();video.srcObject=null;preview.hidden=true;cameraTools.hidden=true;
}
function stopWorker(){var w=worker;worker=null;if(w){try{Promise.resolve(w.terminate()).catch(function(){});}catch(e){}}}
function setBusy(value){pending=value;live.disabled=value&&!modelMode;modelLive.disabled=value&&modelMode;barcodePhoto.disabled=value;modelPhoto.disabled=value;use.disabled=value;}
function cancelWork(){++session;if(toast&&toast.parentNode===dialog)hideScanToast();stopVideo();stopWorker();setBusy(false);}
function isCurrent(ticket){return dialog.open&&ticket===session;}
function closeScanner(){
  cancelWork();if(dialog.open)dialog.close();
}
dialog.addEventListener('close',function(){if(!dialog.open){cancelWork();if(returnFocus&&document.contains(returnFocus))returnFocus.focus({preventScroll:true});}});
dialog.addEventListener('cancel',function(e){e.preventDefault();closeScanner();});
$('scanClose').addEventListener('click',closeScanner);
window.addEventListener('pagehide',closeScanner);
document.addEventListener('visibilitychange',function(){if(document.hidden&&stream){cancelWork();say(modelMode?'Camera stopped. Tap Scan model number to resume.':'Camera stopped. Tap Scan barcode to resume.');}});
function loadScript(name,url,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);
  if(loaded[name])return loaded[name];
  loaded[name]=new Promise(function(resolve,reject){
    var script=document.createElement('script');script.src=url;script.async=true;
    script.onload=function(){if(window[globalName])resolve(window[globalName]);else reject(new Error('Scanner library unavailable.'));};
    script.onerror=function(){script.remove();reject(new Error('Could not load scanner. Check your internet connection.'));};
    document.head.appendChild(script);
  }).catch(function(e){delete loaded[name];throw e;});
  return loaded[name];
}
function zxing(){return loadScript('zxing','https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/index.min.js','ZXingBrowser');}
function tesseract(){return loadScript('tesseract','https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js','Tesseract');}
function openScanner(button){
  hideScanToast();
  if(!dialog.showModal){alert('Open this page in an up-to-date Chrome or Safari browser to scan.');return;}
  cancelWork();target=button.dataset.scanTarget;returnFocus=button;kind='barcode';confirm.hidden=true;readout.value='';
  barcodePhoto.value='';modelPhoto.value='';$('scanUploadOptions').open=false;
  $('scanTitle').textContent=target==='product'?'Scan product':button.getAttribute('aria-label');
  $('scanHint').textContent=target==='product'?'Aim at the barcode, or switch to the model number camera.':'Aim at the barcode for this field.';
  $('scanModelPhotoLabel').hidden=target!=='product';modelLive.hidden=target!=='product';setCameraMode(false);
  $('scanReadoutLabel').textContent='Detected value';use.textContent='Use scanned value';
  if(!dialog.open)dialog.showModal();
  liveScan();
}
document.querySelectorAll('[data-scan-target]').forEach(function(button){button.addEventListener('click',function(){openScanner(button);});});
function showValue(ticket,value,source){
  if(!isCurrent(ticket))return;
  stopVideo();setBusy(false);kind=source;readout.value=String(value||'').trim();
  if(!readout.value){say('Nothing recognized. Try another photo.');return;}
  confirm.hidden=false;$('scanReadoutLabel').textContent='Detected barcode';
  use.textContent='Use scanned value';
  detected('Barcode scanned successfully. Verify the value.','Nice scan!','Barcode captured.');
}
async function liveScan(){
  cancelWork();freshVideo();var ticket=session;confirm.hidden=true;readout.value='';setCameraMode(false);setBusy(true);
  say('Opening camera…');
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('Live camera unavailable. Upload an existing barcode image instead.');
    var media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
    if(!isCurrent(ticket)){media.getTracks().forEach(function(t){t.stop();});return;}
    stream=media;preview.hidden=false;video.srcObject=media;await video.play();
    if(!isCurrent(ticket))return;
    say('Get the barcode inside the guide…');
    // Let the viewfinder settle before accepting an automatic scan.
    await new Promise(function(resolve){setTimeout(resolve,1100);});
    if(!isCurrent(ticket)||!stream)return;
    say('Hold the barcode inside the guide.');
    // Native detector when available; fall back to ZXing on unsupported browsers.
    var formats=['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','qr_code','data_matrix'];
    var native=null;
    if(window.BarcodeDetector){
      try{var supported=await BarcodeDetector.getSupportedFormats();var selected=formats.filter(function(f){return supported.includes(f);});if(selected.includes('code_128')&&selected.includes('ean_13'))native=new BarcodeDetector({formats:selected});}catch(e){}
    }
    if(!isCurrent(ticket))return;
    if(native){
      var tick=async function(){
        if(!isCurrent(ticket)||!stream)return;
        try{var hits=await native.detect(video);if(!isCurrent(ticket)||!stream)return;if(hits.length){showValue(ticket,hits[0].rawValue,'barcode');return;}}
        catch(e){if(isCurrent(ticket)){try{await startZXing(ticket);}catch(err){if(isCurrent(ticket)){stopVideo();setBusy(false);say(err.message||'Camera scan failed. Try a photo.');}}}return;}
        setTimeout(tick,160);
      };tick();
    }else await startZXing(ticket);
  }catch(e){if(isCurrent(ticket)){stopVideo();setBusy(false);say(e.name==='NotAllowedError'?'Camera permission denied. Allow camera access or use a photo.':(e.message||'Could not open camera. Try a photo.'));}}
}
async function startZXing(ticket){
  var api=await zxing();if(!isCurrent(ticket)||!stream)return;
  var reader=new api.BrowserMultiFormatReader(),activeStream=stream,activeVideo=video;
  var c=await reader.decodeFromStream(activeStream,activeVideo,function(result,error,localControls){
    if(result&&isCurrent(ticket)&&stream){
      if(localControls){try{localControls.stop();}catch(e){}}
      showValue(ticket,result.getText(),'barcode');
    }
  });
  if(!isCurrent(ticket)||!stream){try{c.stop();}catch(e){}}else controls=c;
}
live.addEventListener('click',liveScan);
async function photoBarcode(file){
  cancelWork();var ticket=session;confirm.hidden=true;setBusy(true);say('Reading barcode…');
  var url=URL.createObjectURL(file);
  try{
    var api=await zxing();if(!isCurrent(ticket))return;
    var reader=new api.BrowserMultiFormatReader(),result=await reader.decodeFromImageUrl(url);
    showValue(ticket,result.getText(),'barcode');
  }catch(e){if(isCurrent(ticket)){setBusy(false);say('No readable barcode found. Try a closer, well-lit photo.');}}
  finally{URL.revokeObjectURL(url);}
}
function modelCandidates(text){
  var lines=String(text||'').toUpperCase().split(/\r?\n/),out=[];
  function add(v,explicit){
    v=v.trim();var k=v.replace(/[^A-Z0-9]/g,'');
    if(k.length>=4&&k.length<=64&&(/\d/.test(k)&&(/[A-Z]/.test(k)||explicit))&&!out.includes(v))out.push(v);
  }
  lines.forEach(function(line,i){
    var m=line.match(/\b(?:MODEL(?:\s*(?:NO\.?|NUMBER|#))?|MOD\.)\s*[:#-]?\s*(.*)$/);
    if(m){var tail=m[1].trim()||(lines[i+1]||'').trim();var parts=tail.match(/[A-Z0-9][A-Z0-9./_-]*/g)||[];
      if(parts.length){add(parts[0],true);if(parts.length>1)add(parts.slice(0,2).join(''),true);}
    }
  });
  lines.forEach(function(line){(line.match(/[A-Z0-9][A-Z0-9./_-]{3,63}/g)||[]).forEach(function(v){add(v,false);});});
  return out;
}
async function resizePhoto(file){
  var url=URL.createObjectURL(file),image=new Image();
  try{
    await new Promise(function(resolve,reject){image.onload=resolve;image.onerror=function(){reject(new Error('Could not open this photo. Try JPEG or PNG.'));};image.src=url;});
    var scale=Math.min(1.5,2400/Math.max(image.naturalWidth,image.naturalHeight));
    var canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    var ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas;
  }finally{URL.revokeObjectURL(url);}
}
function contrastPhoto(source){
  var copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;
  var ctx=copy.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
  var img=ctx.getImageData(0,0,copy.width,copy.height),data=img.data,hist=new Uint32Array(256),n=data.length/4;
  for(var i=0;i<data.length;i+=4){var v=Math.round(.299*data[i]+.587*data[i+1]+.114*data[i+2]);hist[v]++;data[i]=data[i+1]=data[i+2]=v;}
  var low=0,high=255,sum=0;
  while(low<254&&sum+hist[low]<n*.015){sum+=hist[low++];}
  sum=0;while(high>1&&sum+hist[high]<n*.015){sum+=hist[high--];}
  var span=Math.max(35,high-low);
  for(var j=0;j<data.length;j+=4){var g=Math.max(0,Math.min(255,Math.round((data[j]-low)*255/span)));data[j]=data[j+1]=data[j+2]=g;}
  ctx.putImageData(img,0,0);return copy;
}
var recognizedText='';
async function photoModel(file){
  cancelWork();var ticket=session;confirm.hidden=true;setBusy(true);recognizedText='';say('Loading model reader…');
  var localWorker=null,canvas=null,enhanced=null,pass=1;
  try{
    var api=await tesseract();if(!isCurrent(ticket))return;
    canvas=file instanceof HTMLCanvasElement?file:await resizePhoto(file);if(!isCurrent(ticket)){canvas.width=0;canvas.height=0;return;}
    localWorker=await api.createWorker('eng',1,{logger:function(m){if(isCurrent(ticket)&&m.status==='recognizing text')say('Reading label ('+pass+'/2)… '+Math.round((m.progress||0)*100)+'%');}});
    if(!isCurrent(ticket)){await localWorker.terminate();localWorker=null;return;}
    worker=localWorker;
    await localWorker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
    var first=await localWorker.recognize(canvas);
    if(!isCurrent(ticket))return;
    recognizedText=String(first.data.text||'');
    // A second pass uses a contrast-normalized copy and a different text layout mode.
    pass=2;say('Checking a sharper copy…');enhanced=contrastPhoto(canvas);
    try{
      await localWorker.setParameters({tessedit_pageseg_mode:'6'});
      var second=await localWorker.recognize(enhanced);
      if(!isCurrent(ticket))return;
      recognizedText+='\n'+String(second.data.text||'');
    }catch(e){if(!isCurrent(ticket))return;}
    var candidates=modelCandidates(recognizedText);
    kind='ocr';readout.value=candidates[0]||'';confirm.hidden=false;$('scanReadoutLabel').textContent='Possible model (editable)';
    use.textContent='Find matching product';
    if(candidates.length)detected('Model text detected. Check or edit it before searching.','Got it!','Model text captured. Please verify.');else say('No clear model detected. Enter any visible part of the model or try another photo.');
  }catch(e){if(isCurrent(ticket))say(e.message||'Could not read model number. Try a clearer photo.');}
  finally{
    if(localWorker&&worker===localWorker){worker=null;try{await localWorker.terminate();}catch(e){}}
    if(canvas){canvas.width=0;canvas.height=0;}if(enhanced){enhanced.width=0;enhanced.height=0;}
    if(isCurrent(ticket))setBusy(false);
  }
}
barcodePhoto.addEventListener('change',function(){var file=this.files&&this.files[0];this.value='';if(file)photoBarcode(file);});
modelPhoto.addEventListener('change',function(){var file=this.files&&this.files[0];this.value='';if(file)photoModel(file);});
use.addEventListener('click',function(){
  if(pending)return;
  var value=readout.value.trim(),dest=target,source=kind;
  if(!value&&!(dest==='product'&&source==='ocr'&&recognizedText.trim())){say('Enter or scan a value.');return;}
  if(dest==='product'){
    if(source==='barcode'&&!/^[A-Za-z0-9._/ -]{3,120}$/.test(value)){say('This is not a supported product identifier. Scan a UPC or SKU.');return;}
    var payload=source==='ocr'?'MODEL: '+value+'\n'+recognizedText:value;
    closeScanner();document.dispatchEvent(new CustomEvent('addy-product-scan',{detail:{kind:source,value:payload,preferred:source==='ocr'?value:''}}));return;
  }
  var field=$(dest);if(!field)return;
  if(dest==='upcInput'&&/^0\d{12}$/.test(value))value=value.slice(1);
  if(dest==='upcInput'&&!/^\d{11,12}$/.test(value)){say('Scan a UPC-A product barcode.');return;}
  if(!/^[\x20-\x7e]+$/.test(value)||value.length>(field.maxLength>0?field.maxLength:120)){say('The scanned value is too long or contains unsupported characters.');return;}
  field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));closeScanner();notifySuccess();
});
})();
