export function chartBars(index,to='9999-12-31'){
 return [...new Map((index?.bars??[]).filter(b=>b.date<=to&&b.close!=null&&Number.isFinite(Number(b.close))&&Number(b.close)>0).map(b=>[b.date,b])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function sortSectorMetrics(rows,sort='volume-desc'){
 const [key,order]=sort.split('-'),direction=order==='asc'?1:-1;
 const value=r=>key==='volume'?r.activity?.volumeRatio:r.returns?.[key.replace('return','')];
 return [...rows].sort((a,b)=>{if(key==='name')return a.name.localeCompare(b.name,'zh-TW');const x=value(a),y=value(b);if(x==null&&y==null)return a.name.localeCompare(b.name,'zh-TW');if(x==null)return 1;if(y==null)return -1;return (Number(x)-Number(y))*direction||a.name.localeCompare(b.name,'zh-TW');});
}
export function boundedChartRange(range,count){
 if(!range||count<1)return null;
 const span=Math.min(Math.max(range.to-range.from,1),count);
 const from=Math.max(-0.5,Math.min(range.from,count-0.5-span));
 return {from,to:from+span};
}

// Chart dates come from observed sessions; accounting snapshots remain daily.
export function performanceSnapshots(snapshots, market) {
 const benchmarkBars=(market.indices??[]).flatMap(index=>chartBars(index,market.asOf));
 const observations=benchmarkBars.length?benchmarkBars:chartBars({bars:market.bars??[]},market.asOf);
 const observed=new Set(observations.map(bar=>bar.date));
 const holidays=new Set(market.calendar?.holidayDates??[]);
 return snapshots.filter(snapshot=>{
  const day=new Date(snapshot.date+'T00:00:00Z').getUTCDay();
  return day!==0&&day!==6&&!holidays.has(snapshot.date)&&observed.has(snapshot.date);
 });
}
