import {E,button,table,card,note} from '../helpers.js';
import {RECOVERABLE} from '../../storage/recovery.js';
const raw = x => x === '' || x == null ? '未填' : E(x);
export function recoveryPage(book) {
  const sections=Object.entries(RECOVERABLE).filter(([key])=>book[key]?.length).map(([key,name])=>card(name,table(
    ['日期／紀錄ID','商品／帳戶','原始數值','操作'],
    [...book[key]].reverse().map(r=>[
      E(r.date??r.exDate??book.openingDate)+'<small class="block">'+E(r.id)+'</small>',
      E(r.code??r.accountId??''),
      key==='openingPositions'||key==='trades'
        ? `股數 ${raw(r.qty)} · 單價 ${raw(r.price)}${key==='openingPositions'?' · 本金 '+raw(r.principal):''}`
        : E(JSON.stringify(r).slice(0,180)),
      (['openingPositions','trades'].includes(key)?button('repair-record','修正數值','ghost',`data-collection="${key}" data-id="${E(r.id)}"`):'')+
      button('pause-record','暫停這筆紀錄','secondary',`data-collection="${key}" data-id="${E(r.id)}"`),
    ]))));
  return card('先保留原始資料',note('這個頁面不需要計算淨值。請先備份，再修正欄位，或暫停疑似錯誤的一筆紀錄。暫停不會刪除，稍後可恢復；未確認前不會修改帳本。')+
    button('export','匯出完整備份','primary')+button('import','匯入修正版備份')+'<input hidden id="backup-file" type="file" accept="application/json,.json">')+
    card('帳戶現金與費率',table(['帳戶','期初現金','操作'],book.accounts.map(a=>[E(a.name),raw(a.openingCash),button('repair-account','修正數值','ghost',`data-id="${E(a.id)}"`)])))+
    sections.join('')+
    card('已暫停的紀錄',table(['類型','紀錄ID','操作'],(book.quarantine??[]).map(q=>[E(RECOVERABLE[q.collection])+(q.deleted?'（已刪除）':''),E(q.record.id),button('restore-record','恢復紀錄','ghost',`data-id="${E(q.id)}"`)])))+
    note('若暫停後仍顯示計算錯誤，代表還有其他資料需要核對。每次修改前會下載完整備份，原始版本也保留在操作紀錄。');
}
