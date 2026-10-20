import test from "node:test";
import assert from "node:assert/strict";
import {
  movingAverage,
  buildMarketSummary,
} from "../../src/summary/summary.js";
test("insufficient MA does not fabricate history", () => {
  assert.equal(
    movingAverage([{ date: "2026-09-01", close: "10" }], 5).value[0].value,
    null,
  );
});
test("summary gives sources and does not infer money inflow or news causes", () => {
  const r = buildMarketSummary(
    { asOf: "2026-09-03", coverage: "partial", indices: [], bars: [] },
    [
      {
        name: "PCB",
        returns: { 1: "0.02" },
        relative5: "0.01",
        previousRelative5: "-0.01",
        rankImproved: true,
        volumeRatio: "1.3",
        shareAboveAverage: true,
      },
    ],
    "2026-09-03",
    {},
  ).value;
  assert.equal(r.quality, "estimated");
  assert.equal(
    r.sentences.every((x) => x.evidenceIds.length > 0),
    true,
  );
  assert.equal(
    r.sentences.some((x) => /資金淨流入|新聞導致/.test(x.text)),
    false,
  );
});
test("main market summary prioritizes broad indices instead of flooding sector index rows", () => {
  const bars = [
    { date: "2026-09-01", close: "100" },
    { date: "2026-09-02", close: "101" },
  ];
  const r = buildMarketSummary(
    {
      coverage: "complete",
      indices: [
        { code: "TAIEX", name: "加權指數", bars },
        { code: "IND:水泥", name: "水泥類指數", bars },
      ],
    },
    [],
    "2026-09-02",
    {},
  ).value;
  assert.equal(
    r.sentences.some((x) => x.text.includes("水泥")),
    false,
  );
});
