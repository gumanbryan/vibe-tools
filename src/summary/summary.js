import { dec, sum } from "../domain/money.js";
import { ok } from "../domain/result.js";
export function movingAverage(bars, n) {
  return ok(
    bars.map((b, i) => ({
      date: b.date,
      value:
        i < n - 1 || bars.slice(i + 1 - n, i + 1).some((x) => !x.close)
          ? null
          : sum(bars.slice(i + 1 - n, i + 1).map((x) => x.close))
              .div(n)
              .toString(),
    })),
  );
}
const pct = (x) => (Number(x) * 100).toFixed(2) + "%";
export function buildMarketSummary(market, themeMetrics, date, settings = {}) {
  const sentences = [],
    evidence = {};
  let quality = market.coverage === "complete" ? "complete" : "estimated";
  const add = (id, text, values) => {
    evidence[id] = values;
    sentences.push({ text, evidenceIds: [id] });
  };
  for (const index of (market.indices ?? []).filter((i) =>
    ["TAIEX", "TPEX"].includes(i.code),
  )) {
    const bars = index.bars
      .filter((x) => x.date <= date)
      .sort((a, b) => a.date.localeCompare(b.date));
    const last = bars.at(-1),
      prev = bars.at(-2);
    if (!last || !prev) continue;
    const change = dec(last.close).div(prev.close).minus(1);
    const ma = movingAverage(bars, 20).value.at(-1).value;
    add(
      index.code,
      `${index.name} ${last.date} ${change.gte(0) ? "上漲" : "下跌"} ${pct(change.abs())}${ma ? `，收盤位於20日均線${dec(last.close).gte(ma) ? "上方" : "下方"}` : "，20日均線資料尚不足"}。`,
      { date: last.date, change: change.toString(), ma20: ma },
    );
  }
  const leaders = themeMetrics
    .filter((x) => x.returns?.[1] != null)
    .sort((a, b) => Number(b.returns[1]) - Number(a.returns[1]))
    .slice(0, 3);
  for (const t of leaders) {
    add(
      "theme:" + t.id,
      `${t.name}近1日成分平均報酬 ${pct(t.returns[1])}${t.returns[5] != null ? `，近5日 ${pct(t.returns[5])}` : ""}。`,
      t,
    );
  }
  for (const t of themeMetrics) {
    if (
      Number(t.relative5) > 0 &&
      t.previousRelative5 != null &&
      Number(t.previousRelative5) <= 0 &&
      t.rankImproved
    )
      add("strength:" + t.id, `${t.name}近5日相對大盤由弱轉強，排名改善。`, t);
    if (
      t.shareAboveAverage &&
      Number(t.volumeRatio) >= (settings.volumeThreshold ?? 1.2)
    )
      add("volume:" + t.id, `${t.name}成交占比高於此前20日平均，成交升溫。`, t);
  }
  if (!sentences.length)
    add(
      "coverage",
      `截至${date}，可比較資料尚不足；補齊後顯示大盤與題材摘要。`,
      { date },
    );
  if (quality !== "complete")
    add("quality", "目前有資料覆蓋限制，摘要僅反映已取得的有效資料。", {
      coverage: market.coverage,
    });
  return ok({ sentences, evidence, quality });
}
