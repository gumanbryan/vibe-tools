import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeThemeCatalog } from '../../src/sectors/catalog.js';
const old = JSON.parse(readFileSync(new URL('../fixtures/themes-v1.json',import.meta.url)));
const seed = [{id:'pcb',name:'PCB',seedManaged:true,version:'2026-10-19',members:[{code:'2313'},{code:'2368'}]},{id:'new',name:'新題材',members:[{code:'2330'}]}];
test('upgrades pristine built-in themes in existing books without touching custom classifications',()=>{
 const custom = {...structuredClone(old[1]),version:'2',members:[{code:'6213',from:'2026-09-01',source:'custom'}]};
 const result=mergeThemeCatalog([old[0],custom],seed,old);
 assert.equal(result.find(x=>x.id==='pcb').members.length,2);
 assert.deepEqual(result.find(x=>x.id==='ccl'),custom);
 assert.equal(result.find(x=>x.id==='new').members.length,1);
 assert.equal(old[0].members.length,1);
});
test('user-edited built-ins opt out from future catalog replacement',()=>{
 const custom={...seed[0],seedManaged:false,members:[{code:'6669'}]};
 assert.deepEqual(mergeThemeCatalog([custom],seed,old)[0],custom);
});
