import { useCallback, useEffect, useRef, useState } from "react";
import { Sim, LANES, mulCycles } from "../lib/sim";
import { hardwareRows } from "../lib/hardware";
import { HardwarePanel } from "../components/resync/HardwarePanel";
import { SweepPanel } from "../components/resync/SweepPanel";
import { ReportSheet } from "../components/resync/ReportSheet";
import { ControlBar } from "../components/resync/ControlBar";
import { LaneCard } from "../components/resync/LaneCard";
import { TimelineStrip, Legend } from "../components/resync/TimelineStrip";
import { PacketInspector } from "../components/resync/PacketInspector";
import { LeakPanel } from "../components/resync/LeakPanel";
import { ComparisonCharts } from "../components/resync/ComparisonCharts";
import { Header } from "../components/resync/Header";
import { Play, Pause, StepForward, Scissors } from "lucide-react";
import { Btn } from "../components/resync/ControlBar";
import { HeroPacketFlow } from "../components/resync/HeroPacketFlow";
import { ScenarioDeck, SCENARIOS } from "../components/resync/ScenarioDeck";
import { NavBar } from "../components/resync/NavBar";

const STRIP = 56;

export default function Simulator() {
  const [epochLen, setEpochLen] = useState(32);
  const simRef = useRef(null);
  if (!simRef.current) simRef.current = new Sim(32);
  const [, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(6);
  const [loss, setLoss] = useState(10);
  const [burst, setBurst] = useState(false);
  const [armed, setArmed] = useState({});
  const [disorder, setDisorder] = useState(0);
  const [sweep, setSweep] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [selected, setSelected] = useState(null);
  const [leak, setLeak] = useState(null);
  const [scenario, setScenario] = useState(null);
  const scriptRef = useRef([]);
  const params = useRef({});
  params.current = { loss, burst, armed, disorder };

  const step = useCallback((n = 1) => {
    const p = params.current;
    const force = { ...p.armed, ...(scriptRef.current.shift() || {}) };
    if (Object.keys(p.armed).length) { setArmed({}); p.armed = {}; }
    for (let k = 0; k < n; k++) {
      simRef.current.step({ loss: p.loss / 100, burst: p.burst, disorder: p.disorder / 100, force: k === 0 ? force : {} });
    }
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const ms = Math.max(150, 1000 / speed);
    const n = Math.max(1, Math.round((speed * ms) / 1000));
    const id = setInterval(() => step(n), ms);
    return () => clearInterval(id);
  }, [running, speed, step]);

  const chartRef = useRef({ data: [], t: 0, sim: null });

  const reset = (L = epochLen) => {
    simRef.current = new Sim(L);
    setSelected(null); setLeak(null); setTick((t) => t + 1);
  };
  const onEpoch = (L) => { setEpochLen(L); scriptRef.current = []; setScenario(null); reset(L); };
  const arm = (key) => setArmed((a) => ({ ...a, [key]: true }));
  const runScenario = (id) => {
    const s = SCENARIOS.find((x) => x.id === id);
    setLoss(s.set.loss); setBurst(s.set.burst); setDisorder(s.set.disorder); setSpeed(s.set.speed); setArmed({});
    reset();
    scriptRef.current = s.script.slice();
    setScenario(id);
    setRunning(true);
  };
  const onLeak = () => setLeak({ at: simRef.current.sent - 1, res: simRef.current.leak() });
  const onExport = () => {
    const blob = new Blob([simRef.current.csv()], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `resynclab-run-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sim = simRef.current;
  const items = sim.recent(STRIP);
  const delivered = sim.delivered;
  const ev = selected ? sim.evMap.get(selected.id) : null;
  const hw = hardwareRows(sim);
  const now = Date.now();
  if (!running || chartRef.current.sim !== sim || now - chartRef.current.t > 800) {
    chartRef.current = { data: sim.points.slice(), t: now, sim };
  }

  return (
    <div className="dark rl-root">
      <NavBar running={running} onToggle={() => setRunning((r) => !r)} sim={sim} />
      <div className="print-hide max-w-[1500px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section id="pipeline" className="grid gap-6 lg:grid-cols-12 items-center pt-2">
          <div className="lg:col-span-5 space-y-6">
            <Header sim={sim} running={running} />
            <div className="flex flex-wrap gap-2">
              <button className={`cta ${running ? "running" : ""}`} onClick={() => setRunning((r) => !r)} data-testid="hero-start-toggle">
                {running ? <Pause size={16} /> : <Play size={16} />} {running ? "Pause stream" : "Start stream"}
              </button>
              <Btn onClick={() => step(1)} className="h-10" data-testid="hero-step-button"><StepForward size={14} /> Step</Btn>
              <Btn tone="rose" onClick={() => arm("drop")} className={`h-10 ${armed.drop ? "armed" : ""}`} data-testid="hero-drop-button">
                <Scissors size={14} /> {armed.drop ? "Drop armed" : "Drop next"}
              </Btn>
            </div>
          </div>
          <div className="lg:col-span-7 rise" style={{ animationDelay: "120ms" }}>
            <HeroPacketFlow sim={sim} loss={loss} armedDrop={!!armed.drop} onChannelClick={() => arm("drop")}
              onLaneClick={(k) => document.getElementById(`lane-card-${k + 1}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} />
          </div>
        </section>
        <ScenarioDeck active={scenario} onRun={runScenario} />
        <div id="controls">
          <ControlBar
            running={running} onStart={() => setRunning(true)} onPause={() => setRunning(false)} onStep={() => step(1)} onReset={() => { scriptRef.current = []; setScenario(null); reset(); }}
            speed={speed} setSpeed={setSpeed} loss={loss} setLoss={setLoss} burst={burst} setBurst={setBurst}
            armed={armed} onArm={arm} disorder={disorder} setDisorder={setDisorder} canReplay={sim.sent >= 4}
            epochLen={epochLen} onEpoch={onEpoch} onLeak={onLeak} onExport={onExport} onReport={() => setShowReport(true)}
          />
        </div>
        <section className="panel p-4 space-y-2" data-testid="channel-panel">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h2 className="h2">Sender → noisy UDP channel</h2>
            <Legend />
          </div>
          <TimelineStrip items={items} lane={-1} selected={selected} onSelect={setSelected} testId="timeline-strip-channel" />
          {!items.length && <p className="text-xs text-slate-500">Press Start or Step to send the first sensor packet.</p>}
        </section>
        <div id="lanes" className="space-y-3">
          {LANES.map((m, k) => (
            <LaneCard key={m.id} meta={m} k={k} stats={sim.stats[k]} reuse={sim.reuse[k].count} items={items}
              selected={selected} onSelect={setSelected} delivered={delivered} L={sim.L} />
          ))}
        </div>
        <div id="inspect" className="grid gap-4 lg:grid-cols-2">
          <PacketInspector ev={ev} lane={selected?.lane ?? 3} setLane={(lane) => setSelected({ ...selected, lane })} />
          <LeakPanel leak={leak} />
        </div>
        <div id="charts"><ComparisonCharts data={chartRef.current.data} /></div>
        <div id="hardware"><HardwarePanel rows={hw} /></div>
        <div id="sweep"><SweepPanel L={sim.L} sweep={sweep} setSweep={setSweep} /></div>
        <footer className="micro pt-2 pb-6">Simulation only · Ascon-AEAD128 & Ascon-XOF128 per NIST SP 800-232 · cycles = Ascon permutation rounds (1 round/cycle) + {mulCycles(sim.L)}-cycle shift-add seek (log2 of epoch length)</footer>
      </div>
      {showReport && (
        <ReportSheet sim={sim} settings={{ loss, burst, disorder }} sweep={sweep} leak={leak} hw={hw}
          chartData={chartRef.current.data} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
