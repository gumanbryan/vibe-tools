import { ok, err } from "../domain/result.js";
export async function openBookStore(namespace = "personal") {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open("stock-daily-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("books");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("stock-daily-" + namespace)
      : null;
  return {
    channel,
    close() {
      channel?.close();
      db.close();
    },
    load() {
      return new Promise((res, rej) => {
        const r = db.transaction("books").objectStore("books").get(namespace);
        r.onsuccess = () => res(r.result ?? null);
        r.onerror = () => rej(r.error);
      });
    },
    save(book, expectedRevision) {
      return new Promise((resolve) => {
        const tx = db.transaction("books", "readwrite"),
          store = tx.objectStore("books"),
          read = store.get(namespace);
        let result;
        read.onsuccess = () => {
          const old = read.result;
          if (
            expectedRevision !== undefined &&
            (old?.revision ?? 0) !== expectedRevision
          ) {
            result = err(
              "REVISION_CONFLICT",
              "另一個分頁已更新帳本，請重新載入",
            );
            tx.abort();
            return;
          }
          const next = structuredClone(book);
          next.revision = (old?.revision ?? 0) + 1;
          store.put(next, namespace);
          result = ok(next);
        };
        tx.oncomplete = () => {
          channel?.postMessage({
            kind: "updated",
            revision: result.value.revision,
          });
          resolve(result);
        };
        tx.onerror = () =>
          resolve(err("STORAGE_FAILED", "無法儲存，請先匯出備份"));
        tx.onabort = () =>
          resolve(result ?? err("STORAGE_FAILED", "儲存失敗，原帳本未變更"));
      });
    },
  };
}
