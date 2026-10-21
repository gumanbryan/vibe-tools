import {E,num,table,note} from './helpers.js';
import {valuationRows} from '../performance/liquidation.js';
export function equityDetails(s,name){
 return note(`估值日期 ${s.date}。以目前可估值持股全部平倉後的金額呈現；費用為預估，不會產生交易或改動現金。`)+table(['淨資產組成','金額（元）'],valuationRows(s).map(r=>[E(r.label),num(r.amount,2)]))+table(['合計','金額（元）'],[['帳面淨資產（扣預估平倉費用前）',num(s.markedEquity,2)],['扣費後總淨資產',`<strong>${num(s.equity,2)}</strong>`]])+note('帳務待收／待付款包含交易原始應收應付；交割行事曆則顯示扣除融資撥款、還款或擔保款後的銀行實際收付。已發生手續費已反映於帳務，不再扣一次。待入帳股票股利仍列待收資產，未估其賣出費用。')+table(['股票／批次','市值','預估平倉原始手續費','預估平倉交易稅'],s.positions.map(p=>[`${E(p.code)} ${E(name(p.code))}<small class="block">${E(p.id)}</small>`,num(p.marketValue,2),num(p.exitFee,2),num(p.exitTax,2)]))+note('預估平倉採目前帳戶費率，同帳戶、股票、交易類型合併估算，整股與零股分別計費；交易稅先按一般交易估算，實際當沖配對成交後才套用優惠。未發生的平倉折讓不加入淨資產。')+(s.warnings.length?note(s.warnings.join('；')):'');
}
export function positionDetails(p){
 return table(['損益組成','金額（元）'],[
 ['股價差額損益',num(p.grossUnrealized,2)],['買進／建倉原始手續費'+(p.entryFeeEstimated?'（暫估）':''),num(p.entryFee,2)],['建倉交易稅（融券／先賣）',num(p.entryTax,2)],['預估平倉原始手續費',num(p.exitFee,2)],['預估平倉交易稅',num(p.exitTax,2)],['扣費後未實現損益',`<strong>${num(p.unrealized,2)}</strong>`],['對應建倉折讓（另列於帳務，不加回上方損益）',num(p.entryRebate,2)],['未發生的平倉預估折讓（未計入淨值）',num(p.estimatedExitRebate,2)]
 ])+note('扣費後未實現損益＝股價差額－建倉原始手續費－建倉交易稅－預估平倉手續費－預估平倉交易稅。融資／融券利息另列淨資產負債。已收到或待退的建倉折讓統一在現金／待收折讓呈現。')+(p.entryFeeEstimated?note('起始持股未留存歷史成交手續費，依起始部位費率與成本暫估；只用於這份持股損益明細，不再次扣減總淨資產。'):'');
}
