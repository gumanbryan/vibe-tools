import test from 'node:test';import assert from 'node:assert/strict';
import * as freshness from '../../src/market/freshness.js';
test('stock quote freshness tracks each market separately and ignores missing prices',()=>{
 assert.deepEqual(freshness.latestMarketDates([{market:'twse',date:'2026-10-28',close:'100'},{market:'tpex',date:'2026-10-27',close:'10'},{market:'tpex',date:'2026-10-28',close:null}]),{twse:'2026-10-28',tpex:'2026-10-27'});
 assert.match(freshness.marketStatusText({marketAsOf:{twse:'2026-10-28',tpex:'2026-10-27'},warnings:[]}),/部分更新/);
 assert.match(freshness.marketStatusText({marketAsOf:{twse:'2026-10-28',tpex:'2026-10-28'},warnings:[]}),/上市 2026-10-28.*上櫃 2026-10-28/);
});
