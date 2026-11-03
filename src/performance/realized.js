import {dec,sum} from '../domain/money.js';
import {calculateFee,DEFAULT_PROFILE} from '../ledger/fees.js';
export function closePart(lot,trade,qty){
 const ratio=dec(qty).div(lot.initialQty),gross=dec(lot.price).mul(qty);
 let fee={grossFee:'0',rebate:'0'},estimated=false;
 if(!lot.stockGrant){
  if(lot.grossFee!=null)fee={grossFee:lot.grossFee,rebate:lot.rebate??'0'};
  else {const result=calculateFee({gross:dec(lot.price).mul(lot.initialQty).toString(),profile:lot.ruleSnapshot??DEFAULT_PROFILE,actualGrossFee:lot.actualGrossFee,marketType:lot.marketType??(dec(lot.initialQty).lt(1000)?'odd':'regular')});if(!result.ok)throw Error(result.errors[0].message);fee=result.value;estimated=lot.actualGrossFee==null||lot.actualGrossFee==='';}
 }
 const entryNetFee=dec(fee.grossFee).minus(fee.rebate).mul(ratio),principal=lot.creditType==='margin'?dec(lot.principal).mul(ratio):dec(0);
 return {lotId:lot.id,acquiredDate:lot.acquiredDate??lot.date,code:lot.code,strategyId:lot.strategyId??null,qty:String(qty),entryPrice:lot.price,exitPrice:trade.price,entryGross:gross.toString(),principal:principal.toString(),entryNetFee:entryNetFee.toString(),entryFeeEstimated:estimated,investedCapital:lot.direction==='short'?null:gross.minus(principal).plus(entryNetFee).toString(),unsupported:lot.direction==='short',interestEstimate:'0'};
}
export function finalizeRealized(parts,trade){
 const totalEstimate=sum(parts.map(p=>p.interestEstimate)),totalPrincipal=sum(parts.map(p=>p.principal));
 const actual=trade.actualCreditInterest!=null&&trade.actualCreditInterest!=='';
 const result=parts.map(p=>{
  const weight=dec(p.qty).div(trade.qty),exitNetFee=dec(trade.grossFee).minus(trade.rebate??0).mul(weight),tax=dec(trade.tax).mul(weight);
  const interest=actual?dec(trade.creditInterest??0).mul(totalEstimate.gt(0)?dec(p.interestEstimate).div(totalEstimate):totalPrincipal.gt(0)?dec(p.principal).div(totalPrincipal):weight):dec(p.interestEstimate);
  const profit=p.unsupported?null:dec(p.exitPrice).minus(p.entryPrice).mul(p.qty).minus(p.entryNetFee).minus(exitNetFee).minus(tax).minus(interest);
  return {...p,exitNetFee:exitNetFee.toString(),tax:tax.toString(),interest:interest.toString(),interestEstimated:trade.creditInterestEstimated??false,profit:profit?.toString()??null,return:profit!=null&&dec(p.investedCapital).gt(0)?profit.div(p.investedCapital).toString():null};
 });
 const supported=result.length>0&&result.every(p=>p.profit!=null),capital=supported?sum(result.map(p=>p.investedCapital)):null,profit=supported?sum(result.map(p=>p.profit)):null;
 return {realizedParts:result,realizedProfit:profit?.toString()??null,investedCapital:capital?.toString()??null,realizedReturn:capital?.gt(0)?profit.div(capital).toString():null};
}
export function strategySummary(snapshot){
 const records=(snapshot.tradeDetails??[]).flatMap(t=>{
  const parts=(t.realizedParts??[]).filter(p=>p.strategyId==='disposition'&&p.profit!=null);if(!parts.length)return [];
  const profit=sum(parts.map(p=>p.profit)),capital=sum(parts.map(p=>p.investedCapital));
  return [{id:t.id,date:t.date,accountId:t.accountId,code:t.code,qty:sum(parts.map(p=>p.qty)).toString(),profit:profit.toString(),capital:capital.toString(),return:capital.gt(0)?profit.div(capital).toString():null,parts}];
 });
 const profit=sum(records.map(r=>r.profit)),capital=sum(records.map(r=>r.capital));
 return {records,profit:profit.toString(),capital:capital.toString(),return:capital.gt(0)?profit.div(capital).toString():null,wins:records.filter(r=>dec(r.profit).gt(0)).length,positions:(snapshot.positions??[]).filter(p=>p.strategyId==='disposition')};
}
