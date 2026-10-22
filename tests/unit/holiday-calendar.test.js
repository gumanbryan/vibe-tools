import test from 'node:test';import assert from 'node:assert/strict';
import {buildBusinessCalendar} from '../../scripts/data/calendar.mjs';
import {addBusinessDays} from '../../src/domain/calendar.js';
test('official supplementary holidays are excluded, trading-day descriptions are not mistaken for closures',()=>{
 const c=buildBusinessCalendar(['2026-10-21','2026-10-22'],'2026-10-22',[{Date:'1151026',Name:'臺灣光復暨金門古寧頭大捷紀念日',Description:'於10月26日（星期一）補假。'},{Date:'1151023',Name:'正常交易',Description:'開始交易'}]);
 assert.equal(addBusinessDays('2026-10-22',2,c).value,'2026-10-27');assert.ok(c.businessDates.includes('2026-10-23'));assert.ok(!c.businessDates.includes('2026-10-26'));
});

import {applyCalendarClosures} from "../../src/market/calendar-closures.js";
test("existing published calendars receive verified closures without replacing price manifests",()=>{const c={businessDates:["2026-10-22","2026-10-23","2026-10-26","2026-10-27"]};assert.equal(addBusinessDays("2026-10-22",2,applyCalendarClosures(c)).value,"2026-10-27");assert.ok(c.businessDates.includes("2026-10-26"));});
