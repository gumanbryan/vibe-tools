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
 return {raw:raw.toString(),charged:charged.toString()};
}
