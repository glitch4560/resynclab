import { Activity } from "lucide-react";

const Metric = ({ label, value, tone, testId }) => (
  <div className="hud">
    <span className="micro">{label}</span>
    <span className={`mono text-xl font-bold ${tone || "text-slate-100"}`} data-testid={testId}>{value}</span>
  </div>
);

export const Header = ({ sim, running }) => {
  const obs = sim.sent ? ((sim.dropped / sim.sent) * 100).toFixed(1) : "0.0";
  const reuse = sim.sender.reuse.count;
  return (
    <header className="space-y-5 rise">
      <div>
        <div className="flex flex-wrap items-center gap-2 micro">
          <span className={`led ${running ? "on" : ""}`} data-testid="sim-running-led" />
          <span className={running ? "text-emerald-400" : ""}>{running ? "STREAMING" : "IDLE"}</span>
          <span className="chip"><Activity size={11} /> Ascon-AEAD128</span>
          <span className="chip">NIST SP 800-232</span>
          <span className="chip">Forward-secret UDP</span>
        </div>
        <h1 className="hero-title text-4xl sm:text-5xl lg:text-[3.4rem] text-slate-50 mt-4">
          One lost packet.<br /><span className="text-cyan-300 glow-text">Four ways</span> to survive it.
        </h1>
        <p className="text-sm sm:text-base text-slate-400 mt-4 max-w-xl leading-relaxed">
          A live stream-cipher lab. Encrypted sensor packets cross a lossy 5G edge channel, and four receivers fight to stay in sync.
          Watch the proposed <span className="text-cyan-300">seek lane</span> recover with zero pipeline stall.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Sent" value={sim.sent} testId="metric-sent" />
        <Metric label="Dropped" value={sim.dropped} tone="text-rose-400" testId="metric-dropped" />
        <Metric label="Observed loss" value={`${obs}%`} testId="metric-observed-loss" />
        <Metric label="Sender key/nonce reuse" value={reuse} tone={reuse ? "text-rose-400" : "text-emerald-400"} testId="metric-sender-reuse" />
      </div>
    </header>
  );
};
