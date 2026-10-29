import {dec,D} from '../domain/money.js';
import {validateDayTrade} from './allocations.js';
const kinds=['cash-day','cash-first','credit-day'];
const unwrap=r=>{if(!r.ok)throw Error(r.errors.map(e=>e.message).join('；'));return r.value;};
export function dayBuyCandidates(book,{accountId,date,code,excludeTradeId}){
 const lots=(book.openingPositions??[]).filter(p=>p.accountId===accountId&&p.code===code&&p.creditType==='cash').map(p=>({id:p.id,remaining:dec(p.qty)}));
 const trades=book.trades.filter(t=>t.id!==excludeTradeId&&t.accountId===accountId&&t.code===code&&t.creditType==='cash'&&t.date<=date).sort((a,b)=>a.date.localeCompare(b.date)||(a.sequence??0)-(b.sequence??0)||a.id.localeCompare(b.id));
 for(const t of trades){
  if(t.side==='buy'){lots.push({...t,remaining:dec(t.qty)});continue;}
  if(t.dayType==='cash-first')continue;
  const manual=book.allocations.filter(a=>a.closeTradeId===t.id&&!['cash-first','credit-day'].includes(a.kind));
  let need=dec(t.qty);
  const targets=manual.length?manual.map(a=>({lot:lots.find(l=>l.id===a.openTradeId),limit:dec(a.qty)})):lots.map(lot=>({lot,limit:lot.remaining}));
  for(const {lot,limit} of targets){if(!lot)continue;const q=D.min(need,lot.remaining,limit);if(q.lte(0))continue;lot.remaining=lot.remaining.minus(q);need=need.minus(q);if(need.isZero())break;}
 }
 return lots.filter(t=>t.date===date&&t.side==='buy'&&t.marketType!=='odd'&&t.remaining.gt(0)).map(({remaining,...t})=>({...t,availableQty:remaining.toString()}));
}
// Replacing the transaction must not erase its matching links during fee edits.
export function reviseTrade(book,trade,{replaceDay=false}={}){
 const draft=structuredClone(book),i=draft.trades.findIndex(t=>t.id===trade.id);
 if(i<0)throw Error('找不到要修訂的交易');
 draft.trades[i]=structuredClone(trade);
 if(replaceDay)draft.allocations=draft.allocations.filter(a=>!(kinds.includes(a.kind)&&(a.openTradeId===trade.id||a.closeTradeId===trade.id)));
 unwrap(validateDayTrade(draft.trades,draft.allocations.filter(a=>kinds.includes(a.kind))));
 return draft;
}
export function matchDaySale(book,sale,selection='auto'){
 if(sale.side!=='sell'||sale.creditType!=='cash'||sale.marketType==='odd')throw Error('快速當沖僅支援先買後賣的整股現股交易');
 const candidates=dayBuyCandidates(book,{...sale,excludeTradeId:sale.id}).filter(b=>selection==='auto'||b.id===selection);
 let need=dec(sale.qty);const allocations=[];
 for(const b of candidates){
  if((b.sequence??0)>(sale.sequence??0))continue;
  const q=D.min(need,b.availableQty);if(q.lte(0))continue;
  allocations.push({id:`${sale.id}:day:${b.id}`,openTradeId:b.id,closeTradeId:sale.id,kind:'cash-day',qty:q.toString()});need=need.minus(q);if(need.isZero())break;
 }
 if(!need.isZero())throw Error('同日同股票可用買進股數不足；請增加買進紀錄或調整配對');
 return allocations;
}
export function buildDayTicket(book,input,security,batchId){
 const draft=structuredClone(book),account=draft.accounts.find(a=>a.id===input.accountId);
 if(!account)throw Error('找不到帳戶');
 if(!security||!input.code||input.date<book.openingDate)throw Error('請核對股票與交易日期');
 const base=Math.max(Date.now(),...draft.trades.map(t=>Number(t.sequence??0)))+1;
 let index=0;
 const make=(row,side,i)=>{
  const qty=dec(row.qty),price=dec(row.price);
  if(!qty.isFinite()||!price.isFinite()||qty.lte(0)||!qty.isInteger()||price.lte(0))throw Error('股數須為正整數、價格須大於零');
  const order=String(row.order??i+1).trim();if(!order)throw Error('請填委託單號分組');
  return {id:`${batchId}:${side}:${i}`,accountId:account.id,date:input.date,code:input.code,side,creditType:'cash',marketType:'regular',dayType:'cash-day',qty:qty.toString(),price:price.toString(),sequence:base+index++,productType:security.productType,bondTaxExempt:security.bondTaxExempt,ruleSnapshot:structuredClone(account.profile),feeGroupId:`${batchId}:${side}:${order}`,taxGroupId:`${batchId}:${side}:${order}:${price.toString()}`,actualGrossFee:row.actualGrossFee};
 };
 for(const [i,row] of (input.buys??[]).entries())draft.trades.push(make(row,'buy',i));
 for(const [i,row] of (input.sells??[]).entries()){
  const sale=make(row,'sell',i);draft.trades.push(sale);draft.allocations.push(...matchDaySale(draft,sale,row.buyTradeId||'auto'));
 }
 if(!index)throw Error('請至少輸入一筆買進或賣出');
 unwrap(validateDayTrade(draft.trades,draft.allocations.filter(a=>kinds.includes(a.kind))));return draft;
}
