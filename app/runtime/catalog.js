// Shared catalog algorithms. No DOM initialization or storage side effects.
const AddyBuyCatalog = (function () {
'use strict';
function skuKey(s){var value=String(s).trim();return /^[0-9]{1,12}$/.test(value)?value.replace(/^0+(?=\d)/,''):'';}
function validUPC(s){
  if(!/^[0-9]{12}$/.test(s)||s==='000000000000')return false;
  var n=0;for(var i=0;i<12;i++)n+=Number(s[i])*(i%2===0?3:1);
  return n%10===0;
}

function csvParser(){
  var row=[],field='',quoted=false,closed=false,skipLF=false;
  return function(chunk,final){
    var out=[];
    function endField(){row.push(field);field='';closed=false;}
    function endRow(){endField();if(row.length>1||row[0]!=='')out.push(row);row=[];}
    for(var i=0;i<chunk.length;i++){
      var c=chunk[i];
      if(skipLF){skipLF=false;if(c==='\n')continue;}
      if(quoted){if(c==='"'){quoted=false;closed=true;}else field+=c;continue;}
      if(closed){
        if(c==='"'){field+='"';quoted=true;closed=false;continue;}
        if(c!==','&&c!=='\r'&&c!=='\n')throw new Error('Invalid character after quoted CSV field.');
      }
      if(c===','){endField();}
      else if(c==='\r'||c==='\n'){endRow();skipLF=c==='\r';}
      else if(c==='"'){if(field!=='')throw new Error('Unexpected quote in CSV field.');quoted=true;}
      else{field+=c;}
      if(field.length>65536||row.length>100)throw new Error('Unexpected CSV field size.');
    }
    if(final){
      if(quoted)throw new Error('CSV ended inside a quoted field.');
      if(field!==''||row.length||closed)endRow();
    }
    return out;
  };
}
function getColumns(header){
  var cols=header.map(function(v){return v.replace(/^\uFEFF/,'').trim().toLowerCase();});
  var indexes=['sku','product','upc'].map(function(n){return cols.indexOf(n);});
  if(indexes.some(function(i){return i<0;}))throw new Error('CSV must include SKU, Product and UPC headers.');
  return indexes.concat(['brand','model','dept'].map(function(n){return cols.indexOf(n);}));
}
function rowRecord(row,cols){
  if(row.length<=Math.max.apply(null,cols))throw new Error('Malformed CSV row.');
  var key=skuKey(row[cols[0]]),code=row[cols[2]].trim();
  if(!key||!validUPC(code))return null;
  var record={sku:key,product:row[cols[1]].trim(),upc:code};
  ['brand','model','dept'].forEach(function(k,i){var col=cols[i+3];if(col>=0&&row[col])record[k]=row[col].trim();});
  return record;
}

function modelKey(value){return String(value||'').toUpperCase().trim().replace(/[^A-Z0-9]/g,'');}

function catalogUPC(value){
  var v=String(value||'').trim();
  if(/^0\d{12}$/.test(v))v=v.slice(1);
  return /^\d{12}$/.test(v)&&validUPC(v)?v:'';
}
function rankProduct(entry,raw,key,numeric){
  return createProductRanker(raw,key,numeric)(entry);
}
function createProductRanker(raw,key,numeric){
  var upc=numeric?catalogUPC(raw):'';
  return function(entry){
    var sku=entry.row.sku,model=entry.model;
    if(upc&&entry.row.upc===upc)return 0;
    if(numeric&&sku===raw)return 1;
    if(key&&model===key)return 2;
    if(numeric&&sku.startsWith(raw))return 3;
    if(key&&model.startsWith(key))return 4;
    if(entry.product.includes(raw))return 5;
    if((numeric&&sku.includes(raw))||(key&&model.includes(key)))return 6;
    return -1;
  };
}
function ocrModelKeys(text){
  var lines=String(text||'').toUpperCase().split(/\r?\n/),keys=new Set();
  function add(value,explicit){var k=modelKey(value);if(k.length>=4&&k.length<=64&&/\d/.test(k)&&(/[A-Z]/.test(k)||explicit))keys.add(k);}
  lines.forEach(function(line,i){
    var match=line.match(/\b(?:MODEL(?:\s*(?:NO\.?|NUMBER|#))?|MOD(?:EL)?\.)\s*[:#-]?\s*(.*)$/);
    if(match){var tail=match[1].trim()||(lines[i+1]||'').trim();var parts=tail.match(/[A-Z0-9][A-Z0-9./_-]*/g)||[];
      for(var j=1;j<=Math.min(parts.length,3);j++)add(parts.slice(0,j).join(''),true);}
    (line.match(/[A-Z0-9][A-Z0-9./_-]{3,63}/g)||[]).forEach(function(token){add(token,false);});
  });
  return keys;
}
function ocrFold(value){
  return value.replace(/[OQ0]/g,'0').replace(/[IL1]/g,'1').replace(/[S5]/g,'5').replace(/[Z2]/g,'2').replace(/[B8]/g,'8').replace(/[G6]/g,'6');
}
function oneEdit(a,b){
  if(Math.abs(a.length-b.length)>1)return false;
  if(a.length===b.length){
    var first=-1,second=-1;
    for(var i=0;i<a.length;i++)if(a[i]!==b[i]){if(first<0)first=i;else if(second<0)second=i;else return false;}
    return second<0||(second===first+1&&a[first]===b[second]&&a[second]===b[first]);
  }
  if(a.length>b.length){var swap=a;a=b;b=swap;}
  var p=0,q=0,miss=0;
  while(p<a.length&&q<b.length){if(a[p]===b[q]){p++;q++;}else{if(++miss>1)return false;q++;}}
  return true;
}
function ocrRanker(text,preferred){
  var keys=ocrModelKeys(text),primary=modelKey(preferred);
  if(primary.length>=4&&primary.length<=64)keys.add(primary);
  var list=Array.from(keys),approx=list.filter(function(k){return k.length>=6&&/[A-Z]/.test(k)&&/\d/.test(k);});
  approx.sort(function(a,b){return (b===primary?1:0)-(a===primary?1:0)||b.length-a.length;});
  var candidates=approx.slice(0,16).map(function(k){return {key:k,fold:ocrFold(k)};});
  return function(model){
    if(!model)return -1;
    if(model===primary&&primary.length>=4)return 0;
    if(keys.has(model))return 1;
    if(model.length<6)return -1;
    var fold=null,best=7;
    for(var i=0;i<candidates.length;i++){
      var a=candidates[i],k=a.key,delta=Math.abs(model.length-k.length);
      if(delta<=1){
        if(fold===null)fold=ocrFold(model);
        if(delta===0&&fold===a.fold){best=Math.min(best,2);continue;}
        if(k.length>=7&&oneEdit(k,model))best=Math.min(best,4);
      }
      if(delta<=6&&(model.startsWith(k)||(model.length>=7&&k.startsWith(model))))best=Math.min(best,3);
    }
    return best===7?-1:best;
  };
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
return { skuKey, validUPC, csvParser, getColumns, rowRecord, modelKey, catalogUPC, rankProduct, createProductRanker, ocrModelKeys, ocrRanker, modelCandidates };
})();
