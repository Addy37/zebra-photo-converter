// Shared thermal algorithms. No DOM initialization or storage side effects.
const AddyBuyThermal = (function () {
'use strict';
function rasterGraphic(pixels,width,height){
  var stride=Math.ceil(width/8),total=stride*height,hex=new Array(total),digits='0123456789ABCDEF';
  for(var y=0;y<height;y++){
    for(var b=0;b<stride;b++){
      var packed=0;
      for(var bit=0;bit<8;bit++){
        var x=b*8+bit;
        if(x>=width)continue;
        var at=(y*width+x)*4;
        if(pixels[at+3]>127&&(pixels[at]+pixels[at+1]+pixels[at+2])/3<128)packed|=128>>bit;
      }
      hex[y*stride+b]=digits[packed>>4]+digits[packed&15];
    }
  }
  return '^FO0,0^GFA,'+total+','+total+','+stride+','+hex.join('')+'^FS';
}

// Generated disposition labels are line art, not photographs. Convert antialiased
// text to solid printer dots without applying photo dithering or changing bar widths.
function solidThermalPixels(pixels){
  for(var i=0;i<pixels.length;i+=4){
    var gray=(pixels[i]+pixels[i+1]+pixels[i+2])/3;
    var bw=pixels[i+3]>127&&gray<150?0:255;
    pixels[i]=pixels[i+1]=pixels[i+2]=bw;pixels[i+3]=255;
  }
  return pixels;
}

function paintPhoto(ctx,source,degrees,shading,W,H,MX,MY){
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  var sw=source.naturalWidth||source.width,sh=source.naturalHeight||source.height;
  if(!sw||!sh)throw new Error('Invalid photo dimensions');
  var rotated=degrees%180!==0,boxW=rotated?sh:sw,boxH=rotated?sw:sh;
  var scale=Math.min((W-2*MX)/boxW,(H-2*MY)/boxH);
  var x=Math.floor((W-boxW*scale)/2),y=Math.floor((H-boxH*scale)/2);
  var x1=Math.min(W,Math.ceil((W+boxW*scale)/2)),y1=Math.min(H,Math.ceil((H+boxH*scale)/2));
  ctx.save();ctx.translate(W/2,H/2);ctx.rotate(degrees*Math.PI/180);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale);ctx.restore();
  var pixels=ctx.getImageData(0,0,W,H),p=pixels.data,levels=new Float32Array(W*H),mode=shading;
  // Default photo output preserves grayscale; the system print service handles halftoning.
  if(mode==='normal'){
    for(var n=0;n<p.length;n+=4){
      var luminance=Math.round(0.299*p[n]+0.587*p[n+1]+0.114*p[n+2]);
      p[n]=p[n+1]=p[n+2]=luminance;p[n+3]=255;
    }
    ctx.putImageData(pixels,0,0);
    return;
  }
  var light=mode==='light'?19:mode==='dark'?-17:mode==='bold'?-4:0;
  var contrast=mode==='bold'?1.43:1.14;
  var yy,xx,i,at,gray,old,bw,err;
  for(yy=Math.max(0,y);yy<y1;yy++)for(xx=Math.max(0,x);xx<x1;xx++){
    at=(yy*W+xx)*4;
    gray=0.299*p[at]+0.587*p[at+1]+0.114*p[at+2];
    levels[yy*W+xx]=Math.max(0,Math.min(255,(gray-127.5)*contrast+127.5+light));
  }
  // Floyd-Steinberg dithering for the Zebra's black-and-white printhead.
  for(yy=Math.max(0,y);yy<y1;yy++)for(xx=Math.max(0,x);xx<x1;xx++){
    i=yy*W+xx;old=levels[i];bw=old<128?0:255;err=old-bw;at=i*4;
    p[at]=p[at+1]=p[at+2]=bw;p[at+3]=255;
    if(xx+1<x1)levels[i+1]+=err*7/16;
    if(yy+1<y1){
      if(xx>Math.max(0,x))levels[i+W-1]+=err*3/16;
      levels[i+W]+=err*5/16;
      if(xx+1<x1)levels[i+W+1]+=err/16;
    }
  }
  ctx.putImageData(pixels,0,0);
}
return { rasterGraphic, solidThermalPixels, paintPhoto };
})();
