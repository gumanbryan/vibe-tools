import {dec,sum} from '../domain/money.js';
// Presentation only: retain original lots for closing, interest and corrections.
export function groupPositions(positions){
 const groups=new Map();
 for(const p of positions){
  const key=JSON.stringify([p.accountId,p.code,p.creditType,p.direction]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(p);
 }
 const fields=['marketValue','unrealized','grossUnrealized','entryFee','entryTax','entryRebate','exitFee','exitTax','estimatedExitRebate'];
 return [...groups.values()].map(members=>{
  const qty=sum(members.map(p=>p.qty)),g={...members[0],members,qty:qty.toString(),price:sum(members.map(p=>dec(p.price).mul(p.qty))).div(qty).toString(),entryFeeEstimated:members.some(p=>p.entryFeeEstimated)};
  for(const field of fields)g[field]=members.every(p=>p[field]!=null)?sum(members.map(p=>p[field])).toString():null;
  g.marketPrice=g.marketValue!=null?dec(g.marketValue).div(qty).toString():null;
  g.priceDate=[...new Set(members.map(p=>p.priceDate))].sort().join('／');
  return g;
 });
}
