import {isoDate} from './data-core.mjs';
export function buildBusinessCalendar(observedDates,end,holidayRows){
 const holidayDates=[...new Set((holidayRows??[])
  .filter(r=>/放假|休市|停止交易|補假/.test(String(r.Description??r['說明']??'')))
  .map(r=>isoDate(r.Date??r['日期'])).filter(Boolean))].sort();
 const closed=new Set(holidayDates),future=[];
 const endDate=new Date(end+'T00:00:00Z');endDate.setUTCDate(endDate.getUTCDate()+20);
 for(let d=new Date(end+'T00:00:00Z');d<=endDate;d.setUTCDate(d.getUTCDate()+1)){
  const date=d.toISOString().slice(0,10);
  if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&!closed.has(date))future.push(date);
 }
 return {businessDates:[...new Set([...observedDates,...future])].filter(d=>!closed.has(d)).sort(),holidayDates,sourceVersion:'official-history-and-holiday-schedule',futureStatus:holidayRows?'holiday-filtered-estimate':'unverified-weekdays'};
}
