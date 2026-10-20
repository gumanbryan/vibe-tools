import {accrueInterest} from './credit.js';
import {dec} from '../domain/money.js';
export function openingInterestEstimate(principal,ratePercent,interestStart,openingDate,rule={}){
 for(const date of [interestStart,openingDate])if(!/^\d{4}-\d{2}-\d{2}$/.test(date??'')||!Number.isFinite(Date.parse(date+'T00:00:00Z')))throw Error('請完整填寫計息起日');
 const end=new Date(openingDate+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-1);
 const rate=dec(ratePercent).div(100),p=dec(principal);if(p.lt(0)||rate.lt(0))throw Error('本金與利率不可為負數');
 const result=accrueInterest({principal:p.toString(),annualRate:rate.toString()},interestStart,end.toISOString().slice(0,10),rule);
 if(!result.ok)throw Error(result.errors.map(e=>e.message).join('；'));
 return {days:result.value.daily.length,amount:result.value.total};
}
