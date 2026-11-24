import { memo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LANES } from "../../lib/sim";

export const CHARTS = [
  { key: "sr", title: "Decryption success rate", unit: "%", id: "chart-success-rate", domain: [0, 100] },
  { key: "mem", title: "Secrets held in memory", unit: "", id: "chart-memory-states" },
  { key: "lat", title: "Avg recovery latency", unit: "cyc", id: "chart-recovery-latency" },
  { key: "stall", title: "Cumulative pipeline stall", unit: "cyc", id: "chart-pipeline-stalls" },
];

const tip = { background: "#0d1117", border: "1px solid #2a364a", fontFamily: "JetBrains Mono", fontSize: 11 };

export const Chart = ({ c, data, x = "i", light = false, width }) => {
  const grid = light ? "#e2e8f0" : "#1e2633";
  const axis = light ? "#64748b" : "#475569";
  const tick = { fontSize: 10, fontFamily: "JetBrains Mono" };
  const body = (
    <LineChart data={data} width={width} height={width ? 125 : undefined} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
      <CartesianGrid stroke={grid} strokeDasharray="2 4" />
      <XAxis dataKey={x} stroke={axis} tick={tick} unit={x === "loss" ? "%" : ""} />
      <YAxis stroke={axis} domain={c.domain || ["auto", "auto"]} tick={tick} />
      {!light && <Tooltip contentStyle={tip} labelFormatter={(l) => (x === "loss" ? `loss ${l}%` : `pkt #${l}`)} />}
      {LANES.map((m, k) => (
        <Line key={m.id} type="monotone" dataKey={`${c.key}${k}`} name={m.tag} stroke={light ? m.print : m.color}
          strokeWidth={m.proposed ? 2.2 : 1.4} dot={x === "loss" ? { r: 2 } : false} isAnimationActive={false} />
      ))}
    </LineChart>
  );
  if (width) {
    return (
      <div className="report-chart">
        <div className="report-chart-title">{c.title}{c.unit ? ` (${c.unit})` : ""}</div>
        {body}
      </div>
    );
  }
  return (
    <div className="panel p-3" data-testid={c.id}>
      <div className="flex justify-between items-baseline mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">{c.title}</h3>
        <span className="micro">{c.unit}</span>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">{body}</ResponsiveContainer>
      </div>
    </div>
  );
};

export const LaneLegend = () => (
  <div className="flex flex-wrap gap-4 micro">
    {LANES.map((m) => <span key={m.id} className="flex items-center gap-1.5"><i className="w-3 h-0.5 inline-block" style={{ background: m.color }} />{m.tag} {m.name}</span>)}
  </div>
);

export const ComparisonCharts = memo(({ data }) => (
  <section data-testid="comparison-charts-panel">
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
      <h2 className="h2">Live comparison</h2>
      <LaneLegend />
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {CHARTS.map((c) => <Chart key={c.key} c={c} data={data} />)}
    </div>
  </section>
));
