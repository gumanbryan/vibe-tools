import { ok, err } from "./result.js";
export function addBusinessDays(date, n, calendar) {
  const dates = [...new Set(calendar.businessDates)].sort();
  const i = dates.indexOf(date);
  if (i < 0 || i + n < 0 || i + n >= dates.length)
    return err("CALENDAR_COVERAGE", "交割日曆尚未涵蓋此日期");
  return ok(dates[i + n]);
}
export function datesBetween(from, to) {
  const out = [];
  for (
    let d = new Date(from + "T00:00:00Z");
    d.toISOString().slice(0, 10) <= to;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
    if (out.length > 20000) throw Error("日期範圍過大");
  }
  return out;
}
export const taipeiToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
