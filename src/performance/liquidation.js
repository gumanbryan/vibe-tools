import {valueAccount as bookValue} from './portfolio.js';
import {dec,sum} from '../domain/money.js';
import {ok,err} from '../domain/result.js';
import {datesBetween} from '../domain/calendar.js';
import {calculateFee,calculateTax,DEFAULT_PROFILE} from '../ledger/fees.js';
const unwrap=r=>{if(!r.ok)throw Error(r.errors.map(x=>x.message).join('；'));return r.value;};
export function valueAccount(book,market,date,accountId=null){
 const r=bookValue(book,market,date,accountId);if(!r.ok)return r;
 const s=r.value, warnings=[...s.warnings],groups=new Map();let missing=s.quality==='insufficient';
 const positions=s.positions.map(p=>({...p,grossUnrealized:p.unrealized}));
 for(const p of positions){const key=JSON.stringify([p.accountId,p.code,p.creditType,p.direction]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
 let exitFee=dec(0),exitTax=dec(0);
 for(const ps of groups.values()){
  try{
   const first=ps[0],profile=book.accounts.find(a=>a.id===first.accountId)?.profile??DEFAULT_PROFILE;
   const qty=sum(ps.map(p=>p.qty)),gross=sum(ps.map(p=>p.marketValue)),price=gross.div(qty);
   let fee=dec(0),rebate=dec(0),tax=dec(0);
   // Estimate a combined close order, with separate round-lot and odd-lot minimums.
   for(const q of [qty.div(1000).floor().mul(1000),qty.mod(1000)]){
    if(q.isZero())continue;
    const f=unwrap(calculateFee({gross:q.mul(price).toString(),marketType:q.lt(1000)?'odd':'regular',profile}));
    fee=fee.plus(f.grossFee);rebate=rebate.plus(f.rebate);
    if(first.direction!=='short')tax=tax.plus(unwrap(calculateTax({gross:q.mul(price).toString(),security:market.securities.find(x=>x.code===first.code)??{},date})).tax);
   }
   exitFee=exitFee.plus(fee);exitTax=exitTax.plus(tax);
   for(const p of ps){
    const ratio=dec(p.qty).div(p.initialQty??p.qty),weight=dec(p.marketValue).div(gross);
    let entry;
    if(p.stockGrant)entry={grossFee:'0',rebate:'0'};
    else if(p.grossFee!=null)entry={grossFee:dec(p.grossFee).mul(ratio).toString(),rebate:dec(p.rebate??0).mul(ratio).toString()};
    else {const f=unwrap(calculateFee({gross:dec(p.price).mul(p.initialQty??p.qty).toString(),marketType:p.marketType??(dec(p.initialQty??p.qty).lt(1000)?'odd':'regular'),profile:p.ruleSnapshot??profile}));entry={grossFee:dec(f.grossFee).mul(ratio).toString(),rebate:dec(f.rebate).mul(ratio).toString()};p.entryFeeEstimated=true;}
    p.entryFee=entry.grossFee;p.entryRebate=entry.rebate;
    p.entryTax=p.direction==='short'?(p.tax!=null?dec(p.tax).mul(ratio).toString():unwrap(calculateTax({gross:dec(p.price).mul(p.qty).toString(),security:market.securities.find(x=>x.code===p.code)??{},date:p.acquiredDate??p.date??date})).tax):'0';
    p.exitFee=fee.mul(weight).toString();p.exitTax=tax.mul(weight).toString();p.estimatedExitRebate=rebate.mul(weight).toString();
    // Entry rebates belong to portfolio receivables, not this gross-fee P&L.
    p.unrealized=dec(p.grossUnrealized).minus(p.entryFee).minus(p.entryTax).minus(p.exitFee).minus(p.exitTax).toString();
   }
  }catch(e){missing=true;warnings.push(`${ps[0].code} 平倉費用待核對：${e.message}`);for(const p of ps){p.unrealized=null;p.exitFee=null;p.exitTax=null;}}
 }
 return ok({...s,positions,markedEquity:s.equity,equity:missing?null:dec(s.equity).minus(exitFee).minus(exitTax).toString(),exitFee:missing?null:exitFee.toString(),exitTax:missing?null:exitTax.toString(),quality:missing?'insufficient':s.quality,warnings});
}
export function buildSnapshots(book,market,toDate,accountId=null){
 try{const out=[];let base=null,previous=null;for(const date of datesBetween(book.openingDate,toDate)){
  const s=unwrap(valueAccount(book,market,date,accountId));if(!out.length)base=s.equity;
  out.push({...s,pnl:s.equity!=null&&previous!=null?dec(s.equity).minus(previous).toString():null,return:s.equity!=null&&base!=null&&dec(base).gt(0)?dec(s.equity).div(base).minus(1).toString():null});previous=s.equity;
 }return ok(out);}catch(e){return err('LIQUIDATION_FAILED',e.message);}
}
export function valuationRows(s){
 const rows=[['多頭股票市值',s.longValue],['融券／空頭市值',dec(s.shortValue).neg().toString()],['待入帳股票股利市值',s.pendingStockValue]];
 for(const [key,label] of Object.entries({cash:'已交割現金',restricted:'受限制擔保款',receivable:'帳務待收交割款',payable:'帳務待付交割款',marginDebt:'未償融資本金',rebateReceivable:'待退折讓（已計入、尚未入帳）',dividendReceivable:'待收現金股利',interestPayable:'已累積未付融資／融券利息',feePayable:'其他待付費用',otherAsset:'其他資產',otherLiability:'其他負債'}))rows.push([label,s.balances[key]??'0']);
 rows.push(['預估平倉原始手續費',s.exitFee==null?null:dec(s.exitFee).neg().toString()],['預估平倉交易稅',s.exitTax==null?null:dec(s.exitTax).neg().toString()]);return rows.map(([label,amount])=>({label,amount}));
}
