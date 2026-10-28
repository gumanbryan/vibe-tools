export function latestMarketDates(bars=[]){
 const dates={twse:null,tpex:null};
 for(const bar of bars){
  if(!(bar.market in dates)||bar.close==null||!Number.isFinite(Number(bar.close))||Number(bar.close)<=0)continue;
  if(!dates[bar.market]||bar.date>dates[bar.market])dates[bar.market]=bar.date;
 }
 return dates;
}
export function marketStatusText(market){
 if(!market)return '行情尚未載入';
 const dates=market.marketAsOf??latestMarketDates(market.bars);
 const partial=!dates.twse||!dates.tpex||dates.twse!==dates.tpex||(market.warnings??[]).length>0;
 return `上市 ${dates.twse??'尚無行情'} · 上櫃 ${dates.tpex??'尚無行情'}${partial?' · 部分更新':''}`;
}
