import {settlementSchedule,settlementSummary} from "./ledger/settlements.js";
import {sortSectorMetrics} from "./ui/market-data.js";
import {wireTradeForm} from "./ui/trade-form.js";
import {applyOpeningAssets,readOpeningAssets,openingRebateTrades} from "./storage/opening-assets.js";
import {openingAssetFields,wireOpeningAssets,validateOpeningAssets} from "./ui/opening-assets.js";
import { wireOpeningPosition } from "./ui/opening-position.js";
import { groupIndustries } from "./sectors/industries.js";
import { recoveryPage } from "./ui/pages/recovery.js";
import { pauseRecord, restoreRecord, deleteTrade, RECOVERABLE } from "./storage/recovery.js";
import { mergeThemeCatalog } from "./sectors/catalog.js";
import legacyThemes from "./sectors/legacy-themes.json";
import { wireValidation, friendlyFormError } from "./ui/form-validation.js";
import { DEFAULT_PROFILE } from "./ledger/fees.js";
import "@fontsource-variable/noto-sans-tc";
import "./app.css";
import {
  E,
  num,
  pct,
  color,
  button,
  table,
  field,
  select,
  note,
  card,
  safeLink,
} from "./ui/helpers.js";
import { openBookStore } from "./storage/database.js";
import { createBook, newId, recordAudit } from "./storage/book.js";
import { exportBackup, inspectBackup, backupDue } from "./storage/backup.js";
import { createDemo } from "./storage/demo.js";
import { prepareRebuild, commitRebuild } from "./storage/rebuild.js";
import { loadMarket } from "./market/loader.js";
import {
  captureMarketHistory,
  compareMarketHistory,
  useLockedMarket,
} from "./market/history-lock.js";
import { taipeiToday, addBusinessDays } from "./domain/calendar.js";
import { dec, sum } from "./domain/money.js";
import {
  buildSnapshots,
  valueAccount,
  latestPrice,
} from "./performance/portfolio.js";
import {
  periodThemeReturn,
  themeActivity,
  constituentsAt,
} from "./sectors/sectors.js";
import { buildMarketSummary } from "./summary/summary.js";
import {
  listReminders,
  confirmEntitlement,
  receiptsOf,
} from "./events/events.js";
import { groupRebates, confirmRebate } from "./ledger/rebates.js";
import { validateDayTrade } from "./ledger/allocations.js";
import { overview } from "./ui/pages/overview.js";
import { positions } from "./ui/pages/positions.js";
import { accounting } from "./ui/pages/accounting.js";
import { marketPage } from "./ui/pages/market.js";
import { eventsPage } from "./ui/pages/events.js";
import { settings } from "./ui/pages/settings.js";
import { performanceChart, marketChart, clearCharts } from "./ui/charts.js";
const app = document.getElementById("app"),
  modal = document.getElementById("modal");
