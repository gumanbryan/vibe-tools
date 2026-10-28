import test from 'node:test';import assert from 'node:assert/strict';
import {buildBusinessCalendar} from '../../scripts/data/calendar.mjs';
import {addBusinessDays} from '../../src/domain/calendar.js';
import {applyCalendarClosures} from '../../src/market/calendar-closures.js';
test('announced holidays are excluded without misreading normal trading descriptions',()=>{
 const c=buildBusinessCalendar(['2026-09-23','2026-09-24'],'2026-09-24',[{Date:'1150925',Description:'放假'},{Date:'1150928',Description:'放假'},{Date:'1150929',Description:'開始交易'}]);
 assert.equal(addBusinessDays('2026-09-24',2,c).value,'2026-09-30');assert.ok(c.businessDates.includes('2026-09-29'));
});
test('typhoon closure and supplementary holiday postpone both settlement dates',()=>{
 const source={businessDates:['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29']};
 const c=applyCalendarClosures(source);
 assert.equal(addBusinessDays('2026-10-19',2,c).value,'2026-10-21');
 assert.equal(addBusinessDays('2026-10-21',2,c).value,'2026-10-27');
 assert.equal(addBusinessDays('2026-10-22',2,c).value,'2026-10-28');
 assert.ok(c.holidayDates.includes('2026-10-23'));assert.ok(!c.businessDates.includes('2026-10-23'));assert.ok(source.businessDates.includes('2026-10-23'));
});
test('weekday gaps are never invented as confirmed business days',()=>{
 const c=applyCalendarClosures({businessDates:['2026-10-19','2026-10-21','2026-10-22','2026-10-27','2026-10-28']});
 assert.ok(!c.businessDates.includes('2026-10-20'));assert.ok(!c.businessDates.includes('2026-10-23'));
});
test('public refresh preserves emergency closures even when the annual holiday API omits them',()=>{
 const c=buildBusinessCalendar(['2026-10-19','2026-10-20','2026-10-21','2026-10-22'],'2026-10-22',[{Date:'1151026',Description:'補假'}]);
 assert.equal(addBusinessDays('2026-10-21',2,c).value,'2026-10-27');assert.equal(addBusinessDays('2026-10-22',2,c).value,'2026-10-28');
});
