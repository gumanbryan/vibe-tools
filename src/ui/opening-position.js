import {dec} from '../domain/money.js';
import {DEFAULT_PROFILE} from '../ledger/fees.js';
export function estimatedOpeningPrincipal(price,qty,ratio) {
  try {
    const p=dec(price),q=dec(qty),r=dec(ratio);
    if(p.lte(0)||q.lte(0)||!q.isInteger()||r.lte(0)||r.gt(100))return '';
    return p.mul(q).mul(r).div(100).toString();
  }catch{return '';}
}
export function wireOpeningPosition(form,accounts,validate) {
  const el=form.elements, recalculate=form.querySelector('#opening-recalculate'), status=form.querySelector('#opening-principal-status');
  let manual=false;
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
    if(event?.target===el.creditType)manual=false;
    if(event?.target===el.principal)manual=true;
    const margin=el.creditType.value==='margin',short=el.creditType.value==='short';
    for(const key of ['marginRatio','principal','annualRate'])visible(key,margin);
    visible('restricted',short);visible('accruedInterest',margin||short);
    recalculate.hidden=!margin;status.hidden=!margin;
    if(margin && !manual)el.principal.value=estimatedOpeningPrincipal(el.price.value,el.qty.value,el.marginRatio.value);
    status.textContent=manual?'本金已手動修改，後續變更成本、股數或成數會保留此金額；需要重新估算可按「依成數重算本金」。':'自動估算：平均成本 × 股數 × 融資成數。已還款者請直接改填券商目前的未償本金。';
  }
  defaults();update();validate();
  // Capture runs before the shared validation listener, so checks see new values.
  form.addEventListener('input',update,true);
  form.addEventListener('change',update,true);
  recalculate.addEventListener('click',()=>{manual=false;update();validate();});
}