const state = {
  book: null,
  market: null,
  store: null,
  namespace: localStorage.getItem("stock-daily-namespace") || "personal",
  account: "all",
  date: taipeiToday(),
  weighting: "equal",
  marketSort: "volume-desc",
  indexCode: "TAIEX",
  cached: null,
};
let seeds = [];
const icons = [
  "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  "M3 19h18 M6 15V9 M12 15V4 M18 15V7",
  "M3 5h18v14H3z M3 9h18 M16 14h2",
  "M3 18l5-6 4 3 8-11 M3 21h18",
  "M5 5h14v16H5z M8 2v6 M16 2v6 M5 10h14",
  "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3",
];
const nav = [
  ["overview", "資產總覽"],
  ["positions", "持股與交易"],
  ["accounting", "帳務與費用"],
  ["market", "大盤與題材"],
  ["events", "事件中心"],
  ["settings", "設定與備份"],
];
const icon = (i) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[i]}"/></svg>`;
function toast(message, error = false) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.append(el);
  }
  el.className = error ? "toast error" : "toast";
  el.textContent = message;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.remove(), 5000);
}
function result(r) {
  if (!r.ok) throw Error(r.errors.map((e) => e.message).join("；"));
  return r.value;
}
function freezeOpeningRules(book) {
  for (const p of book.openingPositions) {
    if (!p.ruleSnapshot)
      p.ruleSnapshot = structuredClone(
        book.accounts.find((a) => a.id === p.accountId)?.profile ?? {},
      );
  }
}
async function hydrateMarketContext() {
  if (!state.book || !state.incomingMarket) return;
  const upgradedThemes = mergeThemeCatalog(state.book.themes, seeds, legacyThemes);
  if (JSON.stringify(upgradedThemes) !== JSON.stringify(state.book.themes)) {
    const draft = structuredClone(state.book);
    draft.themes = upgradedThemes;
    recordAudit(draft, "更新內建題材名單", "補齊公開來源成分；保留自訂版本");
    state.book = result(await state.store.save(draft, state.book.revision));
  }
  state.market = state.incomingMarket;
  state.marketCorrection = compareMarketHistory(
    state.book.marketHistory,
    state.incomingMarket,
  );
  if (state.marketCorrection.length)
    state.market = useLockedMarket(
      state.book.marketHistory,
      state.incomingMarket,
    );
  freezeOpeningRules(state.book);
  if (!state.book.marketHistory) {
    state.book.marketHistory = captureMarketHistory(state.book, state.market);
    state.book = result(
      await state.store.save(state.book, state.book.revision),
    );
  }
  state.cached = null;
}
async function save(draft, kind, detail = "") {
  freezeOpeningRules(draft);
  if (state.market)
    draft.marketHistory = captureMarketHistory(draft, state.market);
  recordAudit(draft, kind, detail);
  state.book = result(await state.store.save(draft, state.book?.revision ?? 0));
  state.cached = null;
  render();
}
function todayValue() {
  return state.date || state.market.asOf;
}
function makeView() {
  const key = [
    state.book.revision,
    state.account,
    state.date,
    state.weighting,
    state.indexCode,
    state.marketSort,
  ].join(":");
  if (state.cached?.key === key) return state.cached.value;
  const b = state.book,
    m = {
      ...state.market,
      events: [...state.market.events, ...(state.book.localEvents ?? [])],
    };
  const snapshots = result(
    buildSnapshots(
      b,
      m,
      state.date,
      state.account === "all" ? null : state.account,
    ),
  );
  const latest = snapshots.at(-1);
  const themes = b.themes.length ? b.themes : seeds;
  const index = m.indices.find((x) => x.code === "TAIEX");
  const indexReturn = (n) => {
    const bars = index?.bars.filter((x) => x.date <= m.asOf) ?? [];
    return bars.length > n
      ? Number(bars.at(-1).close) / Number(bars.at(-1 - n).close) - 1
      : null;
  };
  const metrics = themes.map((t) => {
    const returns = {},
      errors = {};
    let valid20;
    for (const n of [1, 5, 20, 60]) {
      const r = periodThemeReturn(t, m, m.asOf, n, state.weighting);
      returns[n] = r.ok ? r.value.return : null;
      errors[n] = r.ok ? null : r.errors[0].message;
      if (n === 20 && r.ok) valid20 = r.value.coverage.valid;
    }
    const activity = result(themeActivity(t, m, m.asOf));
    return {
      ...t,
      returns,
      errors,
      valid20,
      count: constituentsAt(t, m.asOf).length,
      activity,
      relative5:
        returns[5] != null && indexReturn(5) != null
          ? String(Number(returns[5]) - indexReturn(5))
          : null,
    };
  });
  const industries = groupIndustries(m.securities).map((t) => {
    return {
      ...t,
      count: t.members.length,
      activity: result(themeActivity(t,m,m.asOf)),
      returns: Object.fromEntries(
        [1, 5, 20].map((n) => {
          const r = periodThemeReturn(t, m, m.asOf, n, "equal");
          return [n, r.ok ? r.value.return : null];
        }),
      ),
    };
  });
  const reminders = listReminders(b, m, state.date);
  const rebates = result(groupRebates([...(latest?.tradeDetails ?? []),...openingRebateTrades(b).filter(x=>state.account==="all"||x.accountId===state.account)]));
  const maintenance = b.accounts.map((a) => ({
    name: a.name,
    result: valueAccount(b, m, state.date, a.id).value?.maintenance,
  }));
  const settlements=settlementSchedule(latest?.entries??[]);
  const pendingSettlement=settlementSummary(settlements,state.date,m.calendar);
  const benchmarks = m.indices.filter((i) =>
    ["TAIEX", "TPEX"].includes(i.code),
  );
  for (const code of b.benchmarks ?? [])
    benchmarks.push({
      code,
      name: m.securities.find((s) => s.code === code)?.name ?? code,
      bars: m.bars.filter((x) => x.code === code && x.close),
    });
  const v = {
    ...state,
    latest,
    snapshots,
    themeMetrics: sortSectorMetrics(metrics,state.marketSort),
    industries: sortSectorMetrics(industries,state.marketSort),
    summary: result(buildMarketSummary(m, metrics, m.asOf, {})),
    rebates,
    reminders,
    maintenance,
    settlements,
    pendingSettlement,
    benchmarks,
    securityName: (code) =>
      m.securities.find((s) => s.code === code)?.name ?? "",
  };
  state.cached = { key, value: v };
  return v;
}
function shell(content, page, title) {
  const hasBook = !!state.book;
  return `<aside class="sidebar"><a class="brand" href="#overview"><span class="brand-mark">${icon(1)}</span><div>日見<span>DAILY EQUITY</span></div></a><div class="nav-label">投資工作台</div><nav>${nav.map(([id, label], i) => `<a href="#${id}" class="nav-item ${id === page ? "active" : ""}">${icon(i)}<span>${label}</span>${id === "events" ? '<span class="nav-count" aria-hidden="true">●</span>' : ""}</a>`).join("")}</nav><div class="sidebar-bottom"><div class="local-status"><span class="status-dot"></span>資料僅儲存於本機</div><p>你的投資紀錄，留在你的瀏覽器。</p><span class="version">DAILY EQUITY · v0.8</span></div></aside><div class="workspace"><header class="topbar"><span class="breadcrumb">投資工作台 <span>/</span> <strong>${E(title)}</strong></span><div class="topbar-right"><span class="status-pill"><span class="status-dot"></span>收盤資料</span><span class="avatar">${state.book?.demo ? "DE" : "ME"}</span></div></header><main><div class="page-header"><div><div class="eyebrow">YOUR DAILY INVESTMENT VIEW</div><h1>${E(title)}</h1><p>${page === "overview" ? "讓資產變化有跡可循，讓每一天的決策更清晰。" : ({ positions: "管理每個部位，記錄每一筆決策。", accounting: "釐清每一筆收付，看見完整的資產與負債。", market: "從大盤趨勢到產業輪動，掌握市場節奏。", events: "重要持股事件，以及需要你確認的權益。", settings: "讓帳務規則、資料與備份都在掌握之中。" }[page] ?? "建立你的每日投資工作台。")}</p></div>${hasBook ? `<div class="page-tools">${state.book.demo ? '<span class="badge lavender">模擬帳本</span>' : ""}<select id="account-select" aria-label="選擇帳戶"><option value="all">全部帳戶</option>${state.book.accounts.map((a) => `<option value="${E(a.id)}" ${state.account === a.id ? "selected" : ""}>${E(a.name)}</option>`).join("")}</select><input type="date" id="asof-date" aria-label="估值日期" value="${E(state.date)}" min="${E(state.book.openingDate)}" max="${taipeiToday()}">${["#settings", "#recovery"].includes(location.hash) ? "" : button("trade", "＋ 新增交易", "primary")}</div>` : ""}</div>${content}<footer><span>行情截止 ${E(state.market?.asOf ?? "尚未載入")} · TWSE / TPEx</span><span>淨值含股利與費用 · 個人帳務不會上傳</span></footer></main></div>`;
}
function render() {
  try {
    clearCharts();
    if (!state.book) {
      app.innerHTML = shell(
        `<section class="welcome card"><div class="welcome-art">${icon(1)}</div><span class="eyebrow">A CLEARER VIEW OF YOUR PORTFOLIO</span><h2>從今天起，看清你的投資全貌。</h2><p>每日淨值、融資融券、交易費用與板塊輪動，<br>在同一個簡潔的工作台裡整理好。</p><div class="button-row">${button("create-book", "建立自己的帳本", "primary")}${button("demo", "載入模擬帳本")}</div><div class="welcome-features"><span>✓ 本機儲存</span><span>✓ 出入金不影響績效</span><span>✓ 市場資料從9/1累積</span></div></section>`,
        "overview",
        "資產總覽",
      );
      return;
    }
    if (location.hash === "#settings") {
      app.innerHTML = shell(settings({...state}) + card("帳本修復", note("若計算出錯，可在這裡直接檢查原始紀錄，不需要先算出淨值。") + button("settings-recovery", "檢查與修正原始紀錄")), "settings", "設定與備份");
      return;
    }
    if (location.hash === "#recovery") {
      app.innerHTML = shell(recoveryPage(state.book), "settings", "帳本修復");
      return;
    }
    const v = makeView();
    const page = nav.some(([id]) => id === location.hash.slice(1))
        ? location.hash.slice(1)
        : "overview",
      title = nav.find((x) => x[0] === page)[1];
    const pages = {
      overview,
      positions,
      accounting,
      market: marketPage,
      events: eventsPage,
      settings,
    };
    app.innerHTML = shell(
      (state.marketCorrection?.length
        ? `<div class="backup-banner">歷史行情有 ${state.marketCorrection.length} 筆修訂；目前保留先前估值。 ${button("market-correction", "預覽重算差異", "ghost")}</div>`
        : "") +
        (backupDue(state.book, state.date)
          ? `<div class="backup-banner">建議先備份帳本：資料只保存在本機。 ${button("export", "匯出備份", "ghost")}</div>`
          : "") +
        pages[page](v),
      page,
      title,
    );
    if (page === "overview")
      performanceChart("performance-chart", v.snapshots, v.benchmarks);
    if (page === "market")
      marketChart(
        "market-chart",
        state.market.indices.find((x) => x.code === state.indexCode),
        state.date,
      );
  } catch (e) {
    app.innerHTML = shell(
      card(
        "帳務需要確認",
        `<p>有原始紀錄的數值不完整，目前無法計算淨值。你的資料仍保留，可以先備份或修正。</p><details><summary>技術訊息</summary><p>${E(e.message)}</p></details>${button("settings-recovery", "前往備份與修正")}${button("export", "匯出完整備份", "primary")}`,
      ),
      "settings",
      "計算狀態",
    );
    toast(e.message, true);
  }
}
function dialog(title, body, onSubmit, submit = "確認儲存", extraCheck) {
  modal.innerHTML = `<form id="modal-form"><div class="modal-head"><h2>${E(title)}</h2><button class="close" type="button" data-action="close-modal" aria-label="關閉">×</button></div><div class="form-body">${body}</div><p id="form-error" role="alert"></p><div class="modal-foot"><button type="button" class="btn secondary" data-action="close-modal">取消</button><button class="btn primary" type="submit">${E(submit)}</button></div></form>`;
  modal.showModal();
  const currentForm = document.getElementById("modal-form");
  const validate = wireValidation(currentForm, extraCheck);
  currentForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const btn = e.submitter ?? currentForm.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
      if (document.getElementById("modal-form") === currentForm) modal.close();
    } catch (ex) {
      currentForm.querySelector("#form-error").textContent = friendlyFormError(ex);
    } finally {
      if (currentForm.isConnected) btn.disabled = false;
    }
  };
  return { form: currentForm, validate };
}
const accountOptions = () => state.book.accounts.map((a) => [a.id, a.name]);
const selectAccount = (value) =>
  select(
    "accountId",
    "帳戶",
    accountOptions(),
    value ??
      (state.account === "all" ? state.book.accounts[0].id : state.account),
  );
