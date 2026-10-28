export const START = "2026-09-01";
export const numberString = (x) =>
  x == null ||
  String(x).trim() === "" ||
  /^(-+|除權|除息|NaN|N\/A)$/.test(String(x).trim())
    ? null
    : String(x).replaceAll(",", "").replace(/\s/g, "");
export function isoDate(x) {
  const s = String(x).replaceAll("/", "").replaceAll("-", "");
  if (/^\d{7}$/.test(s))
    return `${Number(s.slice(0, 3)) + 1911}-${s.slice(3, 5)}-${s.slice(5, 7)}`;
  if (/^\d{8}$/.test(s))
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return null;
}
const allowed = (code) =>
  /^\d{4}$/.test(code) || /^00[0-9A-Z]{3,4}$/.test(code);
export const productType = (code) =>
  code.startsWith("00")
    ? code.endsWith("B")
      ? "bond-etf"
      : "etf"
    : code.startsWith("91")
      ? "tdr"
      : "stock";
function parse(raw, date, market) {
  if (date < START) throw Error("Before data start");
  if (raw.date && isoDate(raw.date) !== date)
    throw Error("Response date mismatch");
  const table = raw.tables?.find(
    (t) =>
      (t.fields ?? []).includes(market === "twse" ? "證券代號" : "代號") &&
      (t.fields ?? []).some((x) => x === "收盤價" || x === "收盤"),
  );
  if (!table)
    return {
      market,
      date,
      bars: [],
      securities: [],
      caps: [],
      indices: [],
      empty: true,
    };
  const f = table.fields;
  const rows = table.data ?? [],
    bars = [],
    securities = [],
    caps = [];
  for (const r of rows) {
    const get = (...names) => r[f.findIndex((x) => names.includes(x))];
    const code = String(get("證券代號", "代號"));
    if (!allowed(code)) continue;
    const close = numberString(get("收盤價", "收盤")),
      name = String(get("證券名稱", "名稱"));
    if (close !== null && !/^\d+(\.\d+)?$/.test(close)) continue;
    const b = {
      code,
      market,
      date,
      open: numberString(get("開盤價", "開盤")),
      high: numberString(get("最高價", "最高")),
      low: numberString(get("最低價", "最低")),
      close,
      volumeShares: numberString(get("成交股數")) ?? "0",
      turnoverTwd: numberString(get("成交金額", "成交金額(元)")) ?? "0",
      quality: close ? "valid" : "no-trade",
      sourceVersion: `${market}:${date}`,
    };
    bars.push(b);
    securities.push({ code, name, market, productType: productType(code) });
    const shares = numberString(get("發行股數"));
    if (shares && close)
      caps.push({
        code,
        date,
        marketCap: String(Number(shares) * Number(close)),
        sourceId: "tpex-daily-shares",
      });
  }
  const indices = [];
  if (market === "twse")
    for (const t of raw.tables ?? []) {
      if (!String(t.title ?? "").includes("價格指數")) continue;
      for (const r of t.data ?? []) {
        if (r[0] === "發行量加權股價指數")
          indices.push({
            code: "TAIEX",
            name: "加權指數",
            date,
            close: numberString(r[1]),
          });
        else if (/類指數$/.test(r[0]) && !r[0].includes("報酬"))
          indices.push({
            code: "IND:" + r[0],
            name: r[0],
            date,
            close: numberString(r[1]),
          });
      }
    }
  return { market, date, bars, securities, caps, indices };
}
export const normalizeTwse = (raw, date) => parse(raw, date, "twse");
export const normalizeTpex = (raw, date) => parse(raw, date, "tpex");
// Latest snapshot has its own ROC Date; never relabel a stale snapshot as today.
export function normalizeTpexSnapshot(raw,end){
 if(!Array.isArray(raw)||!raw.length)throw Error('TPEx snapshot is empty or invalid');
 const dates=[...new Set(raw.map(r=>isoDate(String(r.Date??'').trim())))];
 const date=dates[0];
 if(dates.length!==1||!date||date<START||date>end||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('TPEx snapshot date invalid');
 const numeric=(v,{optional=false}={})=>{
  const n=numberString(v);
  if(n===null&&optional)return null;
  if(n===null||!/^\d+(\.\d+)?$/.test(n))throw Error('TPEx snapshot number invalid');
  return n;
 };
 const rows=raw.filter(r=>allowed(String(r.SecuritiesCompanyCode??'').trim()));
 if(!rows.length)throw Error('TPEx snapshot contains no supported securities');
 const seen=new Set();
 const data=rows.map(r=>{
  const code=String(r.SecuritiesCompanyCode).trim();if(seen.has(code))throw Error('Duplicate TPEx security');seen.add(code);
  const close=numeric(r.Close,{optional:true});if(close!==null&&Number(close)<=0)throw Error('Invalid TPEx close');
  return [code,String(r.CompanyName??'').trim(),close,numeric(r.Open,{optional:true}),numeric(r.High,{optional:true}),numeric(r.Low,{optional:true}),numeric(r.TradingShares),numeric(r.TransactionAmount)];
 });
 const result=normalizeTpex({date:date.replaceAll('-',''),tables:[{fields:['代號','名稱','收盤','開盤','最高','最低','成交股數','成交金額(元)'],data}]},date);
 result.bars=result.bars.map(bar=>({...bar,sourceId:'tpex-mainboard-quotes'}));
 return result;
}
export function mergeDaily(previous, updates) {
  const out = structuredClone(previous);
  out.bars ??= [];
  out.securities ??= [];
  out.caps ??= [];
  out.indexRows ??= [];
  out.warnings = [];
  for (const u of updates) {
    if (u.error) {
      out.warnings.push(`${u.market} ${u.date ?? ""}: ${u.error}`);
      continue;
    }
    if (u.empty) continue;
    const barKeys = new Set((u.bars ?? []).map((x) => x.code + ":" + x.date));
    out.bars = out.bars
      .filter((x) => !barKeys.has(x.code + ":" + x.date))
      .concat(u.bars ?? []);
    const securities = new Map(out.securities.map((s) => [s.code, s]));
    for (const s of u.securities ?? [])
      securities.set(s.code, { ...securities.get(s.code), ...s });
    out.securities = [...securities.values()];
    const capKeys = new Set((u.caps ?? []).map(x => x.code + ":" + x.date));
    out.caps = out.caps
      .filter((x) => !capKeys.has(x.code + ":" + x.date))
      .concat(u.caps ?? []);
    out.indexRows.push(...(u.indices ?? []));
  }
  out.coverage = out.warnings.length ? "partial" : "complete";
  return out;
}
export function checkSize(bytes) {
  return { ok: bytes <= 1024 ** 3, warning: bytes >= 500 * 1024 ** 2, bytes };
}
export function normalizeIndexHistory(raw, code, name) {
  const table = raw.tables?.find((t) => t.fields?.includes("日期"));
  if (!table) return [];
  return (table.data ?? [])
    .map((r) => ({
      code,
      name,
      date: isoDate(r[0]),
      open: numberString(r[1]),
      high: numberString(r[2]),
      low: numberString(r[3]),
      close: numberString(r[4]),
    }))
    .filter((r) => r.date >= START && r.close);
}
export function dataFilesToRemove(files, manifest, previous = {}) {
  const refs = (x) => [
    ...(x.datasets ?? []).map((d) => d.path),
    ...Object.values(x.meta ?? {}).map((d) => d.path),
  ];
  const keep = new Set(
    [...refs(manifest), ...refs(previous)].map((p) => p.split("/").at(-1)),
  );
  return files.filter(
    (f) =>
      /^(?:(?:bars|caps)-\d{4}-\d{2}|calendar|events|index-rows|securities)(?:-[0-9a-f]{12})?\.json$/.test(
        f,
      ) && !keep.has(f),
  );
}
