import {dec,sum} from '../domain/money.js';
import {financedPrincipal} from '../credit/financing.js';
import {closePart} from './realized.js';
// A campaign belongs to an account and strategy position, not the whole ticker.
export function strategyCampaigns(book,snapshot){
 const details=new Map((snapshot.tradeDetails??[]).map(t=>[t.id,t]));
 const selected=id=>snapshot.accountId==='combined'||snapshot.accountId===id;
 const buys=[...book.openingPositions.filter(p=>p.strategyId==='disposition').map(p=>({...p,opening:true,date:p.acquiredDate??p.date??book.openingDate,sequence:-1})),...book.trades.filter(t=>t.strategyId==='disposition'&&t.side==='buy'&&t.creditType!=='short')].filter(t=>selected(t.accountId)&&t.date<=snapshot.date);
 const events=buys.map(t=>({type:'buy',date:t.date,sequence:t.sequence??0,trade:t}));
 for(const t of snapshot.tradeDetails??[]){const parts=(t.realizedParts??[]).filter(p=>p.strategyId==='disposition'&&p.profit!=null);if(parts.length&&selected(t.accountId))events.push({type:'sell',date:t.date,sequence:t.sequence??0,trade:t,parts});}
 events.sort((a,b)=>a.date.localeCompare(b.date)||a.sequence-b.sequence||a.type.localeCompare(b.type)||a.trade.id.localeCompare(b.trade.id));
 const active=new Map(),byLot=new Map(),all=[];
 for(const e of events){
  const t=e.trade,key=JSON.stringify([t.accountId,t.code]);
  if(e.type==='buy'){
   let cycle=active.get(key);
   if(!cycle){cycle={id:'campaign:'+t.id,accountId:t.accountId,code:t.code,startDate:t.date,endDate:null,bought:dec(0),remaining:dec(0),capitalRaw:dec(0),profitRaw:dec(0),entries:[],exits:[]};active.set(key,cycle);all.push(cycle);}
   const d=details.get(t.id)??t;
   const principal=t.creditType==='margin'?(t.principal??d.financedPrincipal??financedPrincipal(dec(t.qty).mul(t.price).toString(),t.ruleSnapshot?.marginRatio??'0.6',t.actualPrincipal)):'0';
   const p=closePart({...t,...d,initialQty:t.qty,principal,direction:'long',ruleSnapshot:t.ruleSnapshot??book.accounts.find(a=>a.id===t.accountId)?.profile},{price:t.price},t.qty);
   cycle.bought=cycle.bought.plus(t.qty);cycle.remaining=cycle.remaining.plus(t.qty);cycle.capitalRaw=cycle.capitalRaw.plus(p.investedCapital);cycle.entries.push({...p,date:t.date});byLot.set(t.id,cycle);
  }else for(const p of e.parts){
   const cycle=byLot.get(p.lotId);if(!cycle)throw Error('策略賣出找不到買進批次');
   cycle.remaining=cycle.remaining.minus(p.qty);if(cycle.remaining.lt(0))throw Error('策略賣出超過買進股數');
   cycle.profitRaw=cycle.profitRaw.plus(p.profit);cycle.exits.push({...p,date:t.date,tradeId:t.id});
   if(cycle.remaining.isZero()){cycle.endDate=t.date;active.delete(JSON.stringify([cycle.accountId,cycle.code]));}
  }
 }
 const cycles=all.map(c=>({id:c.id,accountId:c.accountId,code:c.code,startDate:c.startDate,endDate:c.endDate,boughtQty:c.bought.toString(),remainingQty:c.remaining.toString(),capital:c.capitalRaw.toString(),profit:c.profitRaw.toString(),return:c.endDate&&c.capitalRaw.gt(0)?c.profitRaw.div(c.capitalRaw).toString():null,days:c.endDate?Math.round((Date.parse(c.endDate)-Date.parse(c.startDate))/86400000)+1:null,entries:c.entries,exits:c.exits}));
 const completed=cycles.filter(c=>c.endDate),open=cycles.filter(c=>!c.endDate),valid=completed.filter(c=>c.return!=null);
 return {cycles,completed,open,profit:sum(cycles.map(c=>c.profit)).toString(),meanReturn:valid.length?sum(valid.map(c=>c.return)).div(valid.length).toString():null,winRate:completed.length?dec(completed.filter(c=>dec(c.profit).gt(0)).length).div(completed.length).toString():null};
}
