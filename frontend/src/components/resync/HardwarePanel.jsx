import { LANES } from "../../lib/sim";
import { HW_NOTE } from "../../lib/hardware";

const fmt = (n) => n.toLocaleString("en-US");

export const HardwareTable = ({ rows, light }) => (
  <table className={`hw-table ${light ? "light" : ""}`} data-testid={light ? "report-hardware-table" : "hardware-cost-table"}>
    <thead>
      <tr>
        <th>Method</th><th>Extra storage</th><th>Extra datapath</th><th>Perm. calls / recovery</th>
        <th>Stall / recovery</th><th>Est. extra area</th><th>Scaling</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r) => (
        <tr key={r.k} data-testid={`${light ? "report-" : ""}hw-row-${r.k + 1}`} className={LANES[r.k].proposed ? "proposed" : ""}>
          <td><span className="lane-tag mr-1.5" style={{ "--lane": light ? LANES[r.k].print : LANES[r.k].color }}>{LANES[r.k].tag}</span>{LANES[r.k].name}</td>
          <td className="num">{fmt(r.bits)} b{r.worstBits !== r.bits && <span className="dim"> · worst {fmt(r.worstBits)} b</span>}</td>
          <td>{r.datapath}</td>
          <td className="num">{r.rounds == null ? "—" : <>{(r.rounds / 12).toFixed(2)}<span className="dim"> · {Math.round(r.rounds)} rnd</span></>}</td>
          <td className="num">{r.stall == null ? "—" : `${Math.round(r.stall)} cyc`}</td>
          <td className="num">{fmt(r.area)} GE{r.worstArea != null && r.worstArea !== r.area && <span className="dim"> · worst {fmt(r.worstArea)}</span>}</td>
          <td>{r.scaling}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const HardwarePanel = ({ rows }) => (
  <section className="panel p-4" data-testid="hardware-cost-panel">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="h2">Hardware cost estimate</h2>
      <span className="micro">measured values update with the live run</span>
    </div>
    <div className="overflow-x-auto mt-3"><HardwareTable rows={rows} /></div>
    <p className="text-xs text-slate-500 mt-3 max-w-5xl">{HW_NOTE}</p>
  </section>
);
