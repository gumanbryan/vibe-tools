import {chartBars,boundedChartRange} from "./market-data.js";
import {
  createChart,
  LineSeries,
  AreaSeries,
  CandlestickSeries,
} from "lightweight-charts";
import { movingAverage } from "../summary/summary.js";
const charts = [];
const observers=[];
const frames=[];
export function clearCharts() {
  for(const o of observers)o.disconnect();
  observers.length=0;
  for(const f of frames)cancelAnimationFrame(f);
  frames.length=0;
  for (const c of charts) c.remove();
  charts.length = 0;
}
function chartAt(id) {
  const element = document.getElementById(id);
  if (!element) return null;
  const chart = createChart(element, {
    autoSize: true,
    localization: { locale: "zh-TW" },
    layout: {
      background: { color: "#ffffff" },
      textColor: "#9298aa",
      fontFamily: "system-ui, sans-serif",
      fontSize: 11,
      attributionLogo: true,
    },
    grid: { vertLines: { visible: false }, horzLines: { color: "#f0f1f6" } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
    crosshair: {
      vertLine: { color: "#c4c2e8" },
      horzLine: { color: "#c4c2e8" },
    },
  });
  charts.push(chart);
  return chart;
}
const clean = (rows) =>
  [
    ...new Map(
      rows
        .filter((x) => x.value != null && Number.isFinite(Number(x.value)))
        .map((x) => [x.time, x]),
    ).values(),
  ].sort((a, b) => a.time.localeCompare(b.time));
export function performanceChart(id, snapshots, benchmarks, mode="amount") {
  const chart = chartAt(id);
  if (!chart) return;
  const mine = chart.addSeries(AreaSeries, {
    lineColor: "#7262db",
    topColor: "rgba(114,98,219,0.14)",
    bottomColor: "rgba(114,98,219,0)",
    lineWidth: 3,
    priceFormat: { type: "custom", formatter: (x) => x.toLocaleString("zh-TW",{maximumFractionDigits:mode==="amount"?0:2}) },
  });
  mine.setData(
    clean(
      snapshots
        .filter((s) => mode==="amount"?s.equity!=null:s.return!=null)
        .map((s) => ({ time: s.date, value: mode==="amount"?Number(s.equity):(1+Number(s.return))*100 })),
    ),
  );
  const colors = ["#2563eb", "#d97706", "#16a34a"];
  if(mode==="comparison")benchmarks.forEach((b, i) => {
    const data = b.bars.filter(
      (x) => x.date >= snapshots[0]?.date && x.date <= snapshots.at(-1)?.date,
    );
    const base = Number(data[0]?.close);
    if (!base) return;
    const line = chart.addSeries(LineSeries, {
      color: b.code === "TAIEX" ? "#2563eb" : b.code === "TPEX" ? "#d97706" : colors[i % colors.length],
      lineWidth: 3,
      lineStyle: 0,
    });
    line.setData(
      clean(
        data.map((x) => ({
          time: x.date,
          value: (Number(x.close) / base) * 100,
        })),
      ),
    );
  });
  chart.timeScale().fitContent();
  return chart;
}
export function marketChart(id, index, to) {
  const chart = chartAt(id);
  if (!chart || !index) return;
  const bars = chartBars(index,to);
  if(!bars.length)return chart;
  chart.applyOptions({handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:true,timeScale:{fixLeftEdge:true,fixRightEdge:true,rightOffset:0}});
  const ohlc = bars.filter((b) => b.open && b.high && b.low && b.close);
  if (ohlc.length) {
    const s = chart.addSeries(CandlestickSeries, {
      upColor: "#df6a75",
      downColor: "#36a78e",
      borderVisible: false,
      wickUpColor: "#df6a75",
      wickDownColor: "#36a78e",
    });
    s.setData(
      ohlc.map((b) => ({
        time: b.date,
        open: +b.open,
        high: +b.high,
        low: +b.low,
        close: +b.close,
      })),
    );
  } else {
    const s = chart.addSeries(LineSeries, { color: "#7262db" });
    s.setData(clean(bars.map((b) => ({ time: b.date, value: +b.close }))));
  }
  for (const [n, c] of [
    [5, "#d9ab57"],
    [20, "#8d79da"],
    [60, "#6eafbd"],
  ]) {
    const s = chart.addSeries(LineSeries, { color: c, lineWidth: 1 });
    s.setData(
      clean(
        movingAverage(bars, n).value.map((x) => ({
          time: x.date,
          value: x.value == null ? null : +x.value,
        })),
      ),
    );
  }
  const fit=()=>chart.timeScale().setVisibleRange({from:bars[0].date,to:bars.at(-1).date});
  const clamp=range=>{
    const bounded=boundedChartRange(range,bars.length);
    if(bounded&&(Math.abs(bounded.from-range.from)>0.000001||Math.abs(bounded.to-range.to)>0.000001))chart.timeScale().setVisibleLogicalRange(bounded);
  };
  chart.timeScale().subscribeVisibleLogicalRangeChange(clamp);
  const observer=new ResizeObserver(()=>clamp(chart.timeScale().getVisibleLogicalRange()));observer.observe(document.getElementById(id));observers.push(observer);
  frames.push(requestAnimationFrame(fit));
  fit();
  return chart;
}
