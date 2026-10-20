import test from 'node:test';import assert from 'node:assert/strict';
import {industryName,groupIndustries} from '../../src/sectors/industries.js';
test('official codes display readable names and unknown codes remain explicit',()=>{
 assert.equal(industryName('24'),'半導體業');assert.equal(industryName('28'),'電子零組件業');
 assert.equal(industryName('01'),'水泥工業');assert.match(industryName('99'),/待核對/);
});
test('industry constituent detail keeps every stock including those lacking prices',()=>{
 const s=[{code:'2330',name:'台積電',market:'twse',productType:'stock',industry:'24'},{code:'6488',name:'環球晶',market:'tpex',productType:'stock',industry:'24'},{code:'x',productType:'etf',industry:'24'}];
 const g=groupIndustries(s);assert.equal(g.length,1);assert.equal(g[0].name,'半導體業');
 assert.deepEqual(g[0].members.map(m=>m.code),['2330','6488']);
});
test('published metadata includes OTC official industry code rather than omitting OTC constituents',async()=>{
 const {readFileSync}=await import('node:fs');const m=JSON.parse(readFileSync('public/data/manifest.json'));const s=JSON.parse(readFileSync('public/'+m.meta.securities.path));
 const otc=s.filter(s=>s.market==='tpex'&&s.productType==='stock');assert.ok(otc.length>800);assert.ok(otc.filter(s=>s.industry).length/otc.length>.99);
 const missing=otc.filter(s=>!s.industry);
 for(const stock of missing)assert.ok(groupIndustries(s).find(g=>g.name.includes('待核對')).members.some(m=>m.code===stock.code));
 assert.ok(groupIndustries(s).find(g=>g.code==='24').members.some(m=>m.market==='tpex'));
});
