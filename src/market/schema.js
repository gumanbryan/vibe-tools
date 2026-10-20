import Decimal from "decimal.js";
import { ok, err } from "../domain/result.js";
export const START = "2026-09-01";
export function validDate(d) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(Date.parse(d + "T00:00:00Z")) &&
    new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d
  );
}
export function normalizeDataset(raw, spec) {
  try {
    const keys = new Set();
    const rows = raw.map((r) => {
      if (!validDate(r.date) || r.date < START)
        throw Error("Invalid date or earlier than 2026-09-01");
      const key = r.code + ":" + r.date;
      if (keys.has(key)) throw Error("Duplicate bar");
      keys.add(key);
      const value = (x) =>
        x == null || x === "" || x === "--"
          ? null
          : new Decimal(String(x).replaceAll(",", "")).toString();
      const close = value(r.close);
      if (close !== null && new Decimal(close).lte(0))
        throw Error("Nonpositive price");
      return {
        ...r,
        code: String(r.code),
        market: spec.market,
        close,
        open: value(r.open),
        high: value(r.high),
        low: value(r.low),
        volumeShares: new Decimal(value(r.volume) ?? 0)
          .mul(spec.volumeMultiplier ?? 1)
          .toString(),
        turnoverTwd: new Decimal(value(r.turnover) ?? 0)
          .mul(spec.turnoverMultiplier ?? 1)
          .toString(),
        quality: close ? "valid" : "missing",
        sourceVersion: spec.version,
      };
    });
    return ok({
      rows,
      sourceId: spec.sourceId,
      version: spec.version,
      asOf: rows.at(-1)?.date ?? null,
      status: "complete",
    });
  } catch (e) {
    return err("DATA_INVALID", e.message);
  }
}
export function validateManifest(m) {
  return m?.schemaVersion === 1 &&
    Array.isArray(m.datasets) &&
    m.datasets.every((x) => x.path && x.version && x.asOf)
    ? ok(m)
    : err("MANIFEST_INVALID", "Invalid manifest");
}
