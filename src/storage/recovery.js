export const RECOVERABLE = {
  openingPositions: '起始持股', trades: '交易', cashFlows: '入出金',
  openingBalances: '期初其他餘額', feeAdjustments: '費用校正',
  confirmations: '股利權益', rebateReceipts: '折讓入帳', collateralEvents: '擔保款變動',
};
export function pauseRecord(book, collection, id, quarantineId) {
  if (!RECOVERABLE[collection]) throw Error('此類資料不可暫停');
  const draft = structuredClone(book), record = draft[collection]?.find(r => r.id === id);
  if (!record) throw Error('找不到這筆紀錄，請重新整理');
  const linked = ['openingPositions','trades'].includes(collection)
    ? (draft.allocations ?? []).filter(a => a.openTradeId === id || a.closeTradeId === id) : [];
  draft.quarantine ??= [];
  draft.quarantine.push({id:quarantineId,collection,record,allocations:linked,index:draft[collection].findIndex(r=>r.id===id),at:new Date().toISOString()});
  draft[collection] = draft[collection].filter(r=>r.id!==id);
  draft.allocations = (draft.allocations ?? []).filter(a=>!linked.some(x=>x.id===a.id));
  return draft;
}
export function restoreRecord(book, quarantineId) {
  const draft=structuredClone(book), q=draft.quarantine?.find(x=>x.id===quarantineId);
  if(!q || !RECOVERABLE[q.collection]) throw Error('找不到可恢復的紀錄');
  const records=draft[q.collection] ??= [];
  if(records.some(r=>r.id===q.record.id))throw Error('已有相同ID，不能覆蓋原紀錄');
  if((q.allocations??[]).some(a=>draft.allocations.some(x=>x.id===a.id)))throw Error('已有相同沖銷紀錄，請先核對');
  records.splice(Math.min(q.index ?? records.length,records.length),0,q.record);
  draft.allocations.push(...(q.allocations??[]));
  draft.quarantine=draft.quarantine.filter(x=>x.id!==quarantineId);
  return draft;
}
export function deleteTrade(book,id,quarantineId) {
  const draft=pauseRecord(book,'trades',id,quarantineId);
  draft.quarantine.at(-1).deleted=true;
  return draft;
}
