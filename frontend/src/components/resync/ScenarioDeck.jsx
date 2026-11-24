import { Radio, Scissors, CloudLightning, Shuffle, Repeat, Waves, Eye } from "lucide-react";

const D = { drop: true };
const base = { loss: 0, burst: false, disorder: 0, speed: 3 };

export const SCENARIOS = [
  { id: "clean", title: "Clean stream", icon: Radio, set: { ...base, speed: 6 }, script: [], watch: "Baseline: every lane decrypts every packet and stays in sync." },
  { id: "drop", title: "Single drop", icon: Scissors, set: base, script: [{}, {}, {}, D], watch: "Packet #3 is lost. L1 turns red and never recovers, L2 and L3 stall to catch up, and L4 seeks straight to #4 with zero stall." },
  { id: "burst", title: "Burst loss", icon: CloudLightning, set: base, script: [{}, {}, {}, D, D, D, D, D, D], watch: "Six packets in a row vanish. L2 trial-decrypts through its window, L3 stores six skipped keys, and L4 jumps the gap in one seek." },
  { id: "reorder", title: "Out-of-order", icon: Shuffle, set: base, script: [{}, {}, { reorder: true }, {}, {}, {}, { reorder: true }, {}, { dup: true }], watch: "Packets arrive late and duplicated. L1 desyncs, while L2–L4 accept the late ones and discard the duplicate." },
  { id: "replay", title: "Replay attack", icon: Repeat, set: base, script: [{}, {}, {}, {}, {}, {}, { replay: true }, {}, { replay: true }, {}, { replay: true }], watch: "An attacker re-injects old packets. Every replay should be discarded, and L4 uses its tiny replay bitmap." },
  { id: "harsh", title: "Harsh 5G edge", icon: Waves, set: { loss: 25, burst: true, disorder: 10, speed: 10 }, script: [], watch: "25% bursty loss plus disorder. Compare success, stall and stored secrets in the live charts." },
];

export const ScenarioDeck = ({ active, onRun }) => {
  const cur = SCENARIOS.find((s) => s.id === active);
  return (
    <section className="space-y-3" data-testid="scenario-deck">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="h2">Viva demo scenarios</h2>
        <span className="micro">one click · resets and plays a scripted stream</span>
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {SCENARIOS.map(({ id, title, icon: Icon, watch }, i) => (
          <button key={id} onClick={() => onRun(id)} className={`scenario ${active === id ? "on" : ""}`} style={{ animationDelay: `${i * 60}ms` }} data-testid={`scenario-${id}`}>
            <span className="scenario-icon"><Icon size={16} /></span>
            <span className="block font-semibold text-sm text-slate-100 mt-2">{title}</span>
            <span className="block text-xs text-slate-500 mt-1 line-clamp-2">{watch}</span>
          </button>
        ))}
      </div>
      {cur && (
        <div className="watch" data-testid="scenario-watch-callout">
          <Eye size={15} className="text-cyan-300 shrink-0" />
          <span><b className="mono text-cyan-300">WATCH · {cur.title}</b> — {cur.watch}</span>
        </div>
      )}
    </section>
  );
};
