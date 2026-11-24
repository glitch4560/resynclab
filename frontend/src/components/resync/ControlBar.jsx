import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Play, Pause, StepForward, RotateCcw, Scissors, ShieldAlert, Download, Shuffle, Copy, Repeat, FileText } from "lucide-react";

const EPOCHS = [8, 16, 32, 64, 128];
const ARM = [
  { key: "drop", label: "Drop next", icon: Scissors, tone: "rose", id: "sim-drop-next-button" },
  { key: "reorder", label: "Reorder next", icon: Shuffle, tone: "amber", id: "sim-reorder-next-button" },
  { key: "dup", label: "Duplicate next", icon: Copy, tone: "default", id: "sim-dup-next-button" },
  { key: "replay", label: "Replay old pkt", icon: Repeat, tone: "violet", id: "sim-replay-next-button" },
];

export const Btn = ({ children, tone = "default", className = "", ...p }) => (
  <button className={`rl-btn rl-btn-${tone} ${className}`} {...p}>{children}</button>
);

const Field = ({ label, value, children }) => (
  <div className="flex flex-col gap-2 min-w-[150px]">
    <div className="flex justify-between micro"><span>{label}</span><span className="text-slate-200 mono">{value}</span></div>
    {children}
  </div>
);

export const ControlBar = (p) => (
  <section className="panel p-4 flex flex-wrap items-end gap-x-6 gap-y-4" data-testid="control-bar">
    <div className="flex gap-2">
      {p.running ? (
        <Btn tone="amber" onClick={p.onPause} data-testid="sim-pause-button"><Pause size={14} /> Pause</Btn>
      ) : (
        <Btn tone="cyan" onClick={p.onStart} data-testid="sim-start-button"><Play size={14} /> Start</Btn>
      )}
      <Btn onClick={p.onStep} disabled={p.running} data-testid="sim-step-button"><StepForward size={14} /> Step</Btn>
      <Btn onClick={p.onReset} data-testid="sim-reset-button"><RotateCcw size={14} /> Reset</Btn>
    </div>
    <Field label="Stream speed" value={`${p.speed} pkt/s`}>
      <Slider data-testid="sim-speed-slider" min={1} max={20} step={1} value={[p.speed]} onValueChange={(v) => p.setSpeed(v[0])} />
    </Field>
    <Field label={p.burst ? "Burst start prob." : "Packet loss"} value={`${p.loss}%`}>
      <Slider data-testid="sim-loss-slider" min={0} max={50} step={1} value={[p.loss]} onValueChange={(v) => p.setLoss(v[0])} />
    </Field>
    <div className="flex flex-col gap-2">
      <span className="micro">Burst loss</span>
      <div className="flex items-center gap-2 h-8">
        <Switch data-testid="sim-burst-toggle" checked={p.burst} onCheckedChange={p.setBurst} />
        <span className="mono text-xs text-slate-400">{p.burst ? "ON · 3–6 pkts" : "OFF"}</span>
      </div>
    </div>
    <div className="flex flex-col gap-2">
      <span className="micro">Inject on next packet</span>
      <div className="flex flex-wrap gap-2">
        {ARM.map(({ key, label, icon: Icon, tone, id }) => (
          <Btn key={key} tone={tone} className={p.armed[key] ? "armed" : ""} onClick={() => p.onArm(key)} data-testid={id}
            disabled={key === "replay" && !p.canReplay} title={key === "replay" && !p.canReplay ? "Send at least 4 packets first" : undefined}>
            <Icon size={14} /> {p.armed[key] ? "Armed" : label}
          </Btn>
        ))}
      </div>
    </div>
    <Field label="Random disorder" value={`${p.disorder}%`}>
      <Slider data-testid="sim-disorder-slider" min={0} max={30} step={1} value={[p.disorder]} onValueChange={(v) => p.setDisorder(v[0])} />
    </Field>
    <div className="flex flex-col gap-2">
      <span className="micro">Epoch length (L4) · resets run</span>
      <div className="seg" data-testid="sim-epoch-length-input">
        {EPOCHS.map((e) => (
          <button key={e} data-testid={`epoch-option-${e}`} className={e === p.epochLen ? "on" : ""} onClick={() => p.onEpoch(e)}>{e}</button>
        ))}
      </div>
    </div>
    <div className="flex gap-2 ml-auto">
      <Btn tone="violet" onClick={p.onLeak} data-testid="sim-leak-memory-button"><ShieldAlert size={14} /> Leak receiver memory</Btn>
      <Btn onClick={p.onExport} data-testid="sim-export-csv-button"><Download size={14} /> Export CSV</Btn>
      <Btn tone="cyan" onClick={p.onReport} data-testid="sim-report-button"><FileText size={14} /> Results report</Btn>
    </div>
  </section>
);
