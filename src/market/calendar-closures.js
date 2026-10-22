// Verified from https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule on 2026-10-22.
// Retained so existing published calendars also honor the official supplementary holidays.
const verifiedClosures=["2026-01-01","2026-02-15","2026-02-16","2026-02-17","2026-02-18","2026-02-19","2026-02-20","2026-02-27","2026-02-28","2026-04-03","2026-04-04","2026-04-05","2026-04-06","2026-05-01","2026-06-19","2026-09-25","2026-09-28","2026-10-09","2026-10-10","2026-10-25","2026-10-26","2026-12-25"];
export function applyCalendarClosures(calendar){
 const closed=new Set([...verifiedClosures,...(calendar.holidayDates??[])]);
 return {...calendar,holidayDates:[...closed].sort(),businessDates:calendar.businessDates.filter(date=>!closed.has(date))};
}
