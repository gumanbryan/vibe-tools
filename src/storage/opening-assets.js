import {dec} from '../domain/money.js';
import {addBusinessDays} from '../domain/calendar.js';
const owned=(e,id)=>e.accountId===id&&(e.openingAssetsAccountId===id||e.openingSettlement===true);
export function readOpeningAssets(book,accountId,calendar){
 const a=book.accounts.find(a=>a.id===accountId);if(!a)throw Error('找不到帳戶');
 const saved=book.openingAssets?.find(a=>a.accountId===accountId);
 const out={accountId,cash:a.openingCash??'0',t1:'0',t2:'0',rebateAmount:'0',rebateMonth:book.openingDate.slice(0,7),...saved};
 if(!saved)for(const n of [1,2]){const due=addBusinessDays(book.openingDate,n,calendar);if(due.ok){let amount=dec(0);for(const e of book.entries??[])if(owned(e,accountId)&&e.date===book.openingDate&&e.dueDate===due.value)for(const l of e.lines)if(['receivable','payable'].includes(l.bucket))amount=amount.plus(l.debit).minus(l.credit);out['t'+n]=amount.toString();}}
 return {...out,cash:a.openingCash??'0'};
}
export function applyOpeningAssets(book,input,calendar){
 const draft=structuredClone(book),a=draft.accounts.find(a=>a.id===input.accountId);if(!a)throw Error('找不到帳戶');
 const cfg={accountId:a.id,rebateMonth:input.rebateMonth||book.openingDate.slice(0,7)};
 for(const k of ['cash','t1','t2','rebateAmount']){let d;try{d=dec(input[k]);}catch{throw Error('請完整輸入現金與待交割金額');}if(!d.isFinite()||(['cash','rebateAmount'].includes(k)&&d.isNegative()))throw Error('現金及待退折讓須為零或正數，待交割款可填負數');cfg[k]=d.toString();}
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(cfg.rebateMonth))throw Error('請選擇折讓所屬月份');
 const previous=book.openingAssets?.find(x=>x.accountId===a.id);
 if((book.rebateReceipts??[]).some(r=>r.accountId===a.id&&[previous?.rebateMonth,cfg.rebateMonth].some(m=>m&&r.id===a.id+":"+m))&&(previous?.rebateAmount!==cfg.rebateAmount||previous?.rebateMonth!==cfg.rebateMonth))throw Error('此月份折讓已確認入帳，請先修正入帳紀錄後再調整期初折讓');
 draft.entries=(draft.entries??[]).filter(e=>!owned(e,a.id));
 const add=(suffix,date,lines,extra={})=>draft.entries.push({id:`opening-assets:${a.id}:${suffix}`,sourceId:`opening-assets:${a.id}`,revision:1,accountId:a.id,date,openingAssetsAccountId:a.id,lines,...extra});
 const l=(bucket,debit='0',credit='0')=>({bucket,debit,credit});
 for(const n of [1,2]){const amount=dec(cfg['t'+n]);if(amount.isZero())continue;const due=addBusinessDays(book.openingDate,n,calendar);if(!due.ok)throw Error(`T+${n} 交割日曆未涵蓋開始追蹤日期，請選擇有日曆資料的交易日`);const abs=amount.abs().toString(),positive=amount.isPositive(),bucket=positive?'receivable':'payable';
 add(`t${n}`,book.openingDate,positive?[l(bucket,abs),l('openingEquity','0',abs)]:[l('openingEquity',abs),l(bucket,'0',abs)],{dueDate:due.value});
 add(`t${n}:settled`,due.value,positive?[l('cash',abs),l(bucket,'0',abs)]:[l(bucket,abs),l('cash','0',abs)]);
 }
 if(dec(cfg.rebateAmount).gt(0))add('rebate',book.openingDate,[l('rebateReceivable',cfg.rebateAmount),l('openingEquity','0',cfg.rebateAmount)]);
 a.openingCash=cfg.cash;draft.openingAssets=[...(draft.openingAssets??[]).filter(x=>x.accountId!==a.id),cfg];return draft;
}
export const openingRebateTrades=book=>(book.openingAssets??[]).filter(x=>dec(x.rebateAmount).gt(0)).map(x=>({id:`opening-rebate:${x.accountId}`,accountId:x.accountId,date:x.rebateMonth+'-01',rebate:x.rebateAmount}));
