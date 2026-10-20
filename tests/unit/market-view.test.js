import test from 'node:test';import assert from 'node:assert/strict';
import {sortSectorMetrics,chartBars} from '../../src/ui/market-data.js';
test('market chart uses only finite dated prices through chosen valuation date',()=>{
 const rows=[{date:'2026-09-02',close:'102'},{date:'2026-09-01',close:'100'},{date:'2026-09-03',close:null},{date:'2026-09-04',close:'NaN'},{date:'2026-09-05',close:'110'}];assert.deepEqual(chartBars({bars:rows},'2026-09-02').map(x=>x.date),['2026-09-01','2026-09-02']);
});
test('both sector tables sort by activity or return while missing data stays last',()=>{
 const rows=[{name:'a',activity:{volumeRatio:null},returns:{5:null}},{name:'b',activity:{volumeRatio:'2'},returns:{5:'0.1'}},{name:'c',activity:{volumeRatio:'1'},returns:{5:'0.2'}}];
 assert.deepEqual(sortSectorMetrics(rows,'volume-desc').map(x=>x.name),['b','c','a']);assert.deepEqual(sortSectorMetrics(rows,'volume-asc').map(x=>x.name),['c','b','a']);assert.deepEqual(sortSectorMetrics(rows,'return5-desc').map(x=>x.name),['c','b','a']);assert.equal(rows[0].name,'a');
});
import {boundedChartRange} from '../../src/ui/market-data.js';
test('zoomed chart pans within its data without allowing empty past or future ranges',()=>{
 assert.deepEqual(boundedChartRange({from:-5,to:5},32),{from:-0.5,to:9.5});
 assert.deepEqual(boundedChartRange({from:25,to:35},32),{from:21.5,to:31.5});
 assert.deepEqual(boundedChartRange({from:-20,to:50},32),{from:-0.5,to:31.5});
 assert.deepEqual(boundedChartRange({from:5,to:15},32),{from:5,to:15});
});
