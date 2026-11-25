(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
var dialog=$('scanDialog'),video=$('scanVideo'),preview=$('scanPreview'),status=$('scanStatus'),live=$('scanLive'),barcodePhoto=$('scanBarcodePhoto'),modelPhoto=$('scanModelPhoto'),confirm=$('scanConfirm'),readout=$('scanReadout'),use=$('scanUse');
if(!dialog||!video)return;
var target='',session=0,stream=null,controls=null,worker=null,loaded={},pending=false,returnFocus=null,kind='barcode';
function say(s){status.textContent=s;}
var modelLive=document.createElement('button'),capture=document.createElement('button'),torch=document.createElement('button'),cameraTools=document.createElement('div'),modelMode=false;
modelLive.type=capture.type=torch.type='button';modelLive.className='secondary';modelLive.textContent='Open model number camera';
capture.textContent='Capture model number';torch.textContent='Flashlight';torch.className='secondary';
cameraTools.style.cssText='display:flex;gap:8px;margin-top:8px;';cameraTools.hidden=true;
capture.style.flex='1';cameraTools.append(capture,torch);preview.after(cameraTools);
$('scanModelPhotoLabel').before(modelLive);
$('scanModelPhotoLabel').firstChild.textContent='Use model number photo instead';
var css=document.createElement('style');css.textContent='#scanPreview.model-camera #scanGuide{inset:36% 6%;}#scanPreview.model-camera .scan-beam{display:none}#scanPreview.model-camera{touch-action:manipulation}.scan-success-toast{position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:99999;max-width:calc(100% - 24px);width:max-content;padding:12px 18px;border-radius:12px;background:#17663d;color:white;font:600 15px system-ui;box-shadow:0 6px 24px #0004;text-align:center}';document.head.appendChild(css);
var toastTimer,toast=null;
document.addEventListener('addy-scan-success',function(e){
  if(navigator.vibrate){try{navigator.vibrate(80);}catch(err){}}
  if(!toast){toast=document.createElement('div');toast.className='scan-success-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.appendChild(toast);}
  toast.textContent='✓ '+((e.detail&&e.detail.message)||'Scan successful');toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){toast.hidden=true;},2200);
});
function notifySuccess(){document.dispatchEvent(new CustomEvent('addy-scan-success',{detail:{message:'Scan successful'}}));}
function setCameraMode(model){modelMode=model;preview.classList.toggle('model-camera',model);preview.querySelector('.scan-aim').textContent=model?'Align model number inside the frame':'Align the barcode inside the frame';cameraTools.hidden=true;torch.hidden=true;torch.setAttribute('aria-pressed','false');torch.textContent='Flashlight';}
function track(){return stream&&stream.getVideoTracks()[0];}
function caps(t){try{return t&&t.getCapabilities?t.getCapabilities():{};}catch(e){return {};}}
async function startModelCamera(){
  cancelWork();var ticket=session;confirm.hidden=true;setCameraMode(true);setBusy(true);say('Opening model camera…');
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('Live camera unavailable. Use a model number photo instead.');
    var media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
    if(!isCurrent(ticket)){media.getTracks().forEach(function(t){t.stop();});return;}
    stream=media;preview.hidden=false;video.srcObject=media;await video.play();if(!isCurrent(ticket))return;
    var t=track(),c=caps(t);if(c.focusMode&&c.focusMode.includes('continuous')){try{await t.applyConstraints({advanced:[{focusMode:'continuous'}]});}catch(e){}}
    if(!isCurrent(ticket))return;
    torch.hidden=!c.torch;cameraTools.hidden=false;capture.disabled=false;say('Center the model number in the frame, then tap Capture.');
  }catch(e){if(isCurrent(ticket)){stopVideo();setBusy(false);say(e.name==='NotAllowedError'?'Camera permission denied. Allow access or use a model number photo.':(e.message||'Could not open model camera.'));}}
}
modelLive.addEventListener('click',startModelCamera);
torch.addEventListener('click',async function(){var t=track(),next=torch.getAttribute('aria-pressed')!=='true';if(!t||!caps(t).torch)return;try{await t.applyConstraints({advanced:[{torch:next}]});if(track()===t){torch.setAttribute('aria-pressed',String(next));torch.textContent=next?'Flashlight on':'Flashlight';}}catch(e){say('Flashlight unavailable on this camera.');}});
video.addEventListener('click',async function(e){if(!modelMode||!stream)return;var t=track(),c=caps(t);if(!c.focusMode||!c.focusMode.includes('single-shot'))return;try{var rect=video.getBoundingClientRect(),p={x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))};var constraint={focusMode:'single-shot'};if(c.pointsOfInterest)constraint.pointsOfInterest=[p];await t.applyConstraints({advanced:[constraint]});}catch(err){}});
capture.addEventListener('click',function(){
  if(!modelMode||!stream||!video.videoWidth||!video.videoHeight)return;
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
function setBusy(value){pending=value;live.disabled=value;barcodePhoto.disabled=value;modelPhoto.disabled=value;use.disabled=value;modelLive.disabled=value;}
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
  $('scanModelPhotoLabel').hidden=target!=='product';modelLive.hidden=target!=='product';setCameraMode(false);
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
  say('Barcode detected. Verify the scanned value.');
}
async function liveScan(){
  cancelWork();var ticket=session;confirm.hidden=true;setCameraMode(false);setBusy(true);
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
    say(candidates.length?'Check the detected model or edit it. ADDY BUY will look for exact and close catalog matches.':'No clear model detected. Enter any visible part of the model or try another photo.');
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