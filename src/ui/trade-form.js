import {dayBuyCandidates} from '../ledger/daytrade-ticket.js';
import {E} from './helpers.js';
import {dec} from '../domain/money.js';
import {DEFAULT_PROFILE} from '../ledger/fees.js';

// Disable irrelevant inputs as well as hiding them: they must not block validation
// or leak old overrides into the transaction after changing its type.
export function wireTradeForm(form,{accounts,securities,book,original},validate){
 const el=form.elements;
 const feeExplanation=form.querySelector("[data-fee-description]")?.innerHTML;
 form.classList.add('trade-form');
 const initial=el.dayType.value==='cash-day'&&el.creditType.value==='cash'?'cash-day':!el.dayType.value&&['cash','margin'].includes(el.creditType.value)?`${el.creditType.value}-${el.side.value}`:'other';
 el.tradePreset.value=initial;
 function applyPreset(){
  const preset=el.tradePreset.value;
  if(preset==='other')return;
  const [type,side]=preset.split('-');
  el.creditType.value=type;el.dayType.value=preset==='cash-day'?'cash-day':'';
  el.side.value=preset==='cash-day'?'buy':side;
 }

 function visible(name,show,required=false){
  const input=el[name];input.disabled=!show;input.required=show&&required;input.closest('label').hidden=!show;
 }
 function update(event){
  if(event?.target===el.tradePreset)applyPreset();
  const preset=el.tradePreset.value;
  el.side.closest('label').hidden=!(preset==='other'||preset==='cash-day');
  el.creditType.closest('label').hidden=preset!=='other';
  el.dayType.closest('label').hidden=preset!=='other';
  if(event?.target===el.accountId){
   const p=accounts.find(a=>a.id===el.accountId.value)?.profile??DEFAULT_PROFILE;
   el.discountTenths.value=p.discountTenths;
   el.marginRatio.value=dec(p.marginRatio??DEFAULT_PROFILE.marginRatio).mul(100).toString();
   el.annualRate.value=dec(p.annualRate||DEFAULT_PROFILE.annualRate).mul(100).toString();
  }
  const margin=el.creditType.value==='margin',day=!!el.dayType.value;
  visible("actualPrincipal",margin&&el.side.value==="buy");
  visible("actualCreditInterest",margin&&el.side.value==="sell");
  for(const key of ['marginRatio','annualRate'])visible(key,margin,true);
  const cashDay=el.dayType.value==='cash-day';
  const quick=form.querySelector('[data-quick-day-button]');if(quick)quick.hidden=!cashDay;
  const showPair=day&&(!cashDay||el.side.value==='sell');
  const previous=el.pairedTradeId.value;
  if(showPair&&cashDay&&book){
   const paired=original&&book.allocations.some(a=>a.kind==='cash-day'&&(a.openTradeId===original.id||a.closeTradeId===original.id));
   const same=original&&original.accountId===el.accountId.value&&original.code===el.code.value.trim()&&original.date===el.date.value;
   const options=[...(paired&&same?[['keep','保留原配對（修改費用不變更配對）']]:[]),['auto','自動配對：依買進順序'],...dayBuyCandidates(book,{accountId:el.accountId.value,date:el.date.value,code:el.code.value.trim(),excludeTradeId:original?.id}).map(t=>[t.id,`${t.price} 元 · 可配 ${t.availableQty} 股 · 買進批次 ${t.id.slice(-6)}`])];
   el.pairedTradeId.innerHTML=options.map(([id,label])=>`<option value="${E(id)}">${E(label)}</option>`).join('');
   el.pairedTradeId.value=options.some(o=>o[0]===previous)?previous:options[0][0];
  }
  visible('pairedTradeId',showPair);visible('dayQty',showPair&&!cashDay);
  const manual=form.querySelector('[data-manual-close]');if(manual){manual.hidden=day;manual.querySelectorAll('input').forEach(input=>input.disabled=day);}
  const explanation=form.querySelector('[data-fee-description]');if(explanation&&cashDay)explanation.textContent='同一張委託拆成多筆成交才使用相同群組；不同委託請分開。實收手續費是整張委託的總額。多價位可直接使用「多價位快速當沖」。';
  if(explanation&&!cashDay)explanation.innerHTML=feeExplanation;
  form.querySelector('[data-day-trade-help]').hidden=!day;
  if(!showPair){el.pairedTradeId.value='';el.dayQty.value='';}
  const sec=securities.find(s=>s.code===el.code.value.trim());
  visible('bondTaxExempt',sec?.productType==='bond-etf'&&el.side.value==='sell');
 }
 update();validate();
 form.addEventListener('input',update,true);
 form.addEventListener('change',update,true);
}
