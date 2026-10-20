import test from "node:test";
import assert from "node:assert/strict";
import {
  periodThemeReturn,
  chainThemeIndex,
  themeActivity,
} from "../../src/sectors/sectors.js";
const dates = [
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-07",
  "2026-09-08",
];
const m = {
  calendar: { businessDates: dates },
  bars: dates.flatMap((date, i) => [
    {
      code: "A",
      date,
      close: String(100 + i * 2),
      quality: "valid",
      turnoverTwd: "100",
    },
    {
      code: "B",
      date,
      close: String(100 - i * 0.4),
      quality: "valid",
      turnoverTwd: "100",
    },
  ]),
  caps: [
    { code: "A", date: dates[0], marketCap: "75" },
    { code: "B", date: dates[0], marketCap: "25" },
  ],
  securities: [
    { code: "A", productType: "stock" },
    { code: "B", productType: "stock" },
  ],
};
const theme = {
  id: "x",
  members: [
    { code: "A", from: dates[0] },
    { code: "B", from: dates[0] },
  ],
};
test("period average is average of constituent cumulative returns", () => {
  assert.equal(
    periodThemeReturn(theme, m, dates[5], 5, "equal").value.return,
    "0.04",
  );
  assert.equal(
    periodThemeReturn(theme, m, dates[5], 5, "cap").value.return,
    "0.07",
  );
  assert.equal(
    periodThemeReturn(theme, { ...m, caps: [] }, dates[5], 5, "cap").ok,
    false,
  );
  assert.equal(periodThemeReturn(theme, m, dates[0], 1, "equal").ok, false);
});
test("membership changes do not rewrite old constituents and curves label chain method", () => {
  const t = {
    ...theme,
    members: [...theme.members, { code: "C", from: "2026-09-09" }],
  };
  assert.equal(
    periodThemeReturn(t, m, dates[5], 5, "equal").value.coverage.total,
    2,
  );
  assert.equal(
    chainThemeIndex(theme, m, dates[0], dates[5], "equal").value[0].value,
    "100",
  );
});
test('equal-weight returns do not read an optional capitalization dataset',()=>{
 const market={calendar:{businessDates:['2026-09-01','2026-09-02']},bars:[{code:'x',date:'2026-09-01',close:'100'},{code:'x',date:'2026-09-02',close:'110'}],get caps(){throw Error('capitalization is not loaded');}};
 assert.equal(periodThemeReturn({members:[{code:'x'}]},market,'2026-09-02',1,'equal').value.return,'0.1');
});
test('turnover multiple excludes today from its 20 day baseline and reports comparable samples',()=>{
 const ds=Array.from({length:21},(_,i)=>`2026-09-${String(i+1).padStart(2,'0')}`);
 const market={calendar:{businessDates:[...ds].reverse()},securities:[{code:'A',productType:'stock'},{code:'B',productType:'stock'}],bars:ds.flatMap((date,i)=>[{code:'A',date,turnoverTwd:i===20?'200':'100'},...(i===0?[]:[{code:'B',date,turnoverTwd:'999'}])])};
 const r=themeActivity(theme,market,ds[20]).value;assert.equal(r.volumeRatio,'2');assert.equal(r.volumeMembers,1);assert.equal(r.totalMembers,2);
 assert.equal(themeActivity(theme,market,ds[19]).value.volumeRatio,null);
});
