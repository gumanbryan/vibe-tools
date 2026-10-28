import {latestMarketDates} from './freshness.js';
import {applyCalendarClosures} from "./calendar-closures.js";
export async function verifyIntegrity(text, expected) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  const actual = [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  if (actual !== expected)
    throw Error("資料檢查碼不符，請重新整理；本機帳本未變更");
  return JSON.parse(text);
}
export async function loadMarket(base = "./") {
  const get = async (path, version) => {
    const r = await fetch(new URL(path, new URL(base, location.href)));
    if (!r.ok) throw Error(`${path} HTTP ${r.status}`);
    const text = await r.text();
    return version ? verifyIntegrity(text, version) : JSON.parse(text);
  };
  const manifest = await get("data/manifest.json");
  const market = {
    bars: [],
    caps: [],
    manifest,
    asOf: manifest.asOf,
    coverage: manifest.coverage,
    warnings: manifest.warnings ?? [],
  };
  const loaded = await Promise.all(
    manifest.datasets.map(async (d) => ({
      d,
      rows: await get(d.path, d.version),
    })),
  );
  for (const { d, rows } of loaded) {
    if (d.kind === "bars") market.bars.push(...rows);
    if (d.kind === "caps") market.caps.push(...rows);
  }
  [market.securities, market.events, market.calendar] = await Promise.all(
    ["securities", "events", "calendar"].map((k) =>
      get(
        manifest.meta?.[k]?.path ?? "data/" + k + ".json",
        manifest.meta?.[k]?.version,
      ),
    ),
  );
  market.marketAsOf=latestMarketDates(market.bars);
  market.calendar=applyCalendarClosures(market.calendar);
  const rows = await get(
    manifest.meta?.indices?.path ?? "data/index-rows.json",
    manifest.meta?.indices?.version,
  );
  market.indices = [...new Set(rows.map((x) => x.code))].map((code) => ({
    code,
    name: rows.find((x) => x.code === code).name,
    bars: rows
      .filter((x) => x.code === code)
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));
  return market;
}
