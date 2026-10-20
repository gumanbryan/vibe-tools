import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const seed=JSON.parse(readFileSync('public/data/themes.seed.json'));
const manifest=JSON.parse(readFileSync('public/data/manifest.json'));
const sec=JSON.parse(readFileSync('public/'+manifest.meta.securities.path));
test('all fifteen researched themes have unique listed constituents and source attribution',()=>{
 assert.equal(seed.length,15);
 const codes=new Set(sec.map(s=>s.code));
 for(const t of seed) {
  assert.ok(t.members.length>=3,t.name);
  assert.equal(new Set(t.members.map(m=>m.code)).size,t.members.length);
  for(const m of t.members){assert.ok(codes.has(m.code),m.code);assert.ok(m.source.startsWith('https://'));assert.ok(m.role);assert.equal(m.observedAt,'2026-10-19');}
 }
 assert.ok(seed.find(t=>t.id==='ccl').members.some(m=>m.code==='1303'));
 assert.ok(!seed.filter(t=>['ccl','copper','glass'].includes(t.id)).some(t=>t.members.some(m=>m.code==='1326')));
});
