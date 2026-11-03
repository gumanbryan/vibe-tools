import {E,num,pct,signed,color,table,card,note,button} from '../helpers.js';
import {strategySummary} from '../../performance/realized.js';
export const strategyChoice=checked=>`<label class="strategy-choice"><input type="checkbox" name="strategyDisposition" value="yes" ${checked?'checked':''}><span>這筆買進屬於處置股策略</span></label>`;
export function strategy(v){
 const s=strategySummary(v.latest),count=s.records.length;
 return `<div class="section-actions"><p class="muted">標記買進批次，賣出自動承接；交易只記錄一次。</p>${button('strategy-tags','管理／補標策略紀錄','secondary')}</div>`+
 card('處置股策略績效',table(['已實現淨獲利','已賣出部分自備資金','自備資金報酬率','賣出紀錄數','勝率（按賣出紀錄）'],[[`<strong class="${color(s.profit)}">${signed(s.profit,2)}</strong>`,num(s.capital,2),pct(s.return),num(count),count?pct(s.wins/count):'—']])+note('報酬率＝策略已實現淨獲利合計 ÷ 對應自備資金合計；不是複利或年化報酬。買賣手續費以折讓後淨額計入，含待退折讓一次。尚未賣出的部分不計入此報酬率。融資利息或起始手續費尚未核對時，績效依目前估算。'))+
 card('策略持股',table(['股票','批次／買進日','持有股數','成本價','市值','目前未實現損益'],s.positions.map(p=>[`${E(p.code)} ${E(v.securityName(p.code))}`,`${E(p.acquiredDate??p.date)}<small class="block">${E(p.id.slice(-8))}</small>`,num(p.qty),num(p.price,2),num(p.marketValue),signed(p.unrealized,2)]))+note('未實現損益沿用持股頁的平倉費稅估算，與上方已實現自備資金報酬分開。'))+
 card('策略賣出紀錄',table(['賣出日期','股票','策略股數','自備資金','已實現淨損益','自備資金報酬率','明細'],s.records.slice().reverse().map(r=>[E(r.date),`${E(r.code)} ${E(v.securityName(r.code))}`,num(r.qty),num(r.capital,2),`<span class="${color(r.profit)}">${signed(r.profit,2)}</span>`,pct(r.return),button('realized-detail','損益明細','ghost',`data-id="${E(r.id)}"`)])))+
 note('先到「管理／補標策略紀錄」，替既有東台、達航科技的買進批次補標。其他買進仍屬一般投資，同股票不會整檔自動歸類。');
}
export function realizedDetail(trade,securityName){
 const rows=(trade.realizedParts??[]).map(p=>[`${E(p.acquiredDate??'未記錄')}<small class="block">${E(p.lotId.slice(-8))}</small>`,p.strategyId==='disposition'?'處置股策略':'一般投資',num(p.qty),num(p.entryPrice,2),num(p.entryGross,2),num(p.principal,2),num(p.entryNetFee,2)+(p.entryFeeEstimated?'（估算）':''),num(p.investedCapital,2),num(p.exitNetFee,2),num(p.tax,2),num(p.interest,2)+(p.interestEstimated?'（預估）':''),signed(p.profit,2),pct(p.return)]);
 return note(`${trade.date} ${trade.code} ${securityName(trade.code)}；依實際平倉批次分攤已賣股數的成本與自備資金。`)+table(['買進日／批次','策略','股數','買進價','買進金額','融資本金','買進淨手續費','自備資金','賣出淨手續費','交易稅','融資利息','淨損益','報酬率'],rows)+note('自備資金＝對應買進金額－融資本金＋買進淨手續費。淨損益扣除買賣淨手續費、交易稅與融資利息，折讓只計一次。無自備資金、融券或先賣後買尚未定義的報酬率顯示「—」。現金股利不歸入單筆買賣損益。');
}
