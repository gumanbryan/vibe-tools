import {dec,D,sum} from '../domain/money.js';
import {dayBuyCandidates} from './daytrade-ticket.js';
// Resolve declared buy-first cash day trades before BOTH tax and cost allocation.
// Never change the persisted book or use previous-day inventory to fill a gap.
export function resolveCashDayAllocations(book,toDate){
 const trades=book.trades.filter(t=>t.date<=toDate).sort((a,b)=>a.date.localeCompare(b.date)||(a.sequence??0)-(b.sequence??0)||a.id.localeCompare(b.id));
 const allocations=book.allocations.map(a=>({...a}));
 for(const [i,sale] of trades.entries()){
  if(sale.side!=='sell'||sale.creditType!=='cash'||sale.dayType!=='cash-day')continue;
  if(allocations.some(a=>a.closeTradeId===sale.id&&a.kind==='cash-close'))throw Error('當沖與手動平倉配對衝突，請核對同日買進批次');
  const own=allocations.filter(a=>a.kind==='cash-day'&&a.closeTradeId===sale.id);
  let need=dec(sale.qty).minus(sum(own.map(a=>a.qty)));if(need.lte(0))continue;
  const prefix={...book,trades:trades.slice(0,i+1),allocations};
  const candidates=dayBuyCandidates(prefix,{...sale,excludeTradeId:sale.id});
  for(const buy of candidates){
   if((buy.sequence??0)>(sale.sequence??0))continue;
   const used=sum(own.filter(a=>a.openTradeId===buy.id).map(a=>a.qty));
   const q=D.min(need,dec(buy.availableQty).minus(used));if(q.lte(0))continue;
   const existing=own.find(a=>a.openTradeId===buy.id);
   if(existing)existing.qty=dec(existing.qty).plus(q).toString();
   else allocations.push({id:`auto-day:${sale.id}:${buy.id}`,kind:'cash-day',openTradeId:buy.id,closeTradeId:sale.id,qty:q.toString()});
   need=need.minus(q);if(need.isZero())break;
  }
  if(need.gt(0))throw Error(`${sale.code} ${sale.date} 當沖缺少 ${need} 股同日買進，不能以舊持股代替`);
 }
 return allocations;
}