function accountForm(account) {
  const a = account ?? {
      id: newId(),
      name: "新帳戶",
      openingCash: "0",
      profile: structuredClone(state.book.accounts[0].profile),
    },
    p = a.profile;
  dialog(
    account ? "帳戶與費率" : "新增帳戶",
    `<div class="form-grid">${field("name", "帳戶名稱", "text", a.name, "required")}${field("openingCash", "期初已交割現金", "number", a.openingCash, 'step="0.01" required')}${field("discountTenths", "手續費打幾折（例如2.8）", "number", p.discountTenths, 'min="0" max="10" step="0.01" required')}${field("feeRate", "基礎手續費率（%）", "number", Number(p.feeRate) * 100, 'min="0" step="0.0001" required')}${field("minRegular", "整股最低手續費", "number", p.minRegular, 'min="0" required')}${field("minOdd", "零股最低手續費", "number", p.minOdd, 'min="0" required')}${field("marginRatio", "融資成數（%）", "number", Number(p.marginRatio) * 100, 'min="0" max="100" required')}${field("annualRate", "融資年利率（%，預設6.45，可修改）", "number", Number(p.annualRate || DEFAULT_PROFILE.annualRate) * 100, 'min="0" step="0.001" required')}${field("shortMarginRatio", "融券保證金（%）", "number", Number(p.shortMarginRatio) * 100, 'min="0" step="0.01" required')}${field("shortFeeRate", "融券一次性費率（%）", "number", p.shortFeeRate === "" ? "" : Number(p.shortFeeRate) * 100, 'min="0" step="0.0001"')}${field("shortAnnualRate", "融券年費率（%）", "number", p.shortAnnualRate === "" ? "" : Number(p.shortAnnualRate) * 100, 'min="0" step="0.001"')}${field("maintenanceThreshold", "維持率提醒門檻（%）", "number", p.maintenanceThreshold, 'min="1" step="0.01" required')}${field("interestBasis", "計息年度日數", "number", p.interestBasis, 'min="1" required')}${select(
      "interestRounding",
      "估算利息取整",
      [
        ["retained", "保留精度，結算再核對"],
        ["daily-floor", "每日先無條件捨去"],
        ["total-floor", "累計後無條件捨去"],
      ],
      p.interestRounding,
    )}</div>${note("修改預設費率不會改既有交易快照。變更期初現金會影響歷史，請核對差異。")}`,
    async (f) => {
      const draft = structuredClone(state.book);
      a.name = f.name;
      a.openingCash = dec(f.openingCash).toString();
      a.profile = {
        ...p,
        discountTenths: dec(f.discountTenths).toString(),
        feeRate: dec(f.feeRate).div(100).toString(),
        minRegular: f.minRegular,
        minOdd: f.minOdd,
        marginRatio: dec(f.marginRatio).div(100).toString(),
        annualRate:
          dec(f.annualRate || "6.45").div(100).toString(),
        shortMarginRatio: dec(f.shortMarginRatio).div(100).toString(),
        shortFeeRate:
          f.shortFeeRate === "" ? "" : dec(f.shortFeeRate).div(100).toString(),
        shortAnnualRate:
          f.shortAnnualRate === ""
            ? ""
            : dec(f.shortAnnualRate).div(100).toString(),
        maintenanceThreshold: f.maintenanceThreshold,
        interestBasis: Number(f.interestBasis),
        interestRounding: f.interestRounding,
      };
      const i = draft.accounts.findIndex((x) => x.id === a.id);
      if (i < 0) draft.accounts.push(a);
      else draft.accounts[i] = a;
      await save(draft, "帳戶設定", a.name);
    },
  );
}
function tradeForm(original) {
  const v = makeView(),
    a = state.book.accounts.find(
      (a) =>
        a.id ===
        (original?.accountId ??
          (state.account === "all"
            ? state.book.accounts[0].id
            : state.account)),
    ),
    p = original?.ruleSnapshot ?? a.profile;
  const t = original ?? {
    date: state.date,
    side: "buy",
    creditType: "cash",
    qty: "1000",
    price: "",
    code: "",
    marketType: "regular",
  };
  const existing = state.book.trades.filter((x) => x.id !== original?.id);
  const {form,validate}=dialog(
    original ? "修訂交易（先預覽）" : "新增交易",
    `<div class="form-grid">${select("tradePreset","這筆要做什麼",[["cash-buy","現買（現股買進）"],["cash-sell","現賣（現股賣出）"],["margin-buy","資買（融資買進）"],["margin-sell","資賣（融資賣出）"],["cash-day","現股當沖（先買後賣）"],["other","其他／特殊交易"]])}${selectAccount(t.accountId)}${field("date", "交易日期", "date", t.date, 'required min="' + state.book.openingDate + '" max="' + taipeiToday() + '"')}${field("code", "股票／ETF代號", "text", t.code, 'required list="security-options"')}<datalist id="security-options">${state.market.securities.map((s) => `<option value="${E(s.code)}">${E(s.name)}</option>`).join("")}</datalist>${select(
      "side",
      "買賣方向",
      [
        ["buy", "買進／回補"],
        ["sell", "賣出"],
      ],
      t.side,
    )}${select(
      "creditType",
      "交易方式",
      [
        ["cash", "現股"],
        ["margin", "融資"],
        ["short", "融券"],
      ],
      t.creditType,
    )}${select(
      "marketType",
      "交易市場",
      [
        ["regular", "整股市場"],
        ["odd", "零股市場"],
      ],
      t.marketType,
    )}${field("qty", "成交股數（非張數）", "number", t.qty, 'min="1" step="1" required')}${field("price", "成交單價", "number", t.price, 'min="0.01" step="0.01" required')}${select(
      "dayType",
      "當沖類型",
      [
        ["", "非當沖／留倉"],
        ["cash-day", "現股當沖－先買後賣"],
        ["cash-first", "現股當沖－先賣後買"],
        ["credit-day", "資券當沖－融資買進／融券賣出"],
      ],
      t.dayType ?? "",
    )}${select("pairedTradeId", "當天對應的買／賣成交（當沖配對）", [["", "暫不配對／此筆為第一側"], ...existing.map((x) => [x.id, `${x.date} ${x.code} ${x.side} ${x.qty}股`])])}${field("dayQty", "當沖股數（配對時填）", "number", "", 'min="1" step="1"')}${field("discountTenths", "本筆手續費打幾折", "number", p.discountTenths, 'min="0" max="10" step="0.01" required')}${field("marginRatio", "本筆融資成數（%）", "number", Number((t.creditType === "margin" ? p : a.profile).marginRatio) * 100, 'min="0" max="100" required')}${field("annualRate", "本筆融資年利率（%）", "number", Number((t.creditType === "margin" ? p : a.profile).annualRate || DEFAULT_PROFILE.annualRate) * 100, 'min="0" step="0.001" required')}${select(
      "bondTaxExempt",
      "債券ETF免稅資格（其他商品忽略）",
      [
        ["unknown", "尚未確認"],
        ["yes", "已確認符合免稅條件"],
        ["no", "已確認不符合免稅條件"],
      ],
      t.bondTaxExempt === true
        ? "yes"
        : t.bondTaxExempt === false
          ? "no"
          : "unknown",
    )}</div><p class="note" data-day-trade-help>當沖需有同帳戶、同日、同股票的相反方向成交。第一筆先選「暫不配對」；輸入第二筆時，選第一筆成交並填當沖股數。只選當沖類型不會完成配對，配對後才計算對應稅費。</p><details id="trade-advanced-fees"><summary>進階費用設定</summary><div class="form-grid">${field("feeGroupId", "同委託計費群組（選填）", "text", t.feeGroupId ?? "")}${field("actualGrossFee", "原始實收手續費（留空自算）", "number", t.actualGrossFee ?? "", 'min="0" step="1"')}</div>${note("同一張委託拆成多筆成交，且你分筆輸入時，才填相同群組名稱（例如order-1）合併計算手續費。不同委託請分開；一筆輸入整張成交結果可留空。原始實收手續費僅在核對券商帳單時覆寫，留空自動估算。")}</details><details><summary>手動指定平倉批次（未填採先進先出）</summary>${v.latest.positions.map((l) => field("lot:" + l.id, `${l.code} · ${l.id.slice(0, 12)} · 可用${num(l.qty)}股`, "number", "", 'min="0" step="1"')).join("")}</details>${note("先選現買、現賣、資買、資賣或先買後賣當沖；其他方式在「其他／特殊交易」。手續費折數沿用帳戶設定。送出後先試算，確認套用才儲存。")}`,
    async (f) => {
      const draft = structuredClone(state.book),
        account = draft.accounts.find((a) => a.id === f.accountId);
      const sec = state.market.securities.find((s) => s.code === f.code.trim());
      if (!sec) throw Error("查無商品，請核對代號或資料來源");
      if (f.marketType === "odd" && (f.creditType !== "cash" || f.dayType))
        throw Error("零股不支援信用／當沖");
      const tx = {
        ...original,
        id: original?.id ?? newId(),
        accountId: f.accountId,
        date: f.date,
        sequence: original?.sequence ?? Date.now(),
        code: f.code.trim(),
        side: f.side,
        creditType: f.creditType,
        qty: dec(f.qty).toString(),
        price: dec(f.price).toString(),
        marketType: f.marketType,
        dayType: f.dayType,
        feeGroupId: f.feeGroupId,
        actualGrossFee: f.actualGrossFee,
        productType: sec.productType,
        bondTaxExempt:
          !f.bondTaxExempt || f.bondTaxExempt === "unknown" ? undefined : f.bondTaxExempt === "yes",
        ruleSnapshot: {
          ...account.profile,
          discountTenths: f.discountTenths,
          marginRatio: f.creditType === "margin" ? dec(f.marginRatio).div(100).toString() : "0",
          annualRate:
            f.creditType === "margin" ? dec(f.annualRate || "6.45").div(100).toString() : "0",
        },
      };
      if (
        dec(tx.qty).lte(0) ||
        !dec(tx.qty).isInteger() ||
        dec(tx.price).lte(0)
      )
        throw Error("股數須為正整數、單價須為正數");
      if (original) {
        draft.audit.push({
          id: newId(),
          at: new Date().toISOString(),
          kind: "交易修訂前版本",
          details: JSON.stringify(original),
        });
        draft.trades = draft.trades.filter((t) => t.id !== original.id);
        draft.allocations = draft.allocations.filter(
          (x) =>
            x.closeTradeId !== original.id && x.openTradeId !== original.id,
        );
      }
      draft.trades.push(tx);
      if (f.pairedTradeId) {
        if (!f.dayType) throw Error("配對成交前請選擇當沖類型");
        const other = draft.trades.find((t) => t.id === f.pairedTradeId);
        const qty = dec(f.dayQty || f.qty).toString();
        const ordered = [other, tx].sort((a, b) => a.sequence - b.sequence);
        draft.allocations.push({
          id: newId(),
          openTradeId: ordered[0].id,
          closeTradeId: ordered[1].id,
          kind: f.dayType,
          qty,
        });
        result(
          validateDayTrade(
            draft.trades,
            draft.allocations.filter((x) =>
              ["cash-day", "cash-first", "credit-day"].includes(x.kind),
            ),
            state.market.securities,
          ),
        );
      }
      for (const [key, qty] of Object.entries(f))
        if (key.startsWith("lot:") && qty && Number(qty) > 0)
          draft.allocations.push({
            id: newId(),
            openTradeId: key.slice(4),
            closeTradeId: tx.id,
            qty: dec(qty).toString(),
            kind:
              tx.creditType === "margin"
                ? "margin-close"
                : tx.creditType === "short"
                  ? "short-cover"
                  : "cash-close",
          });
      const preview = result(valueAccount(draft, state.market, state.date));
      dialog(
        "確認交易試算",
        table(
          ["項目", "結果"],
          [
            ["估值日期", E(state.date)],
            ["交易後淨資產", num(preview.equity, 2)],
            [
              "原始手續費",
              num(
                preview.tradeDetails.find((t) => t.id === tx.id)?.grossFee,
                2,
              ),
            ],
            [
              "待退折讓",
              num(preview.tradeDetails.find((t) => t.id === tx.id)?.rebate, 2),
            ],
            [
              "本筆交易稅",
              num(preview.tradeDetails.find((t) => t.id === tx.id)?.tax, 2),
            ],
          ],
        ) + note(preview.warnings.join("；")),
        async () =>
          save(
            draft,
            original ? "修訂交易" : "新增交易",
            `${tx.date} ${tx.code} ${tx.qty}股`,
          ),
        "確認套用",
      );
    },
    "確認儲存",
    (form) => {
      const el = form.elements;
      const sec = state.market.securities.find(s => s.code === el.code.value.trim());
      if (el.code.value && !sec) el.code.setCustomValidity("查無商品，請輸入清單內的股票／ETF代號");
      if (el.marketType.value === "odd" && (el.creditType.value !== "cash" || el.dayType.value))
        el.marketType.setCustomValidity("零股不支援融資、融券或當沖，請改選整股市場或現股留倉");
      if (el.pairedTradeId.value && !el.dayType.value)
        el.dayType.setCustomValidity("配對成交前請選擇當沖類型");
      if (sec?.productType === "bond-etf" && el.side.value === "sell" && el.bondTaxExempt.value === "unknown")
        el.bondTaxExempt.setCustomValidity("請先確認債券ETF免稅資格");
    },
  );
  wireTradeForm(form,{accounts:state.book.accounts,securities:state.market.securities},validate);
}
function openingPositionForm(original) {
      const { form, validate } = dialog(
        original?"編輯起始持股":"新增起始持股",
        `<div class="form-grid">${selectAccount(original?.accountId)}${field("code", "商品代號", "text", original?.code??"", "required")}${field("acquiredDate","原始買進／建倉日期","date",original?.acquiredDate??state.book.openingDate,`required max="${state.book.openingDate}"`)}${select(
          "creditType",
          "部位類型",
          [
            ["cash", "現股"],
            ["margin", "融資"],
            ["short", "融券"],
          ],
          original?.creditType??"cash",
        )}${field("qty", "起始股數", "number", original?.qty??"1000", 'min="1" step="1" required')}${field("price", "平均成本／融券賣價", "number", original?.price??"", 'min="0.01" step="0.01" required')}${field("marginRatio", "融資成數（%，例如60代表六成）", "number", original?.marginRatio?Number(original.marginRatio)*100:"60", 'min="0.01" max="100" step="0.01" required')}${field("principal", "未償融資本金（自動估算，可修改）", "number", original?.principal??"0", 'min="0.01" step="any" required')}${field("annualRate", "融資年利率（%，預設6.45）", "number", Number(original?.annualRate??DEFAULT_PROFILE.annualRate)*100, 'min="0" step="0.001" required')}${field("restricted", "已繳融券擔保款＋保證金", "number", original?.restricted??"0", 'min="0" step="0.01" required')}${field("interestStart","融資計息起日（買進T+2，可校正）","date",original?.interestStart??(original?state.book.openingDate:""),"required")}${field("accruedInterest", "啟用前已累計未付利息（自動估算，可修改）", "number", original?.accruedInterest??"0", 'min="0" step="any" required')}</div><input type="hidden" name="interestMode"><div class="button-row"><button type="button" id="opening-recalculate" class="btn secondary">依成數重算本金</button><button type="button" id="opening-interest-recalculate" class="btn secondary">依日期重估利息</button></div><p id="opening-principal-status" class="note"></p><p id="opening-interest-status" class="note"></p>${note("起始部位不再次扣現金；現金欄位應填投入這些部位後實際剩餘金額。融資成數用平均買進成本估算，不用目前股價。日期以帳本開始追蹤日為界，之後買進請新增交易；啟用前利息按本金、利率不變估算，若曾還款／調息，請填券商實際累計利息。")}`,
        async (f) => {
          if (!state.market.securities.some((s) => s.code === f.code.trim()))
            throw Error("商品代號不存在");
          const b = structuredClone(state.book);
          const position={
            ...original,
            ...f,
            code: f.code.trim(),
            id: original?.id??newId(),
            date: b.openingDate,
            principal: f.creditType === "margin" ? dec(f.principal).toString() : "0",
            marginRatio: f.creditType === "margin" ? dec(f.marginRatio).div(100).toString() : "0",
            restricted: f.creditType === "short" ? dec(f.restricted).toString() : "0",
            accruedInterest: f.creditType === "cash" ? "0" : dec(f.accruedInterest || "0").toString(),
            annualRate: f.creditType === "margin" ? dec(f.annualRate || "6.45").div(100).toString() : "0",
          };
          if(original)b.openingPositions[b.openingPositions.findIndex(p=>p.id===original.id)]=position;
          else b.openingPositions.push(position);
          result(buildSnapshots(b,state.market,state.date));
          if(original)await commitRepair(b,"編輯起始持股",original.id);
          else await save(b, "新增起始部位", f.code);
        },
        "確認儲存",
        (form) => {
          const el = form.elements;
          if (el.code.value && !state.market.securities.some(s => s.code === el.code.value.trim()))
            el.code.setCustomValidity("查無商品，請核對股票／ETF代號");
          if (el.creditType.value === "margin" && !(Number(el.principal.value) > 0))
            el.principal.setCustomValidity("融資起始部位請填寫大於0的未償融資本金");
          if(el.creditType.value==='margin'&&el.interestStart.value&&el.interestStart.value<el.acquiredDate.value)
            el.interestStart.setCustomValidity('計息起日不可早於原始買進日');
          if (el.creditType.value === "short" && !(Number(el.restricted.value) > 0))
            el.restricted.setCustomValidity("融券起始部位請填寫已繳擔保款與保證金");
        },
      );
      form.classList.add("trade-form");
      wireOpeningPosition(form, state.book.accounts, validate,{openingDate:state.book.openingDate,calendar:state.market.calendar,original});
}

