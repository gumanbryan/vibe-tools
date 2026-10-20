import test from "node:test";
import assert from "node:assert/strict";
import { verifyIntegrity } from "../../src/market/loader.js";
test("market shards with a mismatched digest are rejected", async () => {
  await assert.rejects(() => verifyIntegrity("[]", "not-a-real-digest"));
});
