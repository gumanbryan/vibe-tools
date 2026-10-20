import test from "node:test";
import assert from "node:assert/strict";
import { dataFilesToRemove } from "../../scripts/data/data-core.mjs";
test("data retention keeps current and previous hash versions and never removes user assets", () => {
  const m = {
    datasets: [{ path: "data/bars-2026-09-aaaaaaaaaaaa.json" }],
    meta: { calendar: { path: "data/calendar-bbbbbbbbbbbb.json" } },
  };
  const previous = {
    datasets: [{ path: "data/bars-2026-09-cccccccccccc.json" }],
  };
  assert.deepEqual(
    dataFilesToRemove(
      [
        "bars-2026-09-aaaaaaaaaaaa.json",
        "bars-2026-09-cccccccccccc.json",
        "bars-2026-09.json",
        "themes.seed.json",
        "custom.json",
      ],
      m,
      previous,
    ),
    ["bars-2026-09.json"],
  );
});
