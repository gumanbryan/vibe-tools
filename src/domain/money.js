import Decimal from "decimal.js";
export const D = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});
export const dec = (x) => {
  const n = new D(x);
  if (!n.isFinite()) throw Error("金額必須是有限數值");
  return n;
};
export const sum = (xs) => xs.reduce((a, x) => a.plus(x), dec(0));
export const str = (x) => dec(x).toString();
