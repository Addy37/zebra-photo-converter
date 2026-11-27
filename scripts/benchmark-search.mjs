import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
const catalog = new Function(readFileSync('app/runtime/catalog.js','utf8')+'\nreturn AddyBuyCatalog;')();
const count=361872;
const rows=Array.from({length:count},(_,i)=>({row:{sku:String(6000000+i),upc:i%1000===0?'036000291452':'123456789012'},model:'MODEL'+i,product:'SAMPLE PRODUCT '+i}));
function previous(entry,raw,key,numeric){
  const sku=entry.row.sku,model=entry.model,upc=numeric?catalog.catalogUPC(raw):'';
  if(upc&&entry.row.upc===upc)return 0;
  if(numeric&&sku===raw)return 1;
  if(key&&model===key)return 2;
  if(numeric&&sku.startsWith(raw))return 3;
  if(key&&model.startsWith(key))return 4;
  if(entry.product.includes(raw))return 5;
  if((numeric&&sku.includes(raw))||(key&&model.includes(key)))return 6;
  return -1;
}
function scan(ranker){
  const counts=Array(8).fill(0);
  for(const row of rows)counts[ranker(row)+1]++;
  return counts;
}
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
for(const raw of ['036000291452','6549413','654','MODEL123','SAMPLE PRODUCT']){
  const key=catalog.modelKey(raw),numeric=/^\d+$/.test(raw);
  const old=entry=>previous(entry,raw,key,numeric),next=catalog.createProductRanker(raw,key,numeric);
  const baseline=scan(old);
  assert.deepEqual(scan(next),baseline);
  const a=[],b=[];
  for(let i=0;i<7;i++){
    for(const [f,results] of i%2===0?[[old,a],[next,b]]:[[next,b],[old,a]]){
      const start=performance.now();assert.deepEqual(scan(f),baseline);results.push(performance.now()-start);
    }
  }
  console.log(JSON.stringify({query:raw,rows:count,previous_ms:+median(a).toFixed(2),optimized_ms:+median(b).toFixed(2),same_results:true}));
}
console.log('Synthetic in-memory CPU benchmark; excludes IndexedDB, UI, device startup and network.');
