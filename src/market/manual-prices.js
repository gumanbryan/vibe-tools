import {dec} from '../domain/money.js';
const latest=(market,code,date)=>(market.bars??[]).filter(b=>b.code===code&&b.date<=date&&b.close!=null).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
export function setManualPrices(book,market,date,rows){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('估值日期無效');
 const draft=structuredClone(book),codes=new Set(rows.map(r=>r.code));
 draft.valuationPrices=(draft.valuationPrices??[]).filter(q=>q.date!==date||!codes.has(q.code));
 for(const r of rows){if(r.price==null||String(r.price).trim()==='')continue;let price;try{price=dec(r.price);if(price.lte(0))throw Error();}catch{throw Error(`${r.code} 估值價格必須是大於零的有效數字`);}
 const base=latest(market,r.code,date);draft.valuationPrices.push({code:r.code,date,price:price.toString(),baseDate:base?.date??null,baseClose:base?.close??null,updatedAt:new Date().toISOString()});}
 return draft;
}
export function activeManualPrices(book,market,date){
 return (book.valuationPrices??[]).filter(q=>{if(q.date!==date)return false;const base=latest(market,q.code,date);return (base?.date??null)===q.baseDate&&(base?.close??null)===q.baseClose;});
}
export function applyManualPrices(book,market,date){
 const quotes=activeManualPrices(book,market,date);if(!quotes.length)return market;
 const codes=new Set(quotes.map(q=>q.code));
 return {...market,bars:[...market.bars.filter(b=>!(codes.has(b.code)&&b.date===date)),...quotes.map(q=>({code:q.code,date,close:q.price,manual:true,quality:'manual'}))]};
}