async function commitRepair(draft, kind, detail) {
  const previous = await exportBackup(state.book);
  const url = URL.createObjectURL(new Blob([previous], {type:"application/json"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = `daily-equity-before-repair-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  recordAudit(draft, kind, detail);
  state.book = result(await state.store.save(draft, state.book.revision));
  state.cached = null;
  render();
}
function repairRecordForm(collection, id) {
  const original = state.book[collection]?.find(r => r.id === id);
  if (!original) throw Error("找不到原始紀錄");
  const defs = [];
  const add = (key,label,value,min="0",scale=1,step="0.01") => defs.push({key,label,value,min,scale,step});
  if (collection === "accounts") {
    add("openingCash","期初已交割現金",original.openingCash, null);
    const profile = original.profile ?? {};
    for (const [key,label,scale,max] of [
      ["feeRate","基礎手續費率（%）",100], ["discountTenths","手續費打幾折",1,10],
      ["minRegular","整股最低手續費",1], ["minOdd","零股最低手續費",1],
      ["marginRatio","融資成數（%）",100,100], ["annualRate","融資年利率（%）",100],
      ["shortMarginRatio","融券保證金（%）",100], ["interestBasis","計息年度日數",1],
      ["maintenanceThreshold","維持率提醒門檻（%）",1],
    ]) {
      const v = profile[key] === "" || profile[key] == null ? DEFAULT_PROFILE[key] : profile[key];
      add("profile."+key,label,Number(v)*scale,key==="interestBasis"?"1":"0",scale,"any");
      defs.at(-1).max=max;
    }
  } else {
    add("qty","股數",original.qty,"1",1,"1");
    add("price","成交單價／平均成本",original.price,"0.000001",1,"any");
    if (collection === "openingPositions") {
      add("principal","未償融資本金",original.principal ?? "0",original.creditType==="margin"?"0.01":"0");
      add("restricted","已繳融券擔保款與保證金",original.restricted || "0",original.creditType==="short"?"0.01":"0");
      add("accruedInterest","啟用前累計未付利息",original.accruedInterest || "0");
      add("annualRate","融資年利率（%，缺漏預設6.45）",Number(original.annualRate || DEFAULT_PROFILE.annualRate)*100,"0",100,"any");
    } else {
      const profile=original.ruleSnapshot ?? state.book.accounts.find(a=>a.id===original.accountId)?.profile ?? DEFAULT_PROFILE;
      for(const [key,label,scale,max] of [["discountTenths","本筆手續費打幾折",1,10],["marginRatio","本筆融資成數（%）",100,100],["annualRate","本筆融資年利率（%）",100],["feeRate","本筆基礎手續費率（%）",100],["minRegular","整股最低手續費",1],["minOdd","零股最低手續費",1]]) {
        const v=profile[key] === "" || profile[key] == null ? DEFAULT_PROFILE[key] : profile[key];
        add("ruleSnapshot."+key,label,Number(v)*scale,"0",scale,"any"); defs.at(-1).max=max;
      }
    }
  }
  const title = collection === "accounts" ? original.name : `${original.code} · ${id}`;
  dialog("修正數值 · " + title,
    note("核對下列數值。股數與價格不會猜測；空白選填費用可補0，融資利率先帶6.45%。確認前會顯示差異，套用前會下載原帳備份。")+
    `<div class="form-grid">${defs.map(d=>field(d.key,d.label,"number",d.value,`required step="${d.step}" ${d.min!=null?`min="${d.min}"`:""} ${d.max!=null?`max="${d.max}"`:""}`)).join("")}</div>`,
    async (f) => {
      const next=structuredClone(original), changes=[];
      for(const d of defs) {
        const keys=d.key.split("."); let obj=next;
        for(const k of keys.slice(0,-1)) obj=obj[k] ??= {};
        const key=keys.at(-1), old=obj[key], value=dec(f[d.key]).div(d.scale).toString();
        if(String(old)!==value) changes.push([d.label,E(old === "" || old == null ? "未填" : old),E(value)]);
        obj[key]=value;
      }
      if(!changes.length) throw Error("數值沒有變更，請修正後再預覽或取消");
      const draft=structuredClone(state.book);
      draft[collection][draft[collection].findIndex(r=>r.id===id)]=next;
      const check=buildSnapshots(draft,state.market,state.date);
      dialog("修正差異預覽",table(["欄位","原始值","修正值（儲存單位）"],changes)+note(check.ok ? "修正後帳本可完成淨值計算。" : "這筆修正可儲存，但帳本仍有其他問題："+check.errors.map(e=>e.message).join("；")),
        async()=>commitRepair(draft,"修正原始紀錄",JSON.stringify({collection,id,before:original,after:next})),"備份並套用修正");
    }, "預覽修正");
}
async function action(name, target) {
  const v =
    state.book &&
    [
      "receive-rebate",
      "confirm-event",
      "revise-event",
      "theme-detail",
      "industry-detail",
    ].includes(name)
      ? makeView()
      : null;
  switch (name) {
    case "market-correction": {
      const before = valueAccount(state.book, state.market, state.date),
        after = valueAccount(state.book, state.incomingMarket, state.date);
      dialog(
        "歷史行情修訂與重算預覽",
        table(
          ["股票／指數", "日期", "原價格", "新價格"],
          state.marketCorrection
            .slice(0, 30)
            .map((x) => [
              E(x.code),
              E(x.date),
              num(x.before, 2),
              num(x.after, 2),
            ]),
        ) +
          note(
            `原淨資產 ${num(before.value?.equity, 2)}；重算後 ${num(after.value?.equity, 2)}。確認前不套用新歷史價格。`,
          ),
        async () => {
          if (!after.ok) throw Error(after.errors[0].message);
          const diff = state.marketCorrection;
          state.market = state.incomingMarket;
          state.marketCorrection = [];
          await save(
            structuredClone(state.book),
            "接受行情修訂",
            JSON.stringify(diff),
          );
        },
        "確認重算",
      );
      break;
    }
    case "close-modal":
      modal.close();
      break;
    case "create-book": {
      const {form}=dialog(
        "建立自己的帳本",
        `<div class="form-grid">${field("name", "帳戶名稱", "text", "主要證券帳戶", "required")}${field("openingDate", "開始追蹤日期", "date", state.market.asOf, 'required max="' + taipeiToday() + '"')}</div>${openingAssetFields({rebateMonth:state.market.asOf.slice(0,7)})}${note("這裡填尚未包含持股的現金。建立後可新增起始持股、融資與融券；之後也能補登更早紀錄。")}`,
        async (f) => {
          state.namespace = "personal";
          state.store = await openBookStore("personal");
          const existing = await state.store.load();
          if (existing) throw Error("已有個人帳本，請回到設定切換");
          const b = applyOpeningAssets(createBook("personal", f.openingDate),{...f,accountId:"default"},state.market.calendar);
          b.accounts[0].name = f.name;
          b.accounts[0].openingCash = dec(f.cash).toString();
          b.themes = structuredClone(seeds);
          state.book = result(await state.store.save(b, 0));
          await hydrateMarketContext();
          localStorage.setItem("stock-daily-namespace", "personal");
          state.date = state.market.asOf;
          state.cached = null;
          render();
        },
        "確認儲存",validateOpeningAssets(state.market.asOf,state.market.calendar),
      );
      wireOpeningAssets(form,state.market.asOf,state.market.calendar);
      break;
    }
    case "demo":
    case "switch-book": {
      const ns =
        name === "demo" ? "demo" : state.book.demo ? "personal" : "demo";
      state.store?.close();
      state.namespace = ns;
      state.store = await openBookStore(ns);
      state.book = await state.store.load();
      if (!state.book && ns === "demo") {
        const b = createDemo(state.market);
        b.themes = structuredClone(seeds);
        state.book = result(await state.store.save(b, 0));
      }
      await hydrateMarketContext();
      localStorage.setItem("stock-daily-namespace", ns);
      state.account = "all";
      state.cached = null;
      render();
      break;
    }
    case "trade":
      tradeForm();
      break;
    case "delete-trade":
    case "delete-opening": {
      const id = target.dataset.id, collection = name === "delete-trade" ? "trades" : "openingPositions";
      const original = state.book[collection].find(r => r.id === id);
      if (!original) throw Error("找不到這筆紀錄，請重新整理");
      const draft = collection === "trades" ? deleteTrade(state.book, id, newId()) : pauseRecord(state.book, collection, id, newId());
      draft.quarantine.at(-1).deleted = true;
      const before = buildSnapshots(state.book, state.market, state.date), after = buildSnapshots(draft, state.market, state.date);
      const linked = draft.quarantine.at(-1).allocations.length;
      if(before.ok && !after.ok) {
        dialog("這筆紀錄目前不能單獨刪除",note("刪除後，其他交易無法完成計算。請先修訂或刪除依賴這筆部位的平倉／賣出交易。")+note(after.errors.map(e=>e.message).join("；")),async()=>{},"關閉");
        break;
      }
      const rows = [["紀錄",E(original.date??state.book.openingDate)+" · "+E(original.code)+" · "+num(original.qty)+"股"],["成交價／成本",num(original.price,2)],["一併移除的沖銷配對",String(linked)],["刪除前總淨資產",num(before.value?.at(-1)?.equity,2)],["刪除後總淨資產",num(after.value?.at(-1)?.equity,2)]];
      dialog(collection === "trades" ? "確認刪除交易" : "確認刪除起始持股",table(["項目","內容"],rows)+note("費用、交割與歷史淨值會重新計算。確認後先下載完整備份，原紀錄保留在帳本修復頁，可恢復。")+(!after.ok?note("還有其他資料待修正："+after.errors.map(e=>e.message).join("；")):""),
        async()=>commitRepair(draft,"刪除輸入紀錄",JSON.stringify({collection,id,before:original})),"備份並刪除");
      break;
    }
    case "edit-trade":
      tradeForm(
        structuredClone(
          state.book.trades.find((t) => t.id === target.dataset.id),
        ),
      );
      break;
    case "opening-assets": {
      const id=target.dataset.id || (state.account==="all"?state.book.accounts[0].id:state.account);
      const initial=readOpeningAssets(state.book,id,state.market.calendar);
      const {form}=dialog("設定起始資產",note(`帳戶：${state.book.accounts.find(a=>a.id===id).name}；開始追蹤日：${state.book.openingDate}。修改後會重新計算此日起的資產。`)+openingAssetFields(initial),async f=>{
        const draft=applyOpeningAssets(state.book,{...f,accountId:id},state.market.calendar);
        const check=buildSnapshots(draft,state.market,state.date);if(!check.ok)throw Error(check.errors.map(e=>e.message).join("；"));
        await commitRepair(draft,"設定起始資產",JSON.stringify({accountId:id,...f}));
      },"確認儲存",validateOpeningAssets(state.book.openingDate,state.market.calendar));
      wireOpeningAssets(form,state.book.openingDate,state.market.calendar);
      break;
    }
    case "add-account":
      accountForm();
      break;
    case "edit-account":
      accountForm(
        structuredClone(
          state.book.accounts.find((a) => a.id === target.dataset.id),
        ),
      );
      break;
    case "opening-position":
      openingPositionForm();
      break;
    case "edit-opening": {
      const position=state.book.openingPositions.find(p=>p.id===target.dataset.id);
      if(!position)throw Error("找不到起始持股");
      openingPositionForm(structuredClone(position));
      break;
    }
    case "cashflow":
      dialog(
        "新增入出金",
        `<div class="form-grid">${selectAccount()}${field("date", "日期（收盤後）", "date", state.date, 'required min="' + state.book.openingDate + '"')}${field("amount", "金額：入金正數、出金負數", "number", "", 'step="0.01" required')}${select("toAccount", "轉入另一帳戶（選填）", [["", "外部入出金"], ...accountOptions()])}</div>`,
        async (f) => {
          const b = structuredClone(state.book),
            amount = dec(f.amount);
          if (f.toAccount && f.toAccount === f.accountId)
            throw Error("轉入帳戶不可相同");
          b.cashFlows.push({
            id: newId(),
            accountId: f.accountId,
            date: f.date,
            amount: amount.toString(),
            internal: !!f.toAccount,
          });
          if (f.toAccount) {
            if (amount.gte(0)) throw Error("內部轉帳請在轉出帳戶填負數");
            b.cashFlows.push({
              id: newId(),
              accountId: f.toAccount,
              date: f.date,
              amount: amount.neg().toString(),
              internal: true,
            });
          }
          result(buildSnapshots(b, state.market, state.date));
          await save(b, "新增入出金", `${f.date} ${f.amount}`);
        },
      );
      break;
    case "adjust-fee":
      dialog(
        "實際帳單費用校正",
        `<div class="form-grid">${selectAccount()}${field("date", "認列日期", "date", state.date, "required")}${field("amount", "相較原估算需增加的費用（減少填負數）", "number", "", 'step="0.000001" required')}${select(
          "paid",
          "是否已扣款",
          [
            ["no", "未扣款，列應付"],
            ["yes", "已從現金扣款"],
          ],
        )}${field("reason", "帳單／原始費用關聯說明", "text", "", "required")}</div>${note("只輸入相對估算的差額，不要再次輸入已認列的全部費用。")}`,
        async (f) => {
          const b = structuredClone(state.book);
          b.feeAdjustments.push({
            id: newId(),
            accountId: f.accountId,
            date: f.date,
            amount: dec(f.amount).toString(),
            paid: f.paid === "yes",
            reason: f.reason,
          });
          await save(b, "費用校正", f.reason);
        },
      );
      break;
    case "receive-rebate": {
      const r = v.rebates.find((x) => x.id === target.dataset.id);
      dialog(
        "確認折讓實際入帳",
        `<div class="form-grid">${field("date", "實際入帳日期", "date", state.date, "required")}${field("amount", "實際收到金額", "number", r.amount, 'min="0" step="0.01" required')}</div>${note("應收轉現金不再增加收益；只有估算與實收的差額影響損益。")}`,
        async (f) => {
          const b = structuredClone(state.book);
          b.rebateReceipts.push(
            result(
              confirmRebate(
                { ...r, received: b.rebateReceipts.some((x) => x.id === r.id) },
                f.amount,
                f.date,
              ),
            ),
          );
          await save(b, "折讓實收", r.month);
        },
      );
      break;
    }
    case "manual-event":
    case "confirm-event":
    case "revise-event": {
      const old =
        name === "confirm-event" || name === "revise-event"
          ? v.reminders.find((e) => e.id === target.dataset.id)
          : {};
      dialog(
        "預填／確認持股事件",
        ` ${old?.revised ? note(`公告修訂：原每股 ${old.previous?.perShare ?? "—"} → 新公告 ${old.perShare ?? "—"}；原應收 ${num(old.previous?.amount, 2)}。確認後才重算，既有收款紀錄會保留。`) : ""}<div class="form-grid">${selectAccount(old?.accountId)}${field("code", "商品代號", "text", old?.code ?? "", "required")}${select(
          "kind",
          "事件類型",
          [
            ["cash-dividend", "現金股利"],
            ["stock-dividend", "股票股利"],
            ["conference", "法說會"],
            ["meeting", "股東會"],
          ],
          old?.kind,
        )}${field("exDate", "除權息日／事件日", "date", old?.exDate ?? old?.date ?? state.date, "required")}${field("qty", "確認符合資格的股數", "number", old?.previous?.qty ?? "", 'min="0" step="1"')}${field("perShare", "每股現金股利", "number", old?.perShare ?? "", 'min="0" step="0.000001"')}${field("ratio", "配股比例（例如10%填0.1）", "number", old?.ratio ?? old?.previous?.ratio ?? "", 'min="0" step="0.000001"')}${field("paymentDate", "預計發放／交付日", "date", old?.paymentDate ?? "")}${field("sourceUrl", "公告網址（選填）", "url", old?.sourceUrl ?? "")}</div>${note("資格股數請核對除權息前部位；啟用前紀錄不足時不能由今天股數推算。")}`,
        async (f) => {
          const b = structuredClone(state.book);
          if (["conference", "meeting"].includes(f.kind)) {
            b.localEvents ??= [];
            b.localEvents.push({
              id: newId(),
              code: f.code.trim(),
              kind: f.kind,
              date: f.exDate,
              title: f.kind === "conference" ? "法說會" : "股東會",
              sourceUrl: f.sourceUrl,
            });
          } else {
            if (
              !f.qty ||
              (f.kind === "cash-dividend" && !f.perShare) ||
              (f.kind === "stock-dividend" && !f.ratio)
            )
              throw Error("請填資格股數與股利金額／配股比例");
            const eventId = old?.eventId ?? old?.id ?? newId();
            const existing = b.confirmations.find(
              (c) =>
                c.eventId === eventId &&
                c.accountId === f.accountId &&
                c.kind === f.kind,
            );
            if (existing && name !== "revise-event")
              throw Error("此帳戶的事件已確認");
            const p = {
              ...(existing ?? {}),
              ...f,
              id: existing?.id ?? newId(),
              eventId,
              eventVersion: old?.version ?? "manual-1",
            };
            if (existing) {
              p.receipts = receiptsOf(existing);
              b.audit.push({
                id: newId(),
                at: new Date().toISOString(),
                kind: "公告修訂前版本",
                details: JSON.stringify(existing),
              });
            }
            const next = result(confirmEntitlement(p, {}));
            if (existing)
              b.confirmations[
                b.confirmations.findIndex((c) => c.id === existing.id)
              ] = next;
            else b.confirmations.push(next);
          }
          await save(b, "確認持股事件", f.code + " " + f.kind);
        },
      );
      break;
    }
    case "receive-dividend": {
      const c = state.book.confirmations.find(
        (x) => x.id === target.dataset.id,
      );
      dialog(
        "確認股利入帳／股票交付",
        `<div class="form-grid">${field("date", "實際日期", "date", state.date, "required")}${
          c.kind === "cash-dividend"
            ? field(
                "amount",
                "實際收到金額（扣費後）",
                "number",
                dec(c.amount)
                  .minus(sum(receiptsOf(c).map((r) => r.entitlement)))
                  .toString(),
                'min="0" step="0.01" required',
              )
            : note("將待交付股數標記為已交付，不再次增加淨資產。")
        }</div>`,
        async (f) => {
          if (f.date < c.exDate) throw Error("入帳日不可早於除權息日");
          const b = structuredClone(state.book),
            x = b.confirmations.find((y) => y.id === c.id);
          x.receivedDate = f.date;
          if (c.kind === "cash-dividend") {
            const previous = receiptsOf(c);
            const paid = sum(previous.map((r) => r.entitlement));
            const outstanding = dec(c.amount).minus(paid);
            if (outstanding.lte(0)) throw Error("此股利已核對入帳");
            x.receipts = [
              ...previous,
              {
                id: newId(),
                date: f.date,
                entitlement: outstanding.toString(),
                actualAmount: f.amount,
              },
            ];
            x.actualAmount = f.amount;
            x.receiptEntitlement = c.amount;
          }
          await save(b, "確認股利入帳", c.code);
        },
      );
      break;
    }
    case "theme": {
      dialog(
        "新增／編輯題材成分",
        `<div class="form-grid">${select("id", "選擇題材", [["", "新增題材"], ...(state.book.themes.length ? state.book.themes : seeds).map((t) => [t.id, t.name])])}${field("name", "題材名稱（新增時必填）")}${field("from", "成分生效日", "date", state.date, 'required min="2026-09-01"')}${field("codes", "成分代號，以逗號分隔", "text", "", "required")}${field("source", "分類依據／來源網址", "text", "", "required")}</div>${note("此操作建立有生效日的成分版本；之前的排名仍使用舊成分。首次建立可將日期設為9/1。")}`,
        async (f) => {
          const codes = [...new Set(f.codes.split(/[,，\s]+/).filter(Boolean))];
          if (
            codes.some(
              (c) => !state.market.securities.some((s) => s.code === c),
            )
          )
            throw Error("含未知股票代號");
          const b = structuredClone(state.book);
          if (!b.themes.length) b.themes = structuredClone(seeds);
          let t = b.themes.find((x) => x.id === f.id);
          if (!t) {
            if (!f.name) throw Error("請填題材名稱");
            t = { id: newId(), name: f.name, members: [] };
            b.themes.push(t);
          }
          t.members = t.members.map((m) => (!m.to ? { ...m, to: f.from } : m));
          t.members.push(
            ...codes.map((code) => ({ code, from: f.from, source: f.source })),
          );
          t.seedManaged = false;
          t.version = String((Number(t.version) || 0) + 1);
          await save(b, "題材成分版本", t.name);
        },
      );
      break;
    }
    case "industry-detail": {
      const t = v.industries.find(t=>t.id===target.dataset.id);
      if(!t) throw Error("找不到產業分類");
      const rows=t.members.map(member=>[
        E(member.code+" "+v.securityName(member.code)),
        member.market === "twse" ? "上市" : "上櫃",
        ...[1,5,20].map(n=>{
          const r=periodThemeReturn({members:[member]},state.market,state.market.asOf,n,"equal");
          return r.ok ? `<span class="${color(r.value.return)}">${pct(r.value.return)}</span>` : `<span class="muted" title="${E(r.errors[0].message)}">資料不足</span>`;
        }),
      ]);
      dialog(t.name+" · 官方分類成分股",note(`分類代碼 ${t.code} · ${t.members.length}檔，依目前官方公司分類整理，非歷史當時成分。`)+table(["股票代號／名稱","市場","近1日","近5日","近20日"],rows),async()=>{},"關閉");
      break;
    }
    case "theme-detail": {
      const t = v.themeMetrics.find((x) => x.id === target.dataset.id);
      const rows = constituentsAt(t, state.market.asOf).map((m) => {
        const one = { members: [m] };
        return [
          E(m.code + " " + v.securityName(m.code)) + (m.role ? `<small class="block">${E(m.role)}</small>` : ""),
          ...[1, 5, 20].map((n) => {
            const r = periodThemeReturn(
              one,
              state.market,
              state.market.asOf,
              n,
              "equal",
            );
            return pct(r.value?.return);
          }),
          safeLink(m.source),
        ];
      });
      dialog(
        t.name + " · 成分報酬",
        table(["股票", "近1日", "近5日", "近20日", "歸類依據"], rows) +
          note(
            "公開來源整理的觀察名單，非完整產業。以目前名單回看9/1後表現，並非當時已知成分；每檔附歸類來源，可自行調整。",
          ),
        async () => {},
        "關閉",
      );
      break;
    }
    case "export": {
      const b = structuredClone(state.book);
      b.lastBackupAt = state.date;
      b.eventsSinceBackup = 0;
      recordAudit(b, "匯出備份", "原始帳本完整備份");
      state.book = result(await state.store.save(b, state.book.revision));
      state.cached = null;
      render();
      const blob = new Blob([await exportBackup(state.book)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `daily-equity-${state.namespace}-${state.date}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("完整備份已匯出");
      break;
    }
    case "import":
      document.getElementById("backup-file").click();
      break;
    case "history":
      dialog(
        "補登較早的起始資料",
        `<div class="form-grid">${selectAccount()}${field("openingDate", "較早啟用日", "date", state.book.openingDate, 'required max="' + state.book.openingDate + '"')}${field("openingCash", "該日起始已交割現金", "number", state.book.accounts[0].openingCash, 'step="0.01" required')}</div><label class="field"><span>該日起始持倉（JSON；留空沿用，請另核對）</span><textarea name="openingPositions" rows="6" placeholder="可從完整備份的openingPositions欄位複製並修正"></textarea></label>${note("原起始餘額會被取代，不會再計入一份。請先補齊早期交易與入出金，並檢查重算預覽。")}`,
        async (f) => {
          const p = result(
            prepareRebuild(
              state.book,
              {
                ...f,
                openingPositions: f.openingPositions
                  ? JSON.parse(f.openingPositions)
                  : undefined,
              },
              state.market,
            ),
          );
          dialog(
            "歷史重算差異預覽",
            table(
              ["原啟用日項目", "原餘額", "重算後"],
              p.diff.map((x) => [E(x.key), num(x.before, 2), num(x.after, 2)]),
            ) +
              note(
                "股數核對：" +
                  (p.anchorChecks.positions.matches ? "相符" : "有差異") +
                  "。差異未釐清前建議取消；確認套用前將下載舊帳備份。",
              ),
            async () => {
              const old = await exportBackup(state.book);
              const a = document.createElement("a"),
                url = URL.createObjectURL(
                  new Blob([old], { type: "application/json" }),
                );
              a.href = url;
              a.download = "daily-equity-before-rebuild.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              state.book = result(
                await commitRebuild(state.store, p, state.book.revision),
              );
              state.cached = null;
              render();
            },
            "已核對，確認套用",
          );
        },
      );
      break;
    case "benchmarks":
      dialog(
        "自選ETF比較基準",
        field(
          "codes",
          "ETF代號，以逗號分隔",
          "text",
          (state.book.benchmarks ?? []).join(","),
        ) + note("加權、櫃買固定保留。ETF使用價格報酬，不含配息再投資。"),
        async (f) => {
          const codes = f.codes.split(/[,，\s]+/).filter(Boolean);
          if (
            codes.some(
              (c) =>
                !["etf", "bond-etf"].includes(
                  state.market.securities.find((s) => s.code === c)
                    ?.productType,
                ),
            )
          )
            throw Error("請選有效ETF代號");
          const b = structuredClone(state.book);
          b.benchmarks = [...new Set(codes)];
          await save(b, "比較基準", codes.join(","));
        },
      );
      break;
    case "settings-recovery":
      modal.close();
      location.hash = "recovery";
      render();
      break;
    case "repair-record":
      repairRecordForm(target.dataset.collection, target.dataset.id);
      break;
    case "repair-account":
      repairRecordForm("accounts", target.dataset.id);
      break;
    case "pause-record": {
      const collection = target.dataset.collection, id = target.dataset.id;
      const draft = pauseRecord(state.book, collection, id, newId());
      dialog("暫停一筆紀錄", note(`將暫停「${RECOVERABLE[collection]}」${id}，以及連結它的沖銷配對。原始資料會保留，可隨時恢復。`) + note("請核對是否為剛才輸入的那一筆；確認後先下載完整備份。"),
        async () => commitRepair(draft, "暫停原始紀錄", `${collection}:${id}`), "備份並暫停");
      break;
    }
    case "restore-record": {
      const draft = restoreRecord(state.book, target.dataset.id);
      dialog("恢復已暫停的紀錄", note("恢復後重新納入計算；若原資料仍不完整，計算提示也會再次出現，仍可回到修復頁。"),
        async () => commitRepair(draft, "恢復原始紀錄", target.dataset.id), "確認恢復");
      break;
    }
  }
}
app.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (t) action(t.dataset.action, t).catch((e) => toast(e.message, true));
});
modal.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (t) action(t.dataset.action, t).catch((e) => toast(e.message, true));
});
document.addEventListener("change", async (e) => {
  try {
    if (e.target.id === "account-select") {
      state.account = e.target.value;
      render();
    }
    if (e.target.id === "asof-date") {
      state.date = e.target.value;
      render();
    }
    if (e.target.id === "weight-select") {
      state.weighting = e.target.value;
      render();
    }
    if (e.target.id === "market-sort") {
      state.marketSort=e.target.value;
      render();
    }
    if (e.target.id === "index-select") {
      state.indexCode = e.target.value;
      render();
    }
    if (e.target.id === "backup-file") {
      const file = e.target.files[0];
      if (!file) return;
      const b = result(await inspectBackup(await file.text()));
      dialog(
        "確認匯入備份",
        note(
          `含${b.accounts.length}個帳戶、${b.trades.length}筆交易，將替換目前帳本；正式套用前下載舊帳備份。`,
        ),
        async () => {
          const prior = await exportBackup(state.book),
            url = URL.createObjectURL(
              new Blob([prior], { type: "application/json" }),
            ),
            a = document.createElement("a");
          a.href = url;
          a.download = "daily-equity-before-import.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          b.namespace = state.namespace;
          b.demo = state.namespace === "demo";
          await save(b, "匯入完整備份", file.name);
        },
      );
    }
  } catch (ex) {
    toast(ex.message, true);
  }
});
window.addEventListener("hashchange", render);
try {
  state.store = await openBookStore(state.namespace);
  state.book = await state.store.load();
  state.market = await loadMarket("./");
  state.incomingMarket = state.market;
  const r = await fetch(new URL("data/themes.seed.json", location.href));
  seeds = await r.json();
  await hydrateMarketContext();
  state.store.channel?.addEventListener("message", () =>
    toast("另一個分頁已更新資料，請重新整理後再編輯", true),
  );
  render();
} catch (e) {
  app.innerHTML = shell(
    card(
      "資料尚未準備好",
      `<p>${E(e.message)}</p>${note("請先執行公開資料更新，再重新整理。個人帳本不會因此被刪除。")}${state.book ? button("export", "匯出完整備份") : ""}`,
    ),
    "overview",
    "資產總覽",
  );
}
