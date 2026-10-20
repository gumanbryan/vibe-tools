const key = (b) => b.code + ":" + b.date;
const signature = (b) =>
  JSON.stringify(
    b
      ? {
          close: b.close,
          open: b.open ?? null,
          high: b.high ?? null,
          low: b.low ?? null,
          quality: b.quality ?? null,
        }
      : null,
  );
export function captureMarketHistory(book, market) {
  const codes = new Set(
    [
      ...book.openingPositions,
      ...book.trades,
      ...book.confirmations,
      ...(book.benchmarks ?? []).map((code) => ({ code })),
    ].map((x) => x.code),
  );
  const through = market.asOf;
  return {
    through,
    start: book.openingDate,
    bars: market.bars
      .filter(
        (b) =>
          codes.has(b.code) && b.date >= book.openingDate && b.date <= through,
      )
      .map((b) => ({ ...b })),
    codes: [...codes],
    indices: (market.indices ?? [])
      .filter((i) => ["TAIEX", "TPEX"].includes(i.code))
      .map((i) => ({
        ...i,
        bars: i.bars
          .filter((b) => b.date >= book.openingDate && b.date <= through)
          .map((b) => ({ ...b })),
      })),
    sourceVersions:
      market.manifest?.datasets?.map((d) => ({
        path: d.path,
        version: d.version,
      })) ?? [],
  };
}
export function compareMarketHistory(history, market) {
  if (!history) return [];
  const incoming = new Map(market.bars.map((b) => [key(b), b])),
    previous = new Map(history.bars.map((b) => [key(b), b])),
    diff = [];
  for (const b of history.bars) {
    const now = incoming.get(key(b));
    if (signature(now) !== signature(b))
      diff.push({
        code: b.code,
        date: b.date,
        before: b.close,
        after: now?.close ?? null,
        kind: "price",
      });
  }
  for (const b of market.bars)
    if (
      history.codes.includes(b.code) &&
      b.date >= history.start &&
      b.date <= history.through &&
      !previous.has(key(b))
    )
      diff.push({
        code: b.code,
        date: b.date,
        before: null,
        after: b.close,
        kind: "new-historical-price",
      });
  for (const old of history.indices ?? []) {
    const now = market.indices.find((i) => i.code === old.code);
    const oldDates = new Set(old.bars.map((b) => b.date));
    for (const b of now?.bars ?? [])
      if (
        b.date >= history.start &&
        b.date <= history.through &&
        !oldDates.has(b.date)
      )
        diff.push({
          code: old.code,
          date: b.date,
          before: null,
          after: b.close,
          kind: "new-historical-index",
        });
    for (const b of old.bars) {
      const n = now?.bars.find((x) => x.date === b.date);
      if (signature(n) !== signature(b))
        diff.push({
          code: old.code,
          date: b.date,
          before: b.close,
          after: n?.close ?? null,
          kind: "index",
        });
    }
  }
  return diff;
}
export function useLockedMarket(history, incoming) {
  if (!history) return incoming;
  const oldKeys = new Set(history.bars.map(key));
  const bars = incoming.bars.filter(
    (b) =>
      !(
        history.codes.includes(b.code) &&
        b.date >= history.start &&
        b.date <= history.through
      ),
  );
  bars.push(...history.bars.map((b) => ({ ...b })));
  const indices = incoming.indices.map((i) => {
    const old = history.indices.find((x) => x.code === i.code);
    return old
      ? {
          ...i,
          bars: [
            ...old.bars,
            ...i.bars.filter((b) => b.date > history.through),
          ],
        }
      : i;
  });
  return { ...incoming, bars, indices, historyCorrectionPending: true };
}
