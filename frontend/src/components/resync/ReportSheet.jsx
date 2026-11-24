import { Printer, X } from "lucide-react";
import { LANES } from "../../lib/sim";
import { HW_NOTE } from "../../lib/hardware";
import { Btn } from "./ControlBar";
import { Chart, CHARTS } from "./ComparisonCharts";
import { SWEEP_CHARTS } from "./SweepPanel";
import { HardwareTable } from "./HardwarePanel";

const pct = (s, d) => (d ? (((s.dec + s.rec) / d) * 100).toFixed(1) : "100.0");

const findings = (sim, leak, sweep) => {
  const [l1, l2, l3, l4] = sim.stats;
  const d = sim.delivered;
  const out = [
    `Proposed lane (L4): ${pct(l4, d)}% success, ${l4.stall} stall cycles, constant ${l4.maxMem} stored secrets.`,
    `Existing fixes spent ${l2.stall.toLocaleString()} (L2) and ${l3.stall.toLocaleString()} (L3) stall cycles on the same channel; L3 held up to ${l3.maxMem} secrets.`,
    l1.fail ? `Without recovery (L1) success fell to ${pct(l1, d)}% after the first loss.` : "No channel losses yet, so the methods have not been separated.",
  ];
  const reuse = sim.reuse.reduce((a, r) => a + r.count, 0) + sim.sender.reuse.count;
  out.push(reuse ? `Key/nonce reuse detected: ${reuse} events.` : "No key/nonce (two-time pad) reuse in the sender or any lane.");
  const acc = sim.stats.reduce((a, s) => a + s.acc, 0);
  if (sim.stats.some((s) => s.rej || s.late)) out.push(`Duplicates/replays discarded: ${sim.stats.map((s, k) => `L${k + 1} ${s.rej}`).join(", ")}; accepted: ${acc}.`);
  if (leak) out.push(`Memory leak at packet #${leak.at}: ${leak.res.map((r, k) => `L${k + 1} ${r.idx.length}`).join(", ")} past packets decryptable (L4 bounded by epoch ${sim.L}).`);
  if (sweep) {
    const last = sweep.rows[sweep.rows.length - 1];
    out.push(`Sweep at ${last.loss}% loss: success ${LANES.map((_, k) => `L${k + 1} ${last[`sr${k}`]}%`).join(", ")}.`);
  }
  return out;
};

const SummaryTable = ({ sim, leak }) => (
  <table className="hw-table light" data-testid="report-summary-table">
    <thead>
      <tr><th>Method</th><th>Success</th><th>Dec / Rec / Fail</th><th>Avg recovery</th><th>Total stall</th><th>Max secrets</th><th>Dup·replay rej/acc</th><th>Leak exposure</th></tr>
    </thead>
    <tbody>
      {sim.stats.map((s, k) => (
        <tr key={k} className={LANES[k].proposed ? "proposed" : ""}>
          <td>{LANES[k].tag} {LANES[k].name}</td>
          <td className="num">{pct(s, sim.delivered)}%</td>
          <td className="num">{s.dec} / {s.rec} / {s.fail}</td>
          <td className="num">{s.nLat ? Math.round(s.sumLat / s.nLat) : 0} cyc</td>
          <td className="num">{s.stall.toLocaleString()} cyc</td>
          <td className="num">{s.maxMem}</td>
          <td className="num">{s.rej} / {s.acc}</td>
          <td className="num">{leak ? `${leak.res[k].idx.length} pkts` : "not run"}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const ReportSheet = ({ sim, settings, sweep, leak, hw, chartData, onClose }) => {
  const charts = sweep
    ? [[CHARTS[0], chartData, "i"], [CHARTS[3], chartData, "i"], [SWEEP_CHARTS[0], sweep.rows, "loss"], [SWEEP_CHARTS[2], sweep.rows, "loss"]]
    : CHARTS.map((c) => [c, chartData, "i"]);
  return (
    <div className="report-overlay" data-testid="report-overlay">
      <div className="report-toolbar no-print">
        <Btn tone="cyan" onClick={() => window.print()} data-testid="report-print-button"><Printer size={14} /> Print / Save as PDF</Btn>
        <Btn onClick={onClose} data-testid="report-close-button"><X size={14} /> Close</Btn>
      </div>
      <article className="report-sheet" data-testid="report-sheet">
        <header className="report-head">
          <div>
            <h1>ResyncLab · Results sheet</h1>
            <p>Stream cipher desynchronization: seekable counter-based resynchronization vs existing fixes</p>
          </div>
          <div className="report-meta">{new Date().toLocaleString()}</div>
        </header>
        <p className="report-config" data-testid="report-config">
          Ascon-AEAD128 (NIST SP 800-232) · {sim.sent} packets sent, {sim.dropped} dropped ({sim.sent ? ((sim.dropped / sim.sent) * 100).toFixed(1) : 0}%) ·
          loss {settings.loss}%{settings.burst ? " + burst" : ""} · disorder {settings.disorder}% · epoch length {sim.L}
        </p>
        <h2>Run summary</h2>
        <SummaryTable sim={sim} leak={leak} />
        <h2>Key findings</h2>
        <ul className="report-findings" data-testid="report-findings">{findings(sim, leak, sweep).map((f) => <li key={f}>{f}</li>)}</ul>
        <h2>Charts{sweep ? ` · sweep: ${sweep.cfg.trials} trials × ${sweep.cfg.packets} pkts per level` : ""}</h2>
        <div className="report-charts">
          {charts.map(([c, data, x]) => <Chart key={c.id} c={c} data={data} x={x} light width={340} />)}
        </div>
        <h2>Hardware cost estimate</h2>
        <HardwareTable rows={hw} light />
        <p className="report-note">{HW_NOTE} Simulation only; no real network or hardware.</p>
      </article>
    </div>
  );
};
