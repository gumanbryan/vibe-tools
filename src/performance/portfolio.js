import { dec, D, sum } from "../domain/money.js";
import { ok, err } from "../domain/result.js";
import { datesBetween, addBusinessDays } from "../domain/calendar.js";
import { calculateFee, calculateTax, DEFAULT_PROFILE } from "../ledger/fees.js";
import {
  postTrade,
  settleTrade,
  replayEntries,
  entry,
  line,
} from "../ledger/journal.js";
import {
  accrueInterest,
  estimateMaintenance,
  creditFees,
} from "../credit/credit.js";
import { validateDayTrade } from "../ledger/allocations.js";
import { postCorporateEvent } from "../events/events.js";
export function applyCloseFlow({ equityBeforeFlow, previousUnits, flow }) {
  try {
    const e = dec(equityBeforeFlow),
      u = dec(previousUnits),
      c = dec(flow);
    if (c.lt(0) && (e.lte(0) || e.plus(c).lt(0)))
      throw Error("出金超過帳戶淨資產");
    if (u.isZero()) {
      if (e.isZero() && c.isZero())
        return ok({ equity: "0", units: "0", unitNav: null });
      if (e.lte(0) && c.lte(0))
        return ok({ equity: e.plus(c).toString(), units: "0", unitNav: null });
      return ok({
        equity: e.plus(c).toString(),
        units: e.plus(c).div(10).toString(),
        unitNav: "10",
      });
    }
    if (e.lte(0))
      return ok({
        equity: e.plus(c).toString(),
        units: "0",
        unitNav: null,
      });
    const p = e.div(u);
    return ok({
      equity: e.plus(c).toString(),
      units: u.plus(c.div(p)).toString(),
      unitNav: p.toString(),
    });
  } catch (e) {
    return err("FLOW_INVALID", e.message);
  }
}
export function latestPrice(market, code, date) {
  return (market.bars ?? [])
    .filter((x) => x.code === code && x.date <= date && x.close != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
}
function unwrap(r) {
  if (!r.ok) throw Error(r.errors.map((x) => x.message).join("；"));
  return r.value;
}
export function prepareTrades(book, date) {
  unwrap(
    validateDayTrade(
      book.trades,
      book.allocations.filter((a) =>
        ["cash-day", "cash-first", "credit-day"].includes(a.kind),
      ),
      book._securities ?? [],
    ),
  );
  const ts = book.trades
    .filter((t) => t.date <= date)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.sequence ?? 0) - (b.sequence ?? 0) ||
        a.id.localeCompare(b.id),
    );
  const group = new Map();
  for (const t of ts) {
    const key = [
      t.accountId,
      t.date,
      t.code,
      t.side,
      t.marketType,
      t.feeGroupId || t.id,
    ].join(":");
    group.set(key, [...(group.get(key) || []), t]);
  }
  const details = new Map();
  for (const items of group.values()) {
    const total = sum(items.map((t) => dec(t.qty).mul(t.price)));
    const first = items[0],
      profile =
        first.ruleSnapshot ??
        book.accounts.find((a) => a.id === first.accountId)?.profile ??
        DEFAULT_PROFILE;
    const fee = unwrap(
      calculateFee({
        gross: total.toString(),
        marketType: first.marketType,
        profile,
        actualGrossFee: first.actualGrossFee,
      }),
    );
    for (const t of items) {
      const gross = dec(t.qty).mul(t.price),
        ratio = total.isZero() ? dec(0) : gross.div(total);
      const matched = sum(
        book.allocations
          .filter(
            (a) =>
              ["cash-day", "cash-first"].includes(a.kind) &&
              (a.openTradeId === t.id || a.closeTradeId === t.id),
          )
          .map((a) => a.qty),
      );
      let security = book._securities?.find((s) => s.code === t.code) ?? {
        productType: t.productType ?? "stock",
        bondTaxExempt: t.bondTaxExempt,
      };
      if (t.bondTaxExempt !== undefined)
        security = { ...security, bondTaxExempt: t.bondTaxExempt };
      const tax =
        t.side === "sell"
          ? unwrap(
              calculateTax({
                gross: gross.toString(),
                date: t.date,
                security,
                allocation: matched.gt(0)
                  ? { kind: "cash-day", ratio: matched.div(t.qty).toString() }
                  : null,
                profile,
              }),
            ).tax
          : "0";
      details.set(t.id, {
        ...t,
        ruleSnapshot: profile,
        gross: gross.toString(),
        grossFee: dec(fee.grossFee).mul(ratio).toString(),
        rebate: dec(fee.rebate).mul(ratio).toString(),
        tax,
      });
    }
  }
  const effective = [];
  for (const t of ts) {
    const detail = details.get(t.id);
    const matched = sum(
      book.allocations
        .filter(
          (a) =>
            a.kind === "credit-day" &&
            (a.openTradeId === t.id || a.closeTradeId === t.id),
        )
        .map((a) => a.qty),
    );
    if (matched.gt(t.qty)) throw Error("資券互抵超過成交股數");
    if (matched.gt(0)) {
      const r = matched.div(t.qty);
      effective.push({
        ...detail,
        id: t.id + ":credit-day",
        sourceTradeId: t.id,
        qty: matched.toString(),
        creditType: "cash",
        grossFee: dec(detail.grossFee).mul(r).toString(),
        rebate: dec(detail.rebate).mul(r).toString(),
        tax: dec(detail.tax).mul(r).toString(),
        creditDay: true,
      });
      if (matched.lt(t.qty)) {
        const other = dec(1).minus(r);
        effective.push({
          ...detail,
          qty: dec(t.qty).minus(matched).toString(),
          grossFee: dec(detail.grossFee).mul(other).toString(),
          rebate: dec(detail.rebate).mul(other).toString(),
          tax: dec(detail.tax).mul(other).toString(),
        });
      }
    } else effective.push(detail);
  }
  return { details: [...details.values()], effective };
}
export function valueAccount(book, market, date, accountId = null) {
  try {
    const accounts = accountId
      ? book.accounts.filter((a) => a.id === accountId)
      : book.accounts;
    const ids = new Set(accounts.map((a) => a.id));
    const warnings = [];
    let quality = "complete";
    const entries = [],
      lots = [];
    for (const a of accounts)
      entries.push(
        entry(a.id + ":opening-cash", book.openingDate, a.id, [
          line("cash", a.openingCash || 0),
          line("openingEquity", "0", a.openingCash || 0),
        ]),
      );
    for (const x of (book.openingBalances ?? []).filter((x) =>
      ids.has(x.accountId),
    )) {
      const a = dec(x.amount);
      entries.push(
        entry(x.id, book.openingDate, x.accountId, [
          line(x.bucket, a.gte(0) ? a : "0", a.lt(0) ? a.neg() : "0"),
          line("openingEquity", a.lt(0) ? a.neg() : "0", a.gte(0) ? a : "0"),
        ]),
      );
    }
    for (const p of book.openingPositions.filter((p) => ids.has(p.accountId))) {
      const principal = dec(
        p.principal ??
          (p.creditType === "margin"
            ? dec(p.qty)
                .mul(p.price)
                .mul(p.marginRatio ?? "0.6")
            : 0),
      );
      const lot = {
        ...p,
        opening: true,
        ruleSnapshot:
          p.ruleSnapshot ??
          structuredClone(
            accounts.find((a) => a.id === p.accountId)?.profile ??
              DEFAULT_PROFILE,
          ),
        initialQty: p.qty,
        remainingQty: p.qty,
        direction: p.creditType === "short" ? "short" : "long",
        principal: principal.toString(),
        annualRate:
          p.annualRate ??
          accounts.find((a) => a.id === p.accountId)?.profile.annualRate ??
          "",
        repayments: [],
        interestStart: book.openingDate,
      };
      lots.push(lot);
      if (p.creditType === "margin")
        entries.push(
          entry(p.id + ":opening-debt", book.openingDate, p.accountId, [
            line("openingEquity", principal),
            line("marginDebt", "0", principal),
          ]),
        );
      if (p.creditType === "short") {
        const restricted = dec(p.restricted ?? 0),
          g = dec(p.qty).mul(p.price);
        entries.push(
          entry(p.id + ":opening-short", book.openingDate, p.accountId, [
            line("restricted", restricted),
            line("shortDebt", "0", g),
            line(
              "openingEquity",
              g.gt(restricted) ? g.minus(restricted) : 0,
              restricted.gte(g) ? restricted.minus(g) : 0,
            ),
          ]),
        );
      }
      if (p.accruedInterest)
        entries.push(
          entry(p.id + ":opening-interest", book.openingDate, p.accountId, [
            line("openingEquity", p.accruedInterest),
            line("interestPayable", "0", p.accruedInterest),
          ]),
        );
    }
    const costAdjusted = new Set(),
      sharesDelivered = new Set();
    function applyStockGrants(upTo) {
      for (const c of book.confirmations.filter(
        (c) =>
          ids.has(c.accountId) &&
          c.kind === "stock-dividend" &&
          c.confirmed &&
          c.exDate <= upTo,
      )) {
        const eligible = lots.filter(
          (l) =>
            l.accountId === c.accountId &&
            l.code === c.code &&
            l.direction === "long" &&
            l.date < c.exDate &&
            !l.stockGrant,
        );
        if (!costAdjusted.has(c.id)) {
          for (const l of eligible)
            l.price = dec(l.price).div(dec(1).plus(c.ratio)).toString();
          costAdjusted.add(c.id);
        }
        if (
          c.receivedDate &&
          c.receivedDate <= upTo &&
          !sharesDelivered.has(c.id)
        ) {
          const total = sum(eligible.map((l) => l.initialQty));
          const basis = total.gt(0)
            ? sum(eligible.map((l) => dec(l.price).mul(l.initialQty)))
                .div(total)
                .toString()
            : "0";
          lots.push({
            id: c.id + ":shares",
            accountId: c.accountId,
            code: c.code,
            date: c.receivedDate,
            creditType: "cash",
            direction: "long",
            initialQty: c.pendingQty,
            remainingQty: c.pendingQty,
            qty: c.pendingQty,
            price: basis,
            principal: "0",
            repayments: [],
            stockGrant: true,
          });
          sharesDelivered.add(c.id);
        }
      }
    }
    const working = { ...book, _securities: market.securities };
    const prep = prepareTrades(working, date);
    for (const raw of prep.effective.filter((t) => ids.has(t.accountId))) {
      applyStockGrants(raw.date);
      const t = { ...raw };
      const due = unwrap(addBusinessDays(t.date, 2, market.calendar));
      let qty = dec(t.qty);
      const short = t.creditType === "short";
      const cashShort = lots.filter(
        (l) =>
          l.accountId === t.accountId &&
          l.code === t.code &&
          l.direction === "short" &&
          l.creditType === "cash" &&
          l.date === t.date &&
          dec(l.remainingQty).gt(0),
      );
      let closing = short ? t.side === "buy" : t.side === "sell";
      if (t.creditType === "cash" && t.side === "buy" && cashShort.length)
        closing = true;
      if (closing) {
        let candidates = lots.filter(
          (l) =>
            l.accountId === t.accountId &&
            l.code === t.code &&
            l.creditType === t.creditType &&
            l.direction === (t.side === "buy" ? "short" : "long") &&
            dec(l.remainingQty).gt(0),
        );
        const manual = book.allocations.filter(
          (a) =>
            a.closeTradeId === t.id &&
            !["credit-day", "cash-first"].includes(a.kind),
        );
        if (manual.length)
          candidates = manual.map((a) => {
            const lot = candidates.find((l) => l.id === a.openTradeId);
            if (!lot) throw Error("指定批次不存在或已用完");
            return { ...lot, _limit: a.qty, _original: lot };
          });
        if (t.side === "sell" && (t.creditDay || t.dayType === "cash-first"))
          candidates = [];
        let principal = dec(0),
          released = dec(0);
        for (const target of candidates) {
          if (qty.isZero()) break;
          const lot = target._original ?? target;
          const q = D.min(qty, target._limit ?? lot.remainingQty);
          if (q.gt(lot.remainingQty) || q.lte(0))
            throw Error("指定沖銷股數超過可用");
          lot.remainingQty = dec(lot.remainingQty).minus(q).toString();
          qty = qty.minus(q);
          if (lot.creditType === "margin") {
            const p = dec(lot.principal).mul(q).div(lot.initialQty);
            principal = principal.plus(p);
            lot.repayments.push({ date: due, principal: p.toString() });
          }
          if (lot.creditType === "short") {
            lot.shortRepayments ??= [];
            lot.shortRepayments.push({ date: due, qty: q.toString() });
            const held = dec(
              lot.restricted ??
                dec(lot.initialQty)
                  .mul(lot.price)
                  .mul(
                    dec(1).plus(lot.ruleSnapshot?.shortMarginRatio ?? "0.9"),
                  ),
            );
            released = released.plus(held.mul(q).div(lot.initialQty));
          }
        }
        t.principalRepaid = principal.toString();
        t.collateralReleased = released.toString();
        if (qty.gt(0)) {
          const isFirst =
            book.allocations.some(
              (a) =>
                (a.kind === "cash-first" || a.kind === "credit-day") &&
                a.openTradeId === raw.sourceTradeId,
            ) ||
            book.allocations.some(
              (a) => a.kind === "cash-first" && a.openTradeId === t.id,
            ) ||
            t.creditDay ||
            t.dayType === "cash-first";
          if (t.creditType === "cash" && t.side === "sell" && isFirst) {
            lots.push({
              ...t,
              initialQty: qty.toString(),
              remainingQty: qty.toString(),
              direction: "short",
              principal: "0",
              repayments: [],
            });
          } else throw Error(`${t.code} 可平倉股數不足`);
        }
      } else
        lots.push({
          ...t,
          initialQty: t.qty,
          remainingQty: t.qty,
          direction: short ? "short" : "long",
          restricted: short
            ? dec(t.qty)
                .mul(t.price)
                .mul(dec(1).plus(t.ruleSnapshot.shortMarginRatio ?? "0.9"))
                .minus(t.grossFee)
                .minus(t.tax)
                .toString()
            : undefined,
          principal:
            t.creditType === "margin"
              ? dec(t.qty)
                  .mul(t.price)
                  .mul(t.ruleSnapshot.marginRatio)
                  .toString()
              : "0",
          annualRate: t.ruleSnapshot.annualRate,
          interestStart: due,
          repayments: [],
        });
      const posted = unwrap(
        postTrade(
          t,
          [],
          { grossFee: t.grossFee, rebate: t.rebate },
          t.tax,
          market.calendar,
        ),
      );
      const settlement=unwrap(settleTrade(t,posted,due));
      posted[0].settlementAmount=sum(settlement.flatMap(e=>e.lines.filter(l=>l.bucket==='cash').map(l=>dec(l.debit).minus(l.credit)))).toString();
      entries.push(...posted,...(date>=due?settlement:[]));
    }
    applyStockGrants(date);
    for (const c of book.confirmations.filter((c) => ids.has(c.accountId)))
      entries.push(...unwrap(postCorporateEvent(c, date)));
    for (const r of book.rebateReceipts.filter(
      (r) => ids.has(r.accountId) && r.receivedDate <= date,
    ))
      entries.push(...r.entries);
    for (const f of book.feeAdjustments.filter(
      (f) => ids.has(f.accountId) && f.date <= date,
    )) {
      const a = dec(f.amount);
      entries.push(
        entry(f.id, f.date, f.accountId, [
          line("expense", a.gte(0) ? a : 0, a.lt(0) ? a.neg() : 0),
          line(
            f.paid ? "cash" : "feePayable",
            a.lt(0) ? a.neg() : 0,
            a.gte(0) ? a : 0,
          ),
        ]),
      );
    }
    for (const flow of book.cashFlows.filter(
      (f) => ids.has(f.accountId) && f.date <= date,
    )) {
      const c = dec(flow.amount);
      entries.push(
        entry(flow.id, flow.date, flow.accountId, [
          line("cash", c.gte(0) ? c : 0, c.lt(0) ? c.neg() : 0),
          line("externalEquity", c.lt(0) ? c.neg() : 0, c.gte(0) ? c : 0),
        ]),
      );
    }
    let accrued = dec(0);
    if (
      lots.some(
        (l) =>
          ["margin", "short"].includes(l.creditType) &&
          l.ruleSnapshot?.status !== "verified",
      )
    )
      warnings.push("信用交易費用使用估算規則，待券商帳單核對");
    for (const lot of lots) {
      if (lot.creditType === "margin") {
        const result = accrueInterest(
          lot,
          lot.interestStart,
          date,
          lot.ruleSnapshot ??
            accounts.find((a) => a.id === lot.accountId)?.profile ??
            {},
        );
        if (result.ok) accrued = accrued.plus(result.value.total);
        else warnings.push(...result.errors.map((x) => x.message));
      }
      if (lot.creditType === "short") {
        const profile =
          lot.ruleSnapshot ??
          accounts.find((a) => a.id === lot.accountId)?.profile ??
          {};
        const once = creditFees(
          {
            ...profile,
            shortFeeRate: lot.opening ? "0" : profile.shortFeeRate,
            shortAnnualRate: "0",
          },
          dec(lot.initialQty).mul(lot.price),
          0,
        );
        warnings.push(...once.missing.map((x) => x + "未設定"));
        accrued = accrued.plus(once.amount);
        if (profile.shortAnnualRate === "" || profile.shortAnnualRate == null)
          warnings.push("融券年費率未設定");
        if (lot.interestStart && lot.interestStart <= date)
          for (const day of datesBetween(lot.interestStart, date)) {
            const covered = sum(
              (lot.shortRepayments ?? [])
                .filter((x) => x.date <= day)
                .map((x) => x.qty),
            );
            const outstanding = D.max(dec(lot.initialQty).minus(covered), 0);
            accrued = accrued.plus(
              outstanding
                .mul(lot.price)
                .mul(profile.shortAnnualRate || 0)
                .div(365),
            );
          }
      }
    }
    if (accrued.gt(0))
      entries.push(
        entry("credit-accrual:" + date, date, accountId ?? "combined", [
          line("expense", accrued),
          line("interestPayable", "0", accrued),
        ]),
      );
    entries.push(
      ...book.entries.filter((e) => ids.has(e.accountId) && e.date <= date),
    );
    const balances = unwrap(replayEntries(entries, date)).balances;
    let longValue = dec(0),
      shortValue = dec(0),
      marginValue = dec(0);
    const positions = [];
    for (const l of lots) {
      if (dec(l.remainingQty).isZero()) continue;
      const price = latestPrice(market, l.code, date);
      if (!price) {
        quality = "insufficient";
        warnings.push(l.code + "缺少估值價格");
        continue;
      }
      if (price.date < date && market.calendar.businessDates.includes(date)) {
        quality = "estimated";
        warnings.push(l.code + "沿用" + price.date + "價格");
      }
      const value = dec(l.remainingQty).mul(price.close);
      if (l.direction === "short") shortValue = shortValue.plus(value);
      else {
        longValue = longValue.plus(value);
        if (l.creditType === "margin") marginValue = marginValue.plus(value);
      }
      positions.push({
        ...l,
        qty: l.remainingQty,
        marketPrice: price.close,
        priceDate: price.date,
        marketValue: value.toString(),
        unrealized: (l.direction === "short"
          ? dec(l.price).minus(price.close)
          : dec(price.close).minus(l.price)
        )
          .mul(l.remainingQty)
          .toString(),
      });
      if (l.direction === "short" && l.creditType === "cash")
        warnings.push("現股先賣當沖未完成，請核對券差處理");
    }
    let pendingValue = dec(0);
    for (const c of book.confirmations.filter(
      (c) =>
        ids.has(c.accountId) &&
        c.kind === "stock-dividend" &&
        c.confirmed &&
        c.exDate <= date &&
        (!c.receivedDate || c.receivedDate > date),
    )) {
      const p = latestPrice(market, c.code, date);
      if (p) pendingValue = pendingValue.plus(dec(c.pendingQty).mul(p.close));
      else {
        quality = "insufficient";
        warnings.push(c.code + "股票股利缺估值");
      }
    }
    let equity = longValue.minus(shortValue).plus(pendingValue);
    for (const bucket of [
      "cash",
      "restricted",
      "receivable",
      "payable",
      "marginDebt",
      "rebateReceivable",
      "dividendReceivable",
      "interestPayable",
      "feePayable",
      "otherAsset",
      "otherLiability",
    ])
      equity = equity.plus(balances[bucket] ?? 0);
    for (const ev of market.events ?? []) {
      if (
        !["cash-dividend", "stock-dividend"].includes(ev.kind) ||
        !ev.exDate ||
        ev.exDate > date
      )
        continue;
      for (const id of ids) {
        if (
          ![...book.openingPositions, ...book.trades].some(
            (p) => p.accountId === id && p.code === ev.code,
          )
        )
          continue;
        const confirmed = book.confirmations.find(
          (c) =>
            c.accountId === id &&
            c.eventId === ev.id &&
            c.kind === ev.kind &&
            c.confirmed,
        );
        if (!confirmed)
          warnings.push(id + " / " + ev.code + "已除權息但尚未確認權益");
        else if (ev.version && confirmed.eventVersion !== ev.version)
          warnings.push(id + " / " + ev.code + "股利公告已修訂，需核對差異");
      }
    }
    if (warnings.length && quality === "complete") quality = "estimated";
    let settledMarginValue = dec(0),
      settledShortValue = dec(0);
    for (const l of lots) {
      if (l.interestStart > date) continue;
      const price = latestPrice(market, l.code, date);
      if (!price) continue;
      if (l.creditType === "margin") {
        const repaid = sum(
          l.repayments.filter((r) => r.date <= date).map((r) => r.principal),
        );
        const outstanding = dec(l.principal).minus(repaid);
        const q = dec(l.principal).gt(0)
          ? dec(l.initialQty).mul(outstanding).div(l.principal)
          : dec(0);
        settledMarginValue = settledMarginValue.plus(q.mul(price.close));
      }
      if (l.creditType === "short") {
        const repaid = sum(
          (l.shortRepayments ?? [])
            .filter((r) => r.date <= date)
            .map((r) => r.qty),
        );
        settledShortValue = settledShortValue.plus(
          D.max(dec(l.initialQty).minus(repaid), 0).mul(price.close),
        );
      }
    }
    const maintenance = accountId
      ? unwrap(
          estimateMaintenance(
            {
              marginValue: settledMarginValue.toString(),
              marginPrincipal: dec(balances.marginDebt ?? 0)
                .neg()
                .toString(),
              shortValue: settledShortValue.toString(),
              shortCollateral: balances.restricted ?? "0",
              extraCollateral: "0",
            },
            market,
            accounts[0]?.profile ?? {},
          ),
        )
      : null;
    return ok({
      accountId: accountId ?? "combined",
      date,
      equity: equity.toString(),
      balances,
      longValue: longValue.toString(),
      shortValue: shortValue.toString(),
      pendingStockValue: pendingValue.toString(),
      interestAccrued: accrued.toString(),
      positions,
      entries,
      tradeDetails: prep.details,
      maintenance,
      quality,
      warnings: [...new Set(warnings)],
    });
  } catch (e) {
    return err("VALUATION_FAILED", e.message);
  }
}
export function buildSnapshots(book, market, toDate, accountId = null) {
  try {
    if (toDate < book.openingDate) return ok([]);
    let units = dec(0),
      previousE = dec(0),
      previousNav = null;
    const out = [];
    for (const date of datesBetween(book.openingDate, toDate)) {
      const s = unwrap(valueAccount(book, market, date, accountId));
      const flow = sum(
        book.cashFlows
          .filter(
            (f) =>
              f.date === date &&
              (!accountId || f.accountId === accountId) &&
              !(accountId === null && f.internal),
          )
          .map((f) => f.amount),
      );
      const pre = dec(s.equity).minus(flow);
      let r;
      if (!out.length) {
        if (pre.gt(0)) units = pre.div(10);
        r = unwrap(
          applyCloseFlow({
            equityBeforeFlow: pre.toString(),
            previousUnits: units.toString(),
            flow: flow.toString(),
          }),
        );
      } else
        r = unwrap(
          applyCloseFlow({
            equityBeforeFlow: pre.toString(),
            previousUnits: units.toString(),
            flow: flow.toString(),
          }),
        );
      units = dec(r.units);
      const pnl = out.length
        ? dec(s.equity).minus(previousE).minus(flow)
        : dec(0);
      out.push({
        ...s,
        units: r.units,
        unitNav: r.unitNav,
        pnl: pnl.toString(),
        return: r.unitNav ? dec(r.unitNav).div(10).minus(1).toString() : null,
      });
      previousE = dec(s.equity);
      previousNav = r.unitNav;
    }
    return ok(out);
  } catch (e) {
    return err("SNAPSHOT_FAILED", e.message);
  }
}
