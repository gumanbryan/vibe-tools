import {dec,sum} from '../domain/money.js';
export function settlementSchedule(entries){
 const groups=new Map(),seen=new Set();
 for(const e of entries){
  if(!e.dueDate||seen.has(e.id))continue;seen.add(e.id);
  const key=e.accountId+':'+e.dueDate;
  const row=groups.get(key)??{accountId:e.accountId,date:e.dueDate,amount:'0'};
  const amount=e.settlementAmount??sum(e.lines.filter(l=>['receivable','payable'].includes(l.bucket)).map(l=>dec(l.debit).minus(l.credit)));
  row.amount=dec(row.amount).plus(amount).toString();groups.set(key,row);
 }
 return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.accountId.localeCompare(b.accountId));
}
export function settlementSummary(rows,date,calendar){
 const future=[...new Set(calendar.businessDates)].filter(d=>d>date).sort();
 const pending=rows.filter(r=>r.date>date),receivable=sum(pending.filter(r=>dec(r.amount).gt(0)).map(r=>r.amount)),payable=sum(pending.filter(r=>dec(r.amount).lt(0)).map(r=>dec(r.amount).neg()));
 const at=n=>({date:future[n-1]??null,amount:sum(pending.filter(r=>r.date===future[n-1]).map(r=>r.amount)).toString()});
 return {receivable:receivable.toString(),payable:payable.toString(),t1:at(1),t2:at(2)};
}
