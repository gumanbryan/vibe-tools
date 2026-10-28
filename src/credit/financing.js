import {addBusinessDays} from '../domain/calendar.js';
import {openingInterestEstimate} from './opening-interest.js';
import {dec,D,sum} from '../domain/money.js';
import {accrueInterest} from './credit.js';

// TWSE margin operating rules, Article 50: fractions below NT$1,000 are omitted.
export function financedPrincipal(gross,ratio,actual){
 const g=dec(gross),r=dec(ratio);
 if(g.lt(0)||r.lt(0)||r.gt(1))throw Error('成交金額或融資成數超出範圍');
 if(actual!=null&&actual!==''){
  const a=dec(actual);if(a.lt(0)||a.gt(g))throw Error('實際融資本金須介於0與成交金額之間');return a.toString();
 }
 return g.mul(r).div(1000).floor().mul(1000).toString();
}

export function closingInterest(lot,qty,dueDate){
 const ratio=dec(qty).div(lot.initialQty),principal=dec(lot.principal).mul(ratio);
 const last=new Date(dueDate+'T00:00:00Z');last.setUTCDate(last.getUTCDate()-1);
 const profile=lot.ruleSnapshot??{};
 const accrued=accrueInterest(lot,lot.interestStart,last.toISOString().slice(0,10),profile);
 if(!accrued.ok)throw Error(accrued.errors.map(e=>e.message).join('；'));
 const opening=dec(lot.accruedInterest??0);
 const paidRaw=sum((lot.repayments??[]).map(r=>r.interestRaw??0));
 const available=D.max(dec(accrued.value.total).plus(opening).minus(paidRaw),0);
 const share=sum(accrued.value.daily.map(d=>dec(d.principal).gt(0)?dec(d.amount).mul(principal).div(d.principal):0)).plus(opening.mul(ratio));
 // Attribute daily rounding to the repaid shares; the final repayment clears the
 // exact remaining accrued liability, including cumulative rounding remainders.
 const final=lot.remainingQty!=null?dec(lot.remainingQty).isZero():dec(qty).eq(lot.initialQty);
 const raw=final?available:D.min(share,available);
 const charged=profile.interestRounding==='total-floor'||profile.interestRounding==='daily-floor'?raw.floor():raw.toDecimalPlaces(0,D.ROUND_HALF_UP);
 return {raw:raw.toString(),charged:charged.toString(),days:accrued.value.daily.filter(d=>dec(d.principal).gt(0)).length,from:lot.interestStart,through:last.toISOString().slice(0,10)};
}

// Statement amounts override estimates; never infer a new universal rate from them.
export function applyBrokerInterest(book,updates){
 const draft=structuredClone(book),seen=new Set();
 for(const update of updates){
  if(seen.has(update.tradeId))throw Error('融資利息校正紀錄重複');seen.add(update.tradeId);
  const trade=draft.trades.find(t=>t.id===update.tradeId);
  if(!trade||trade.creditType!=='margin'||trade.side!=='sell')throw Error('只能校正融資賣出交易的利息');
  const amount=String(update.amount??'').trim();
  if(amount===''){delete trade.actualCreditInterest;continue;}
  const value=dec(amount);
  if(!value.isFinite()||value.lt(0)||!value.isInteger())throw Error('券商實收融資利息須為零或正整數');
  trade.actualCreditInterest=value.toString();
 }
 return draft;
}

// User-approved statement model: freeze scheduled T+2 before the later closure.
// Only this known event is modeled; do not invent other missing business days.
export function marginInterestDates(trade,bankDue,policy='standard',calendar){
 if(policy==='taishin-20261023-inferred'&&trade.date<'2026-10-23'&&calendar){
  const businessDates=[...new Set([...calendar.businessDates,'2026-10-23'])].sort();
  const planned=addBusinessDays(trade.date,2,{...calendar,businessDates});
  if(!planned.ok)throw Error(planned.errors.map(e=>e.message).join('；'));
  return {start:planned.value,repayment:planned.value,provisional:planned.value!==bankDue};
 }
 return {start:bankDue,repayment:bankDue,provisional:false};
}
export function applyInterestPolicy(book,{accountId,policy,openingDates=[]},calendar){
 if(!['standard','taishin-20261023-inferred'].includes(policy))throw Error('不支援的計息規則');
 const draft=structuredClone(book),account=draft.accounts.find(a=>a.id===accountId);
 if(!account)throw Error('找不到帳戶');account.creditInterestPolicy=policy;
 const seen=new Set();
 for(const input of openingDates){
  const p=draft.openingPositions.find(p=>p.id===input.id&&p.accountId===accountId&&p.creditType==='margin');
  if(!p||seen.has(input.id))throw Error('起始融資部位不存在或重複');seen.add(input.id);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date??'')||input.date>draft.openingDate)throw Error('原始買進日須在帳本啟用日以前');
  const due=addBusinessDays(input.date,2,calendar);if(!due.ok)throw Error(due.errors.map(e=>e.message).join('；'));
  p.acquiredDate=input.date;p.interestStart=marginInterestDates({date:input.date,side:'buy'},due.value,policy,calendar).start;
  if(p.interestMode==='estimate'||dec(p.accruedInterest??0).isZero()){
   const profile=p.ruleSnapshot??account.profile??{};
   p.accruedInterest=openingInterestEstimate(p.principal,dec(p.annualRate??profile.annualRate??'0.0645').mul(100).toString(),p.interestStart,draft.openingDate,profile).amount;
   p.interestMode='estimate';
  }
 }
 return draft;
}
