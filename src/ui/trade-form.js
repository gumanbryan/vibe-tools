import {dec} from '../domain/money.js';
import {DEFAULT_PROFILE} from '../ledger/fees.js';

// Disable irrelevant inputs as well as hiding them: they must not block validation
// or leak old overrides into the transaction after changing its type.
export function wireTradeForm(form,{accounts,securities},validate){
 const el=form.elements;
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
  visible('pairedTradeId',day);visible('dayQty',day);
  form.querySelector('[data-day-trade-help]').hidden=!day;
  if(!day){el.pairedTradeId.value='';el.dayQty.value='';}
  const sec=securities.find(s=>s.code===el.code.value.trim());
  visible('bondTaxExempt',sec?.productType==='bond-etf'&&el.side.value==='sell');
 }
 update();validate();
 form.addEventListener('input',update,true);
 form.addEventListener('change',update,true);
}
