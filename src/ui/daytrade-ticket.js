import {E,field,select,note,button,num} from './helpers.js';
import {dayBuyCandidates} from '../ledger/daytrade-ticket.js';
export function dayTicketFields(book,initial){
 return `<div class="form-grid">${select('accountId','帳戶',book.accounts.map(a=>[a.id,a.name]),initial.accountId)}${field('date','交易日期','date',initial.date,'required')}${field('code','股票代號','text',initial.code??'','required list="ticket-securities"')}</div>`+
 note('僅限現股先買後賣。已輸入過的買進不用再新增，可直接選取下方買進價位。相同委託號碼代表同一張委託，不同號碼代表分單。')+
 '<div class="ticket-board">'+['buy','sell'].map(side=>`<section class="ticket-side"><h3>${side==='buy'?'買進成交':'賣出成交'}</h3><div class="button-row"><button type="button" class="btn secondary" data-ticket-action="add" data-side="${side}">＋ 一筆${side==='buy'?'買進':'賣出'}</button><button type="button" class="btn ghost" data-ticket-action="same" data-side="${side}">同一委託分批成交</button><button type="button" class="btn ghost" data-ticket-action="separate" data-side="${side}">各筆獨立委託</button>${side==='buy'?'<button type="button" class="btn ghost" data-ticket-action="existing">只用既有買進</button>':''}</div><div data-ticket-rows="${side}"></div></section>`).join('')+'</div>'+
 '<p class="note" data-ticket-total></p>'+note('同一委託共用一次最低手續費；同一委託、相同價位合併估算交易稅。各筆成交與配對仍分別保存。按預覽後才會顯示本次費用，不會立即寫入帳本。');
}
export function wireDayTicket(form,book,batchId,validate){
 const el=form.elements;form.classList.add('trade-form','day-ticket-form');
 let rows={buy:[{price:'',qty:'1000',order:'1'}],sell:[{price:'',qty:'1000',order:'1'}]};
 const collect=side=>[...form.querySelectorAll(`[data-ticket-row][data-side="${side}"]`)].map(row=>Object.fromEntries([...row.querySelectorAll('input,select')].map(i=>[i.dataset.key,i.value])));
 const sync=()=>{rows={buy:collect('buy'),sell:collect('sell')};};
 const scope=()=>({accountId:el.accountId.value,date:el.date.value,code:el.code.value.trim()});
 function updateOptions(){
  const buys=[...dayBuyCandidates(book,scope()).map(b=>[b.id,`${b.price} 元 · 可配 ${b.availableQty} 股 · 買進 ${b.id.slice(-6)}`]),...collect('buy').map((r,i)=>[`${batchId}:buy:${i}`,`新買進 ${i+1}：${r.price||'待填'} 元 · ${r.qty||0} 股`])];
  for(const select of form.querySelectorAll('[data-key=buyTradeId]')){
   const old=select.value;const options=[['auto','自動配對（依買進順序）'],...buys];
   select.innerHTML=options.map(([v,l])=>`<option value="${E(v)}">${E(l)}</option>`).join('');select.value=options.some(([v])=>v===old)?old:'auto';
  }
  const buyQty=collect('buy').reduce((n,r)=>n+Number(r.qty||0),0),sellQty=collect('sell').reduce((n,r)=>n+Number(r.qty||0),0);
  const existing=dayBuyCandidates(book,scope()).reduce((n,b)=>n+Number(b.availableQty),0);
  form.querySelector('[data-ticket-total]').textContent=`既有可配 ${num(existing)} 股 · 新買進 ${num(buyQty)} 股 · 本次賣出 ${num(sellQty)} 股`;
 }
 function render(){
  for(const side of ['buy','sell'])form.querySelector(`[data-ticket-rows="${side}"]`).innerHTML=rows[side].map((r,i)=>`<div class="ticket-row" data-ticket-row data-side="${side}" data-index="${i}"><strong>${side==='buy'?'買進':'賣出'} ${i+1}</strong><div class="form-grid">${field(`${side}-price-${i}`,'成交價','number',r.price,'min="0.01" step="0.01" required data-key="price"')}${field(`${side}-qty-${i}`,'股數','number',r.qty,'min="1" step="1" required data-key="qty"')}${field(`${side}-order-${i}`,'委託號碼','text',r.order,'required data-key="order"')}${side==='sell'?`<label class="field"><span>對應買進價位</span><select name="sell-match-${i}" data-key="buyTradeId" data-selected="${E(r.buyTradeId??'auto')}"></select></label>`:''}</div><div class="button-row"><button type="button" class="btn ghost" data-ticket-action="lot">＋1,000股</button><button type="button" class="btn ghost" data-ticket-action="split">同價拆成兩筆</button><button type="button" class="btn ghost" data-ticket-action="remove">移除此筆</button></div></div>`).join('');
  updateOptions();for(const s of form.querySelectorAll('[data-selected]'))if([...s.options].some(o=>o.value===s.dataset.selected))s.value=s.dataset.selected;validate();
 }
 form.addEventListener('click',event=>{
  const button=event.target.closest('[data-ticket-action]');if(!button)return;sync();
  const action=button.dataset.ticketAction,row=button.closest('[data-ticket-row]'),side=button.dataset.side??row?.dataset.side,index=Number(row?.dataset.index);
  if(action==='add')rows[side].push({price:'',qty:'1000',order:String(rows[side].length+1)});
  if(action==='existing')rows.buy=[];
  if(action==='same'||action==='separate')rows[side].forEach((r,i)=>r.order=action==='same'?'1':String(i+1));
  if(action==='remove')rows[side].splice(index,1);
  if(action==='lot')rows[side][index].qty=String(Number(rows[side][index].qty||0)+1000);
  if(action==='split'){
   const r=rows[side][index],qty=Number(r.qty),first=qty>1000?1000:Math.floor(qty/2);
   if(first>0)rows[side].splice(index,1,{...r,qty:String(first)},{...r,qty:String(qty-first),order:String(rows[side].length+1)});
  }
  render();
 });
 form.addEventListener('input',updateOptions);form.addEventListener('change',updateOptions);
 render();
 return ()=>({...scope(),buys:collect('buy'),sells:collect('sell')});
}
