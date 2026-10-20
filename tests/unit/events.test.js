import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmEntitlement,
  postCorporateEvent,
  mergeAnnouncements,
} from "../../src/events/events.js";
test("cash dividend first creates receivable then transfer without new income", () => {
  const c = confirmEntitlement(
    {
      id: "e",
      accountId: "a",
      code: "1",
      kind: "cash-dividend",
      exDate: "2026-09-03",
      qty: "1000",
      perShare: "2",
    },
    {},
  ).value;
  assert.equal(postCorporateEvent(c, "2026-09-02").value.length, 0);
  const e = postCorporateEvent(c, "2026-09-03").value[0];
  assert.equal(e.lines[0].debit, "2000");
  assert.equal(
    postCorporateEvent(
      { ...c, receivedDate: "2026-09-10", actualAmount: "2000" },
      "2026-09-10",
    ).value.length,
    2,
  );
});
test("stock entitlement is pending shares and revisions do not overwrite confirmation", () => {
  const c = confirmEntitlement(
    {
      id: "s",
      code: "1",
      kind: "stock-dividend",
      exDate: "2026-09-03",
      qty: "1000",
      ratio: "0.1",
    },
    {},
  ).value;
  assert.equal(c.pendingQty, "100");
  assert.equal(
    mergeAnnouncements(
      [{ id: "e", version: "1", confirmed: true }],
      [{ id: "e", version: "2" }],
    ).value.changed.length,
    1,
  );
});
