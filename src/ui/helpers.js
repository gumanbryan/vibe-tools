export const E = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const num = (x, d = 0) =>
  x == null
    ? "—"
    : Number(x).toLocaleString("zh-TW", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
export const pct = (x) =>
  x == null ? "—" : (Number(x) >= 0 ? "+" : "") + num(Number(x) * 100, 2) + "%";
export const signed = (x) =>
  x == null ? "—" : (Number(x) > 0 ? "+" : "") + num(x);
export const color = (x) =>
  Number(x) > 0 ? "up" : Number(x) < 0 ? "down" : "muted";
export const badge = (s, kind = "neutral") =>
  `<span class="badge ${kind}">${E(s)}</span>`;
export const button = (action, text, cls = "secondary", extra = "") =>
  `<button type="button" class="btn ${cls}" data-action="${E(action)}" ${extra}>${E(text)}</button>`;
export function table(headers, rows, empty = "目前沒有紀錄") {
  return `<div class="table-scroll"><table><thead><tr>${headers.map((x) => `<th>${E(x)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => "<tr>" + r.map((c) => `<td>${c ?? "—"}</td>`).join("") + "</tr>").join("") : `<tr><td colspan="${headers.length}" class="empty-cell">${E(empty)}</td></tr>`}</tbody></table></div>`;
}
export const field = (name, label, type = "text", value = "", extra = "") =>
  `<label class="field"><span>${E(label)}</span><input name="${E(name)}" type="${type}" value="${E(value)}" ${extra}${type === "number" ? ' inputmode="decimal"' : ""}></label>`;
export const select = (name, label, opts, value = "") =>
  `<label class="field"><span>${E(label)}</span><select name="${E(name)}">${opts.map(([v, l]) => `<option value="${E(v)}" ${String(v) === String(value) ? "selected" : ""}>${E(l)}</option>`).join("")}</select></label>`;
export const note = (text) => `<p class="note">${E(text)}</p>`;
export const card = (title, content, extra = "") =>
  `<section class="card"><div class="card-head"><h2>${E(title)}</h2>${extra}</div>${content}</section>`;
export function safeLink(url, label = "公告來源") {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol)
      ? `<a class="text-link" target="_blank" rel="noopener noreferrer" href="${E(u.href)}">${E(label)} ↗</a>`
      : "";
  } catch {
    return "";
  }
}
