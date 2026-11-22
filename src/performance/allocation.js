import {dec,sum} from '../domain/money.js';
// Display reclassification only. Never post entries or change the book.
export function allocationSummary(s){
 const byCode=new Map(),b=s.balances??{};
 for(const p of s.positions??[]){const g=byCode.get(p.code)??{code:p.code,longValue:dec(0),shortValue:dec(0)};const k=p.direction==='short'?'shortValue':'longValue';g[k]=g[k].plus(dec(p.marketValue).abs());byCode.set(p.code,g);}
 const stocks=[...byCode.values()].map(g=>({...g,longValue:g.longValue.toString(),shortValue:g.shortValue.toString(),value:g.longValue.plus(g.shortValue).toString()})).sort((a,b)=>dec(b.value).cmp(a.value)||a.code.localeCompare(b.code));
 const exposure=sum(stocks.map(g=>g.value));for(const g of stocks)g.weight=exposure.gt(0)?dec(g.value).div(exposure).toString():null;
 const details=new Map((s.tradeDetails??[]).map(t=>[t.id,t]));const seen=new Set();let pendingDebt=dec(0);
 for(const e of s.entries??[]){if(e.creditType!=='margin'||!e.tradeId||!e.dueDate||e.dueDate<=s.date||seen.has(e.tradeId))continue;seen.add(e.tradeId);const t=details.get(e.tradeId);if(t?.side==='buy')pendingDebt=pendingDebt.plus(t.financedPrincipal??0);else if(t?.side==='sell')pendingDebt=pendingDebt.minus(t.principalRepaid??0);}
 const cash=sum([b.cash??0,b.receivable??0,b.payable??0,pendingDebt]),debt=dec(b.marginDebt??0).neg().plus(pendingDebt);
 const valid=s.equity!=null&&dec(s.equity).gt(0),ratio=n=>valid?dec(n).div(s.equity).toString():null;
 return {stocks,exposure:exposure.toString(),cash:cash.toString(),debt:debt.toString(),leverage:ratio(exposure),cashRatio:ratio(cash),debtRatio:ratio(debt)};
}
