import {field,note,num} from './helpers.js';
import {addBusinessDays} from '../domain/calendar.js';
import {dec} from '../domain/money.js';
export const openingAssetFields=(v={})=>`<div class="form-grid">${field('cash','起始已交割現金','number',v.cash??'0','min="0" step="0.01" required')}${field('t1','T+1 待交割款（正收／負付）','number',v.t1??'0','step="0.01" required')}${field('t2','T+2 待交割款（正收／負付）','number',v.t2??'0','step="0.01" required')}${field('rebateAmount','起始待退折讓（尚未入帳）','number',v.rebateAmount??'0','min="0" step="0.01" required')}${field('rebateMonth','折讓所屬交易月份','month',v.rebateMonth??'','required')}</div><p class="note" data-opening-preview aria-live="polite"></p>${note('以開始追蹤日的資產快照填寫：現金不要包含待交割款。正數代表將收到，負數代表將扣款；T+1、T+2 依交易日曆計算。這些款項已包含在起始淨值，到期只轉入或扣除現金。起始持股另外新增，之後的買賣請用新增交易，避免重複登錄。')}`;
export function wireOpeningAssets(form,date,calendar){
 const update=()=>{const start=form.elements.openingDate?.value||date;const d1=addBusinessDays(start,1,calendar),d2=addBusinessDays(start,2,calendar);const el=form.querySelector('[data-opening-preview]');try{const cash=dec(form.elements.cash.value),t1=dec(form.elements.t1.value),t2=dec(form.elements.t2.value);el.textContent=`起始日 ${start}｜T+1 ${d1.ok?d1.value:'日曆未涵蓋'}：交割後現金 ${num(cash.plus(t1),2)} 元｜T+2 ${d2.ok?d2.value:'日曆未涵蓋'}：交割後現金 ${num(cash.plus(t1).plus(t2),2)} 元（不含後續交易）`; }catch{el.textContent='請完整填入現金與待交割款，才能預覽。';}};
 form.addEventListener('input',update);form.addEventListener('change',update);update();
}
export const validateOpeningAssets=(date,calendar)=>form=>{
 const start=form.elements.openingDate?.value||date;
 for(const n of [1,2]){const el=form.elements['t'+n];if(el.value&&Number(el.value)!==0&&!addBusinessDays(start,n,calendar).ok)el.setCustomValidity('開始追蹤日期缺少對應交割日，請改用日曆已涵蓋的交易日');}
};
