import { useRef, useState } from "react";
import { Play, Square, Download } from "lucide-react";
import { Switch } from "../ui/switch";
import { Btn } from "./ControlBar";
import { Chart, LaneLegend } from "./ComparisonCharts";
import { LANES } from "../../lib/sim";
import { runSweep, sweepCsv, downloadText } from "../../lib/sweep";

export const SWEEP_CHARTS = [
  { key: "sr", title: "Success rate vs loss", unit: "%", id: "sweep-chart-success", domain: [0, 100] },
  { key: "stall", title: "Pipeline stall per 100 packets", unit: "cyc", id: "sweep-chart-stall" },
  { key: "exp", title: "Past packets exposed on leak", unit: "pkts", id: "sweep-chart-exposure" },
];

const Seg = ({ label, options, value, onChange, testId }) => (
  <div className="flex flex-col gap-2">
    <span className="micro">{label}</span>
    <div className="seg" data-testid={testId}>
      {options.map((o) => (
        <button key={o} className={o === value ? "on" : ""} onClick={() => onChange(o)} data-testid={`${testId}-${o}`}>{o}</button>
      ))}
    </div>
  </div>
);

const SweepTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="hw-table" data-testid="sweep-results-table">
      <thead>
        <tr><th>Loss</th>{SWEEP_CHARTS.map((c) => LANES.map((m) => <th key={c.key + m.id}>{m.tag} {c.key === "sr" ? "success" : c.key === "stall" ? "stall" : "exposed"}</th>))}</tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.loss}><td className="num">{r.loss}%</td>{SWEEP_CHARTS.map((c) => LANES.map((m, k) => <td key={c.key + m.id} className="num">{r[`${c.key}${k}`]}</td>))}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const SweepPanel = ({ L, sweep, setSweep }) => {
  const [cfg, setCfg] = useState({ packets: 300, trials: 2, step: 5, burst: false });
  const [prog, setProg] = useState(null);
  const cancel = useRef(false);
  const set = (k) => (v) => setCfg((c) => ({ ...c, [k]: v }));
  const run = async () => {
    cancel.current = false;
    setProg(0);
    const rows = await runSweep({ ...cfg, L, onProgress: setProg, isCancelled: () => cancel.current });
    setProg(null);
    if (rows) setSweep({ rows, cfg: { ...cfg, L }, at: new Date() });
  };
  const levels = Math.floor(50 / cfg.step) + 1;
  return (
    <section className="panel p-4 space-y-4" data-testid="sweep-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="h2">Loss-rate sweep (batch mode)</h2>
        <span className="micro">{levels} loss levels × {cfg.trials} trials × {cfg.packets} pkts · epoch {L}</span>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Seg label="Packets per trial" options={[200, 300, 500, 1000]} value={cfg.packets} onChange={set("packets")} testId="sweep-packets" />
        <Seg label="Trials per level" options={[1, 2, 3, 5]} value={cfg.trials} onChange={set("trials")} testId="sweep-trials" />
        <Seg label="Loss step %" options={[5, 10]} value={cfg.step} onChange={set("step")} testId="sweep-step" />
        <div className="flex flex-col gap-2">
          <span className="micro">Burst loss</span>
          <div className="h-8 flex items-center"><Switch checked={cfg.burst} onCheckedChange={set("burst")} data-testid="sweep-burst-toggle" /></div>
        </div>
        {prog == null ? (
          <Btn tone="cyan" onClick={run} data-testid="sweep-run-button"><Play size={14} /> Run sweep</Btn>
        ) : (
          <Btn tone="rose" onClick={() => { cancel.current = true; }} data-testid="sweep-cancel-button"><Square size={14} /> Cancel</Btn>
        )}
        {sweep && prog == null && (
          <Btn onClick={() => downloadText(`resynclab-sweep-${Date.now()}.csv`, sweepCsv(sweep.rows))} data-testid="sweep-export-button"><Download size={14} /> Sweep CSV</Btn>
        )}
      </div>
      {prog != null && (
        <div data-testid="sweep-progress">
          <div className="leak-bar"><i style={{ width: `${prog * 100}%`, background: "#00f0ff" }} /></div>
          <span className="micro">{Math.round(prog * 100)}% · running real Ascon trials in your browser</span>
        </div>
      )}
      {!sweep && prog == null && <p className="text-sm text-slate-500">Runs fresh simulations at every loss level from 0% to 50% and averages success, stall and leak exposure per method.</p>}
      {sweep && (
        <>
          <LaneLegend />
          <div className="grid gap-3 lg:grid-cols-3">
            {SWEEP_CHARTS.map((c) => <Chart key={c.key} c={c} data={sweep.rows} x="loss" />)}
          </div>
          <SweepTable rows={sweep.rows} />
        </>
      )}
    </section>
  );
};
