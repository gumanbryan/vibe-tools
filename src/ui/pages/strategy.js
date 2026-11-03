import {strategyCampaigns} from '../../performance/strategy-campaigns.js';
import {sum} from '../../domain/money.js';
import {E,num,pct,signed,color,table,card,note,button} from '../helpers.js';
import {strategySummary} from '../../performance/realized.js';
export const strategyChoice=checked=>`<label class="strategy-choice"><input type="checkbox" name="strategyDisposition" value="yes" ${checked?'checked':''}><span>這筆買進屬於處置股策略</span></label>`;
export function strategy(v){
 const s=strategyCampaigns(v.book,v.latest),raw=strategySummary(v.latest);
 const detail=c=>button('campaign-detail','本單明細','ghost',`data-id="${E(c.id)}"`);
 return `<div class="section-actions"><p class="muted">加碼、分批賣出合併為同一單；持股歸零後再買另開新單。</p>${button('strategy-tags','管理策略標記','secondary')}</div>`+
 card('處置股策略績效',table(['總已實現損益','已完成單數','平均每單報酬率','勝率（已完成）'],[[`<strong class="${color(s.profit)}">${signed(s.profit,2)}</strong>`,num(s.completed.length),pct(s.meanReturn),pct(s.winRate)]])+note('平均報酬率與勝率只統計已全部出清的單；總已實現損益另包含進行中單的分批賣出。每單以該趟買進自備成本合計為分母。個股損益先扣完整手續費，折讓另外計入淨資產。'))+
 card('策略持股',table(['股票','本單首次買進','已買進／剩餘股數','本單買進自備成本','已實現損益','未實現損益','明細'],s.open.map(c=>{const ids=new Set(c.entries.map(p=>p.lotId));const ps=raw.positions.filter(p=>ids.has(p.id));return [`${E(c.code)} ${E(v.securityName(c.code))}`,E(c.startDate),`${num(c.boughtQty)}／${num(c.remainingQty)}`,num(c.capital,2),signed(c.profit,2),ps.every(p=>p.unrealized!=null)?signed(sum(ps.map(p=>p.unrealized)).toString(),2):'—',detail(c)];}))+note('尚未出清的單不列入平均報酬。未實現損益沿用持股頁估算平倉費稅，未扣尚未支付的融資利息。'))+
 card('已完成策略單',table(['股票','首次買進','全部出清','股數','本單自備成本','淨損益','本單報酬率','持有日數','明細'],s.completed.slice().reverse().map(c=>[`${E(c.code)} ${E(v.securityName(c.code))}`,E(c.startDate),E(c.endDate),num(c.boughtQty),num(c.capital,2),`<span class="${color(c.profit)}">${signed(c.profit,2)}</span>`,pct(c.return),num(c.days),detail(c)]))+note('持有日數按日曆計算，包含買進及出清日；本單報酬不是年化報酬。若部分賣出後再加碼，仍屬同一單，買進成本會累加。'))+
 `<details><summary>逐筆策略賣出紀錄</summary>${table(['日期','股票','股數','未折讓損益','明細'],raw.records.map(r=>[E(r.date),`${E(r.code)} ${E(v.securityName(r.code))}`,num(r.qty),signed(r.profit,2),button('realized-detail','損益明細','ghost',`data-id="${E(r.id)}"`)]))}</details>`;
}
export function campaignDetail(c,securityName){
 return note(`${c.code} ${securityName(c.code)}：${c.startDate} 至 ${c.endDate??'尚未出清'}。同帳戶策略持股歸零才結束一單。`)+table(['買進日期','股數','買進價','融資本金','完整買進手續費','自備成本'],c.entries.map(p=>[E(p.date),num(p.qty),num(p.entryPrice,2),num(p.principal,2),num(p.entryFee,2),num(p.investedCapital,2)]))+table(['賣出日期','股數','賣出價','完整賣出手續費','交易稅','融資利息','本次損益'],c.exits.map(p=>[E(p.date),num(p.qty),num(p.exitPrice,2),num(p.exitFee,2),num(p.tax,2),num(p.interest,2),signed(p.profit,2)]))+note(`本單已實現損益 ${signed(c.profit,2)} 元；${c.endDate?'本單報酬率 '+pct(c.return):'仍在持有，不計完成單報酬率'}。折讓未加回個股損益，淨資產仍列入應退折讓。`);
}
export function realizedDetail(trade,securityName){
 const rows=(trade.realizedParts??[]).map(p=>[`${E(p.acquiredDate??'未記錄')}<small class="block">${E(p.lotId.slice(-8))}</small>`,p.strategyId==='disposition'?'處置股策略':'一般投資',num(p.qty),num(p.entryPrice,2),num(p.entryGross,2),num(p.principal,2),num(p.entryFee,2)+(p.entryFeeEstimated?'（估算）':''),num(p.investedCapital,2),num(p.exitFee,2),num(p.tax,2),num(p.interest,2)+(p.interestEstimated?'（預估）':''),signed(p.profit,2),pct(p.return),p.opening?button("edit-opening","修改原始成本","ghost",`data-id="${E(p.lotId)}"`):"—"]);
 return note(`${trade.date} ${trade.code} ${securityName(trade.code)}；依實際平倉批次分攤已賣股數的成本與自備資金。`)+table(['買進日／批次','策略','股數','買進價','買進金額','融資本金','買進手續費','自備資金','賣出手續費','交易稅','融資利息','淨損益','報酬率','操作'],rows)+note('自備資金＝對應買進金額－融資本金＋完整買進手續費。個股損益扣除完整買賣手續費、交易稅與融資利息；折讓另外計入淨資產，不加回這裡。無自備資金、融券或先賣後買尚未定義的報酬率顯示「—」。現金股利不歸入單筆買賣損益。');
}
