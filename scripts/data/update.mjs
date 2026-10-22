import {buildBusinessCalendar} from "./calendar.mjs";
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  readdir,
  unlink,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  normalizeTwse,
  normalizeIndexHistory,
  dataFilesToRemove,
  normalizeTpex,
  mergeDaily,
  isoDate,
  numberString,
  START,
} from "./data-core.mjs";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
async function json(url, cache) {
  if (cache) {
    try {
      return JSON.parse(await readFile(cache, "utf8"));
    } catch {}
  }
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (cache) {
    await mkdir(".tmp/history", { recursive: true });
    await writeFile(cache, JSON.stringify(j));
  }
  return j;
}
function days(from, to) {
  const out = [];
  for (
    let d = new Date(from + "T00:00:00Z");
    d.toISOString().slice(0, 10) <= to;
    d.setUTCDate(d.getUTCDate() + 1)
  )
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6)
      out.push(d.toISOString().slice(0, 10));
  return out;
}
export async function updatePublicData({ end = today(), start = START } = {}) {
  if (start < START) throw Error("Cannot fetch before 2026-09-01");
  await mkdir("public/data", { recursive: true });
  let previousManifest = {};
  let old = {
    bars: [],
    caps: [],
    securities: [],
    indexRows: [],
    events: [],
    warnings: [],
  };
  try {
    const m = JSON.parse(await readFile("public/data/manifest.json", "utf8"));
    previousManifest = m;
    for (const d of m.datasets) {
      const rows = JSON.parse(await readFile("public/" + d.path, "utf8"));
      if (d.kind === "bars") old.bars.push(...rows);
      else if (d.kind === "caps") old.caps.push(...rows);
    }
    old.securities = JSON.parse(
      await readFile(
        "public/" + (m.meta?.securities?.path ?? "data/securities.json"),
        "utf8",
      ),
    );
    old.indexRows = JSON.parse(
      await readFile(
        "public/" + (m.meta?.indices?.path ?? "data/index-rows.json"),
        "utf8",
      ),
    );
    old.events = JSON.parse(
      await readFile(
        "public/" + (m.meta?.events?.path ?? "data/events.json"),
        "utf8",
      ),
    );
  } catch {}
  const updates = [],
    sourceStates = [];
  const tasks = [];
  const existing = new Set(old.bars.map((b) => b.market + ":" + b.date));
  for (const date of days(start, end))
    for (const market of ["twse", "tpex"])
      if (!existing.has(market + ":" + date) || date >= days(start, end).at(-3))
        tasks.push({ date, market });
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor++],
        { date, market } = task,
        compact = date.replaceAll("-", "");
      const url =
        market === "twse"
          ? `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=${compact}&type=ALLBUT0999&response=json`
          : `https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${date.replaceAll("-", "/")}&id=&response=json`;
      try {
        const raw = await json(url, `.tmp/history/${market}-${compact}.json`);
        const normalized =
          market === "twse"
            ? normalizeTwse(raw, date)
            : normalizeTpex(raw, date);
        if (!normalized.empty && normalized.bars.length && market === "twse") {
          try {
            const shares = await json(
              `https://www.twse.com.tw/fund/MI_QFIIS?date=${compact}&selectType=ALLBUT0999&response=json`,
              `.tmp/history/shares-${compact}.json`,
            );
            const f = shares.fields ?? [],
              ci = f.indexOf("證券代號"),
              si = f.indexOf("發行股數");
            const map = new Map(
              (shares.data ?? []).map((r) => [r[ci], numberString(r[si])]),
            );
            for (const b of normalized.bars) {
              const n = map.get(b.code);
              if (n && b.close)
                normalized.caps.push({
                  code: b.code,
                  date,
                  marketCap: String(Number(n) * Number(b.close)),
                  sourceId: "twse-historical-issued-shares",
                });
            }
          } catch (e) {
            sourceStates.push({
              sourceId: "twse-shares",
              date,
              status: "partial",
              reason: e.message,
            });
          }
        }
        updates.push(normalized);
      } catch (e) {
        updates.push({ market, date, error: e.message });
      }
      if (cursor % 10 === 0) console.log("Fetched", cursor, "/", tasks.length);
    }
  }
  await Promise.all([worker(), worker()]);
  const out = mergeDaily(old, updates);
  const extra = [
    ["twse-companies", "https://openapi.twse.com.tw/v1/opendata/t187ap03_L"],
    ["tpex-companies", "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O"],
    ["dividends", "https://openapi.twse.com.tw/v1/exchangeReport/TWT48U_ALL"],
    ["meetings", "https://openapi.twse.com.tw/v1/opendata/t187ap38_L"],
    ["material", "https://openapi.twse.com.tw/v1/opendata/t187ap04_L"],
    [
      "holiday",
      "https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule",
    ],
  ];
  for (const [id, url] of extra) {
    try {
      const rows = await json(url);
      sourceStates.push({
        sourceId: id,
        status: "available",
        rows: rows.length,
        checkedAt: new Date().toISOString(),
        url,
      });
      if (id.endsWith("companies"))
        for (const c of rows) {
          const code = c["公司代號"] ?? c.SecuritiesCompanyCode;
          const s = out.securities.find((s) => s.code === code);
          if (s) {
            const industry = c["產業別"] ?? c.SecuritiesIndustryCode ?? c.Industry;
            if (industry != null && String(industry).trim()) s.industry = String(industry).trim().padStart(2, "0");
            s.companySource = url;
          }
        }
      if (id === "dividends")
        for (const r of rows) {
          const code = r.Code ?? r["股票代號"] ?? r["公司代號"];
          const date = isoDate(r.Date ?? r["除權息日期"] ?? r["除權息交易日"]);
          if (!code || !date) continue;
          const amount = numberString(r.CashDividend ?? r["現金股利"]);
          const rawKind = r.Exdividend ?? r["權息別"];
          out.events.push({
            id: `${code}:${date}:dividend`,
            code,
            kind: amount ? "cash-dividend" : "ex-dividend-notice",
            title: "除權息公告（請核對配發金額）",
            date,
            exDate: date,
            perShare: amount,
            paymentDate: null,
            sourceUrl: url,
            version: String(r.ReportDate ?? end),
          });
        }
      if (id === "meetings")
        for (const r of rows) {
          const code = r["公司代號"] ?? r.CompanyCode;
          const date = isoDate(
            r["股東常(臨時)會日期-日期"] ??
              r["股東會日期"] ??
              r["開會日期"] ??
              r.MeetingDate,
          );
          if (code && date)
            out.events.push({
              id: code + ":meeting:" + date,
              code,
              kind: "meeting",
              title: "股東會",
              date,
              sourceUrl: url,
              version: end,
            });
        }
      if (id === "material")
        for (const r of rows) {
          const code = r["公司代號"] ?? r.CompanyCode,
            title = r["主旨"] ?? r.Subject ?? "";
          if (code && /法說|法人說明/.test(title))
            out.events.push({
              id: code + ":conference:" + String(r["發言日期"] ?? end),
              code,
              kind: "conference",
              title,
              date: null,
              announcedAt: isoDate(r["發言日期"]),
              sourceUrl: url,
              version: end,
            });
        }
      if (id === "holiday") out.holidayRows = rows;
    } catch (e) {
      sourceStates.push({
        sourceId: id,
        status: "unavailable",
        reason: e.message,
      });
    }
  }
  for (const month of [
    ...new Set(days(start, end).map((d) => d.slice(0, 7))),
  ]) {
    try {
      const raw = await json(
        `https://www.twse.com.tw/indicesReport/MI_5MINS_HIST?date=${month.replace("-", "")}01&response=json`,
      );
      for (const r of raw.data ?? [])
        out.indexRows.push({
          code: "TAIEX",
          name: "加權指數",
          date: isoDate(r[0]),
          open: numberString(r[1]),
          high: numberString(r[2]),
          low: numberString(r[3]),
          close: numberString(r[4]),
        });
    } catch (e) {
      out.warnings.push("加權OHLC:" + e.message);
    }
  }
  for (const month of [
    ...new Set(days(start, end).map((d) => d.slice(0, 7))),
  ]) {
    try {
      const raw = await json(
        `https://www.tpex.org.tw/www/zh-tw/indexInfo/inx?date=${month.replace("-", "/")}%2F01&response=json`,
      );
      out.indexRows.push(...normalizeIndexHistory(raw, "TPEX", "櫃買指數"));
    } catch (e) {
      out.warnings.push("櫃買月資料:" + month + ":" + e.message);
    }
  }
  try {
    const rows = await json("https://www.tpex.org.tw/openapi/v1/tpex_index");
    for (const r of rows)
      out.indexRows.push({
        code: "TPEX",
        name: "櫃買指數",
        date: isoDate(r.Date),
        open: r.Open,
        high: r.High,
        low: r.Low,
        close: r.Close,
      });
  } catch (e) {
    out.warnings.push("櫃買指數:" + e.message);
  }
  const dedupe = (xs, key) => [...new Map(xs.map((x) => [key(x), x])).values()];
  out.bars = dedupe(out.bars, (b) => b.code + ":" + b.date)
    .filter((b) => b.date >= START)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code),
    );
  out.caps = dedupe(out.caps, (b) => b.code + ":" + b.date);
  out.indexRows = dedupe(
    out.indexRows.filter((x) => x.date >= START && x.date <= end),
    (x) => x.code + ":" + x.date,
  );
  out.events = dedupe(out.events, (e) => e.id).map((e) => ({
    ...e,
    version: createHash("sha256")
      .update(
        JSON.stringify({
          id: e.id,
          kind: e.kind,
          date: e.date,
          exDate: e.exDate,
          perShare: e.perShare,
          ratio: e.ratio,
          paymentDate: e.paymentDate,
          title: e.title,
        }),
      )
      .digest("hex")
      .slice(0, 16),
  }));
  const tradingDates = [...new Set(out.bars.map((b) => b.date))].sort();
  out.asOf = tradingDates.at(-1) ?? null;
  out.calendar=buildBusinessCalendar(tradingDates,end,out.holidayRows);
  const manifest = {
    schemaVersion: 1,
    startDate: START,
    generatedAt: new Date().toISOString(),
    asOf: out.asOf,
    coverage: out.warnings.length ? "partial" : "complete",
    warnings: out.warnings,
    sources: sourceStates,
    datasets: [],
    attribution: "資料來源：臺灣證券交易所、證券櫃檯買賣中心；請核對官方公告。",
  };
  const atomic = async (path, data) => {
    const s = JSON.stringify(data),
      version = createHash("sha256").update(s).digest("hex");
    const target = path.endsWith("/manifest.json")
      ? path
      : path.replace(".json", "-" + version.slice(0, 12) + ".json");
    await writeFile(target + ".tmp", s);
    await rename(target + ".tmp", target);
    return {
      path: target.replace(/^public\//, ""),
      version,
      bytes: Buffer.byteLength(s),
    };
  };
  for (const kind of ["bars", "caps"])
    for (const month of [
      ...new Set(out[kind].map((x) => x.date.slice(0, 7))),
    ]) {
      const path = `data/${kind}-${month}.json`,
        rows = out[kind].filter((x) => x.date.startsWith(month));
      const meta = await atomic("public/" + path, rows);
      manifest.datasets.push({
        kind,
        path,
        asOf: rows
          .map((x) => x.date)
          .sort()
          .at(-1),
        ...meta,
      });
    }
  manifest.meta = {
    securities: await atomic("public/data/securities.json", out.securities),
    events: await atomic("public/data/events.json", out.events),
    indices: await atomic("public/data/index-rows.json", out.indexRows),
    calendar: await atomic("public/data/calendar.json", out.calendar),
  };
  await atomic("public/data/manifest.json", manifest);
  for (const file of dataFilesToRemove(
    await readdir("public/data"),
    manifest,
    previousManifest,
  ))
    await unlink("public/data/" + file);
  console.log(
    JSON.stringify({
      bars: out.bars.length,
      caps: out.caps.length,
      securities: out.securities.length,
      asOf: out.asOf,
      warnings: out.warnings.length,
    }),
  );
  return out;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await updatePublicData();
