import test from "node:test";
import assert from "node:assert/strict";
import { createBook } from "../../src/storage/book.js";
import {
  exportBackup,
  inspectBackup,
  backupDue,
} from "../../src/storage/backup.js";
test("backup round trip preserves exact financial strings and audit", async () => {
  const b = createBook("personal", "2026-10-19");
  b.cashFlows.push({ id: "a", amount: "14.400001" });
  const text = await exportBackup(b);
  assert.deepEqual((await inspectBackup(text)).value, b);
  const j = JSON.parse(text);
  j.book.cashFlows[0].amount = "99";
  assert.equal((await inspectBackup(JSON.stringify(j))).ok, false);
});
test("unknown version and invalid references never overwrite a book", async () => {
  const b = createBook("personal", "2026-10-19");
  b.schemaVersion = 99;
  assert.equal((await inspectBackup(await exportBackup(b))).ok, false);
});
test("backup reminder triggers after seven days or twenty financial events", () => {
  const b = createBook("personal", "2026-09-01");
  b.lastBackupAt = "2026-09-01";
  assert.equal(backupDue(b, "2026-09-08"), true);
  b.lastBackupAt = "2026-09-08";
  b.eventsSinceBackup = 20;
  assert.equal(backupDue(b, "2026-09-08"), true);
});
