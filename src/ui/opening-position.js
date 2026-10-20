import {addBusinessDays} from "../domain/calendar.js";
import {openingInterestEstimate} from "../credit/opening-interest.js";
import {num} from "./helpers.js";
import {dec} from '../domain/money.js';
import {DEFAULT_PROFILE} from '../ledger/fees.js';
export function estimatedOpeningPrincipal(price,qty,ratio) {
  try {
    const p=dec(price),q=dec(qty),r=dec(ratio);
    if(p.lte(0)||q.lte(0)||!q.isInteger()||r.lte(0)||r.gt(100))return '';
    return p.mul(q).mul(r).div(100).toString();
  }catch{return '';}
}
export function wireOpeningPosition(form,accounts,validate,{openingDate,calendar,original}={}) {
  const el=form.elements, recalculate=form.querySelector('#opening-recalculate'), status=form.querySelector('#opening-principal-status');
  let manual=!!original,manualStart=!!original,manualInterest=!!original&&(original.interestMode??'manual')==='manual';
  const interestButton=form.querySelector('#opening-interest-recalculate'),interestStatus=form.querySelector('#opening-interest-status');
  function defaults(){
    const p=accounts.find(a=>a.id===el.accountId.value)?.profile ?? DEFAULT_PROFILE;
    el.marginRatio.value=dec(p.marginRatio || DEFAULT_PROFILE.marginRatio).mul(100).toString();
    el.annualRate.value=dec(p.annualRate || DEFAULT_PROFILE.annualRate).mul(100).toString();
  }
  function visible(name,show){
    const input=el[name]; input.disabled=!show; input.required=show;
    input.closest('label').hidden=!show;
  }
  function update(event){
    if(event?.target===el.accountId){defaults();manual=false;}
    if(event?.target===el.creditType&&!original)manual=false;
    if(event?.target===el.acquiredDate)manualStart=false;
    if(event?.target===el.interestStart)manualStart=true;
    if(event?.target===el.accruedInterest)manualInterest=true;
    if(event?.target===el.principal)manual=true;
    const margin=el.creditType.value==='margin',short=el.creditType.value==='short';
    for(const key of ['marginRatio','principal','annualRate','interestStart'])visible(key,margin);
    visible('restricted',short);visible('accruedInterest',margin||short);
    recalculate.hidden=!margin;status.hidden=!margin;
    interestButton.hidden=!margin;interestStatus.hidden=!margin;
    if(margin && !manual)el.principal.value=estimatedOpeningPrincipal(el.price.value,el.qty.value,el.marginRatio.value);
    if(margin){
      if(!manualStart){const due=addBusinessDays(el.acquiredDate.value,2,calendar);el.interestStart.value=due.ok?due.value:'';}
      el.interestMode.value=manualInterest?'manual':'estimate';
      try{
        const profile=original?.accountId===el.accountId.value&&original?.ruleSnapshot?original.ruleSnapshot:accounts.find(a=>a.id===el.accountId.value)?.profile??DEFAULT_PROFILE;
        const estimate=openingInterestEstimate(el.principal.value,el.annualRate.value,el.interestStart.value,openingDate,profile);
        if(!manualInterest)el.accruedInterest.value=dec(estimate.amount).toDecimalPlaces(6).toString();
        interestStatus.textContent=manualInterest?'啟用前利息已手動校正，保留 '+num(el.accruedInterest.value,2)+' 元；若要依日期重新估算，按「依日期重估利息」。':`啟用前估算 ${estimate.days} 天、${num(estimate.amount,2)} 元（計至 ${openingDate} 前一天）。起始日以後另外逐日累計，週末也計息；按本金不變估算。`;
      }catch{
        if(!manualInterest)el.accruedInterest.value='';
        interestStatus.textContent='請填完整本金、利率與計息起日。買進日不在交易日曆內時，請手動填券商計息起日，不需下載更早的股價資料。';
      }
    }
    status.textContent=manual?'本金已手動修改，後續變更成本、股數或成數會保留此金額；需要重新估算可按「依成數重算本金」。':'自動估算：平均成本 × 股數 × 融資成數。已還款者請直接改填券商目前的未償本金。';
  }
  if(!original)defaults();update();validate();
  // Capture runs before the shared validation listener, so checks see new values.
  form.addEventListener('input',update,true);
  form.addEventListener('change',update,true);
  interestButton.addEventListener('click',()=>{manualInterest=false;update();validate();});
  recalculate.addEventListener('click',()=>{manual=false;update();validate();});
}
