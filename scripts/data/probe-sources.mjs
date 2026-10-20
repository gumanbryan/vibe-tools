import { writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export function validateSourceReport(report) {
  const errors = [];
  if (!Array.isArray(report.sources) || !report.sources.length)
    errors.push("No sources");
  for (const s of report.sources || []) {
    if (!["verified", "partial", "unavailable"].includes(s.status))
      errors.push("Invalid status");
    if (
      s.status === "verified" &&
      (!s.url || !s.checkedAt || !s.evidence || !s.termsUrl)
    )
      errors.push("Verified source requires evidence and terms");
    if (s.status !== "verified" && !s.reason)
      errors.push("Incomplete source requires reason");
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: report, warnings: [] };
}
export const candidates = [
  {
    sourceId: "twse",
    kind: "prices",
    url: "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
  },
  {
    sourceId: "tpex",
    kind: "prices",
    url: "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes",
  },
  {
    sourceId: "indices",
    kind: "indices",
    url: "https://openapi.twse.com.tw/v1/indicesReport/MI_5MINS_HIST",
  },
  {
    sourceId: "events",
    kind: "events",
    url: "https://openapi.twse.com.tw/v1/exchangeReport/TWT48U_ALL",
  },
  {
    sourceId: "capitalization",
    kind: "capitalization",
    url: "https://openapi.twse.com.tw/v1/opendata/t187ap03_L",
  },
  {
    sourceId: "calendar",
    kind: "calendar",
    url: "https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule",
  },
];
export async function probeSources() {
  const sources = await Promise.all(
    candidates.map(async (s) => {
      try {
        const r = await fetch(s.url, { signal: AbortSignal.timeout(25000) });
        if (!r.ok) throw Error(`HTTP ${r.status}`);
        const rows = await r.json();
        return {
          ...s,
          status: "partial",
          checkedAt: new Date().toISOString(),
          evidence: {
            rows: Array.isArray(rows) ? rows.length : null,
            fields: Object.keys(rows[0] || {}),
          },
          reason:
            "Endpoint reached; history coverage, redistribution terms, and full field mapping require separate verification",
        };
      } catch (e) {
        return {
          ...s,
          status: "unavailable",
          checkedAt: new Date().toISOString(),
          reason: e.message,
        };
      }
    }),
  );
  return {
    checkedAt: new Date().toISOString(),
    startDate: "2026-09-01",
    sources,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = await probeSources();
  await mkdir("docs/data", { recursive: true });
  await writeFile(
    "docs/data/source-probe.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    report.sources
      .map(
        (s) => `${s.sourceId}: ${s.status} (${s.evidence?.rows ?? "no"} rows)`,
      )
      .join("\n"),
  );
}
