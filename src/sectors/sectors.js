import { dec, sum } from "../domain/money.js";
import { ok, err } from "../domain/result.js";
const indexes = new WeakMap();
function barIndex(bars) {
  if (!indexes.has(bars))
    indexes.set(bars, new Map(bars.map((b) => [b.code + ":" + b.date, b])));
  return indexes.get(bars);
}
const capIndexes = new WeakMap();
function capAt(caps, code, date) {
  if (!caps) return null;
  if (!capIndexes.has(caps)) capIndexes.set(caps, new Map(caps.map(c => [c.code + ":" + c.date, c])));
  return capIndexes.get(caps).get(code + ":" + date);
}
export function constituentsAt(theme, date) {
  return (theme.members ?? []).filter(
    (x) =>
      (x.from ?? "2026-09-01") <= date &&
      (!x.to || date < x.to) &&
      x.included !== false &&
      x.relation !== "extended",
  );
}
export function periodThemeReturn(theme, market, date, n, weighting = "equal") {
  const ds = market.calendar.businessDates.filter((d) => d <= date).sort();
  const end = ds.at(-1),
    start = ds.at(-1 - n);
  if (!start) return err("INSUFFICIENT_HISTORY", "歷史資料不足");
  const members = constituentsAt(theme, end),
    valid = [];
  for (const member of members) {
    const a = barIndex(market.bars).get(member.code + ":" + start),
      b = barIndex(market.bars).get(member.code + ":" + end);
    if (
      !a?.close ||
      !b?.close ||
      a.quality === "missing" ||
      b.quality === "missing"
    )
      continue;
    const cap = weighting === "cap" ? capAt(market.caps, member.code, start) : null;
    if (weighting === "cap" && (!cap || dec(cap.marketCap).lte(0)))
      return err("CAP_HISTORY_MISSING", "缺少區間起點市值");
    valid.push({
      code: member.code,
      return: dec(b.close).div(a.close).minus(1).toString(),
      weight: weighting === "cap" ? cap.marketCap : "1",
    });
  }
  if (!valid.length) return err("NO_VALID_MEMBERS", "沒有足夠的有效成分股");
  const denom = sum(valid.map((x) => x.weight));
  const result = sum(valid.map((x) => dec(x.return).mul(x.weight))).div(denom);
  return ok(
    {
      return: result.toString(),
      coverage: { valid: valid.length, total: members.length },
      version: theme.version ?? "1",
      start,
      end,
      members: valid,
    },
    valid.length < members.length ? ["部分成分缺少價格"] : [],
  );
}
export function chainThemeIndex(theme, market, from, to, weighting = "equal") {
  const ds = market.calendar.businessDates
    .filter((d) => d >= from && d <= to)
    .sort();
  let value = dec(100);
  const out = [];
  for (let i = 0; i < ds.length; i++) {
    if (i) {
      const r = periodThemeReturn(theme, market, ds[i], 1, weighting);
      if (!r.ok) return r;
      value = value.mul(dec(1).plus(r.value.return));
    }
    out.push({ date: ds[i], value: value.toString(), method: "daily-chain" });
  }
  return ok(out);
}
export function themeActivity(theme, market, date) {
  const stockCodes=new Set(market.securities.filter(s=>s.productType==='stock').map(s=>s.code));
  const codes=[...new Set(constituentsAt(theme,date).map(x=>x.code))].filter(c=>stockCodes.has(c));
  const index=barIndex(market.bars);
  const amount=(code,d)=>{const b=index.get(code+':'+d);return b&&b.quality!=='missing'&&b.turnoverTwd!=null&&b.turnoverTwd!==''&&Number.isFinite(Number(b.turnoverTwd))&&Number(b.turnoverTwd)>=0?b.turnoverTwd:null;};
  const prior=[...new Set(market.calendar.businessDates)].filter(d=>d<date).sort().slice(-20);
  const comparable=prior.length===20?codes.filter(c=>[...prior,date].every(d=>amount(c,d)!=null)):[];
  const today=sum(comparable.map(c=>amount(c,date)));
  const avg=comparable.length?sum(prior.map(d=>sum(comparable.map(c=>amount(c,d))))).div(20):null;
  const turnover=sum(codes.map(c=>amount(c,date)??0)),total=sum([...stockCodes].map(c=>amount(c,date)??0));
  return ok({turnover:turnover.toString(),share:total.gt(0)?turnover.div(total).toString():null,
    volumeRatio:avg?.gt(0)?today.div(avg).toString():null,volumeMembers:comparable.length,totalMembers:codes.length,
    overlapping:true,coverage:market.coverage??'partial'});
}
export function rankThemes(themes, market, date, n, weighting) {
  return themes
    .map((theme) => {
      const r = periodThemeReturn(theme, market, date, n, weighting);
      return {
        id: theme.id,
        name: theme.name,
        ...(r.ok ? r.value : { return: null, error: r.errors[0].message }),
      };
    })
    .sort((a, b) =>
      a.return == null
        ? 1
        : b.return == null
          ? -1
          : Number(b.return) - Number(a.return),
    )
    .map((x, i) => ({ ...x, rank: x.return == null ? null : i + 1 }));
}
