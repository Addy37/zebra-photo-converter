// Shared barcode algorithms. No DOM initialization or storage side effects.
const AddyBuyBarcode = (function () {
'use strict';
function upcCheck(body: string): string{
  var sum=0;
  for(var i=0;i<11;i++)sum+=Number(body.charAt(i))*(i%2===0?3:1);
  return String((10-sum%10)%10);
}
function normalizeUPC(raw: string): string{
  var value=raw.trim();
  if(!/^[0-9]{11,12}$/.test(value))throw new Error('Enter 11 or 12 UPC digits (including any leading zeros).');
  var check=upcCheck(value.slice(0,11));
  if(value.length===12&&value.charAt(11)!==check)throw new Error('Invalid UPC check digit. Check the number; the expected last digit is '+check+'.');
  return value.slice(0,11)+check;
}
function upcBits(value: string): string{
  var left=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  var bits='101',i,j,p;
  for(i=0;i<6;i++)bits+=left[Number(value.charAt(i))];
  bits+='01010';
  for(i=6;i<12;i++){
    p=left[Number(value.charAt(i))];
    for(j=0;j<7;j++)bits+=p.charAt(j)==='0'?'1':'0';
  }
  return bits+'101';
}

// Code 128 symbol widths, including start, checksum and stop patterns.
var CODE128_PATTERNS=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
function barcodeGeometry(words: number[], W: number, MX: number){
  var pattern=words.map(function(w){return CODE128_PATTERNS[w];}).join('');
  var modules=0;
  for(var i=0;i<pattern.length;i++)modules+=Number(pattern.charAt(i));
  var module=Math.min(5,Math.floor((W-2*MX)/(modules+20)));
  if(module<2)throw new Error('LPN is too long to print with readable bars on this label.');
  return {pattern:pattern,module:module,x:Math.floor((W-modules*module)/2),modules:modules};
}

// Choose Code 128 B/C runs to keep mixed letter/numeric LPNs compact.
function compactCode128(value: string): number[]{
  if(!/^[\x20-\x7e]+$/.test(value))throw new Error('Invalid Code 128 data.');
  var memo: Record<string, number[]>={};
  function pair(i: number){return /^\d{2}$/.test(value.slice(i,i+2));}
  function best(i: number,mode: 'B' | 'C'): number[]{
    if(i===value.length)return [];
    var k=i+':'+mode;if(memo[k])return memo[k];
    var options: number[][]=[];
    if(mode==='B'){
      options.push([value.charCodeAt(i)-32].concat(best(i+1,'B')));
      if(pair(i))options.push([99,Number(value.slice(i,i+2))].concat(best(i+2,'C')));
    }else{
      if(pair(i))options.push([Number(value.slice(i,i+2))].concat(best(i+2,'C')));
      options.push([100,value.charCodeAt(i)-32].concat(best(i+1,'B')));
    }
    options.sort(function(a,b){return a.length-b.length;});
    return memo[k]=options[0];
  }
  var words=[104].concat(best(0,'B'));
  if(pair(0)){
    var c=[105].concat(best(0,'C'));
    if(c.length<words.length)words=c;
  }
  var checksum=words[0];
  for(var i=1;i<words.length;i++)checksum+=i*words[i];
  words.push(checksum%103,106);return words;
}
return { normalizeUPC, upcBits, barcodeGeometry, compactCode128, CODE128_PATTERNS };
})();
