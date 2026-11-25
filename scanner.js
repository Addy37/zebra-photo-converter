(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
var dialog=$('scanDialog'),video=$('scanVideo'),preview=$('scanPreview'),status=$('scanStatus'),live=$('scanLive'),barcodePhoto=$('scanBarcodePhoto'),modelPhoto=$('scanModelPhoto'),confirm=$('scanConfirm'),readout=$('scanReadout'),use=$('scanUse');
if(!dialog||!video)return;
var target='',session=0,stream=null,controls=null,worker=null,loaded={},pending=false,returnFocus=null,kind='barcode';
function say(s){status.textContent=s;}
function stopVideo(){
  if(controls){try{var stopped=controls.stop();if(stopped&&stopped.catch)stopped.catch(function(){});}catch(e){}controls=null;}
  if(stream){stream.getTracks().forEach(function(t){t.stop();});stream=null;}
  video.pause();video.srcObject=null;preview.hidden=true;
}
function stopWorker(){var w=worker;worker=null;if(w){try{Promise.resolve(w.terminate()).catch(function(){});}catch(e){}}}
function setBusy(value){pending=value;live.disabled=value;barcodePhoto.disabled=value;modelPhoto.disabled=value;use.disabled=value;}
function cancelWork(){++session;stopVideo();stopWorker();setBusy(false);}
function isCurrent(ticket){return dialog.open&&ticket===session;}
function closeScanner(){
  cancelWork();if(dialog.open)dialog.close();
}
dialog.addEventListener('close',function(){if(!dialog.open){cancelWork();if(returnFocus&&document.contains(returnFocus))returnFocus.focus({preventScroll:true});}});
dialog.addEventListener('cancel',function(e){e.preventDefault();closeScanner();});
$('scanClose').addEventListener('click',closeScanner);
window.addEventListener('pagehide',closeScanner);
document.addEventListener('visibilitychange',function(){if(document.hidden&&stream){cancelWork();say('Camera stopped. Tap Start camera scanner to resume.');}});
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
  if(!dialog.showModal){alert('Open this page in an up-to-date Chrome or Safari browser to scan.');return;}
  cancelWork();target=button.dataset.scanTarget;returnFocus=button;kind='barcode';confirm.hidden=true;readout.value='';
  barcodePhoto.value='';modelPhoto.value='';
  $('scanTitle').textContent=target==='product'?'Scan product':button.getAttribute('aria-label');
  $('scanHint').textContent=target==='product'?'Scan the UPC barcode or photograph the model number on the product sticker.':'Aim at the barcode for this field.';
  $('scanModelPhotoLabel').hidden=target!=='product';
  $('scanReadoutLabel').textContent='Detected value';use.textContent='Use scanned value';
  say('');if(!dialog.open)dialog.showModal();
}
document.querySelectorAll('[data-scan-target]').forEach(function(button){button.addEventListener('click',function(){openScanner(button);});});
function showValue(ticket,value,source){
  if(!isCurrent(ticket))return;
  stopVideo();setBusy(false);kind=source;readout.value=String(value||'').trim();
  if(!readout.value){say('Nothing recognized. Try another photo.');return;}
  confirm.hidden=false;$('scanReadoutLabel').textContent='Detected barcode';
  use.textContent='Use scanned value';
  say('Verify the scanned value.');
}
async function liveScan(){
  cancelWork();var ticket=session;confirm.hidden=true;setBusy(true);
  say('Opening camera…');
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('Live camera unavailable. Use Scan barcode from photo.');
    var media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
    if(!isCurrent(ticket)){media.getTracks().forEach(function(t){t.stop();});return;}
    stream=media;preview.hidden=false;video.srcObject=media;await video.play();
    if(!isCurrent(ticket))return;
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
  var reader=new api.BrowserMultiFormatReader();
  var c=await reader.decodeFromStream(stream,video,function(result,error,localControls){
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
  function add(v){v=v.trim();if(v&&/[A-Z]/.test(v)&&/\d/.test(v)&&!out.includes(v))out.push(v);}
  lines.forEach(function(line){
    var m=line.match(/\b(?:MODEL(?:\s*(?:NO\.?|NUMBER|#))?|MOD\.)\s*[:#-]?\s*([A-Z0-9][A-Z0-9./_-]{3,63})/);
    if(m)add(m[1]);
  });
  lines.forEach(function(line){(line.match(/[A-Z0-9][A-Z0-9./_-]{3,63}/g)||[]).forEach(add);});
  return out;
}
async function resizePhoto(file){
  var url=URL.createObjectURL(file),image=new Image();
  try{
    await new Promise(function(resolve,reject){image.onload=resolve;image.onerror=function(){reject(new Error('Could not open this photo. Try JPEG or PNG.'));};image.src=url;});
    var scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));
    var canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    var ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas;
  }finally{URL.revokeObjectURL(url);}
}
var recognizedText='';
async function photoModel(file){
  cancelWork();var ticket=session;confirm.hidden=true;setBusy(true);recognizedText='';say('Loading model reader…');
  var localWorker=null,canvas=null;
  try{
    var api=await tesseract();if(!isCurrent(ticket))return;
    canvas=await resizePhoto(file);if(!isCurrent(ticket))return;
    localWorker=await api.createWorker('eng',1,{logger:function(m){if(isCurrent(ticket)&&m.status==='recognizing text')say('Reading model number… '+Math.round((m.progress||0)*100)+'%');}});
    if(!isCurrent(ticket)){await localWorker.terminate();localWorker=null;return;}
    worker=localWorker;
    var result=await localWorker.recognize(canvas);
    if(!isCurrent(ticket))return;
    recognizedText=String(result.data.text||'');var candidates=modelCandidates(recognizedText);
    if(!candidates.length){say('No model number read. Try a closer photo of the model sticker.');return;}
    // Send the full recognized text to the local catalog. Exact model matches appear for user confirmation.
    kind='ocr';readout.value=candidates[0];confirm.hidden=false;$('scanReadoutLabel').textContent='Possible model (editable)';
    use.textContent='Find matching product';say('Check the model, then find matching products. The catalog will also check other text from the photo.');
  }catch(e){if(isCurrent(ticket))say(e.message||'Could not read model number. Try a clearer photo.');}
  finally{
    if(localWorker&&worker===localWorker){worker=null;try{await localWorker.terminate();}catch(e){}}
    if(canvas){canvas.width=0;canvas.height=0;}
    if(isCurrent(ticket))setBusy(false);
  }
}
barcodePhoto.addEventListener('change',function(){var file=this.files&&this.files[0];this.value='';if(file)photoBarcode(file);});
modelPhoto.addEventListener('change',function(){var file=this.files&&this.files[0];this.value='';if(file)photoModel(file);});
use.addEventListener('click',function(){
  if(pending)return;
  var value=readout.value.trim(),dest=target,source=kind;
  if(!value){say('Enter or scan a value.');return;}
  if(dest==='product'){
    if(source==='barcode'&&!/^[A-Za-z0-9._/ -]{3,120}$/.test(value)){say('This is not a supported product identifier. Scan a UPC or SKU.');return;}
    var payload=source==='ocr'?'MODEL: '+value+'\n'+recognizedText:value;
    closeScanner();document.dispatchEvent(new CustomEvent('addy-product-scan',{detail:{kind:source,value:payload}}));return;
  }
  var field=$(dest);if(!field)return;
  if(dest==='upcInput'&&/^0\d{12}$/.test(value))value=value.slice(1);
  if(dest==='upcInput'&&!/^\d{11,12}$/.test(value)){say('Scan a UPC-A product barcode.');return;}
  if(!/^[\x20-\x7e]+$/.test(value)||value.length>(field.maxLength>0?field.maxLength:120)){say('The scanned value is too long or contains unsupported characters.');return;}
  field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));closeScanner();
});
})();