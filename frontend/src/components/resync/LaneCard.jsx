import { Unlink, Database, KeyRound, Zap } from "lucide-react";
import { TimelineStrip, SeekStrip } from "./TimelineStrip";

const ICONS = [Unlink, Database, KeyRound, Zap];

const SYNC_TEXT = { SYNCED: "IN SYNC", DESYNCED: "DESYNCED", RESYNCING: "RECOVERING", SEEK_DIRECT: "SEEK · RECOVERED" };

const exposure = (k, s, L) => {
  if (k === 0) return { text: "None (chain broken)", bad: false };
  if (k === 1) return { text: `${s.mem - 1} past states`, bad: s.mem > 1 };
  if (k === 2) return { text: `${s.mem - 1} skipped keys`, bad: s.mem > 1 };
  return { text: `Current epoch only (≤${L})`, bad: false };
};

const Stat = ({ label, value, tone, testId }) => (
  <div className="stat">
    <span className="micro">{label}</span>
    <span className={`mono text-sm ${tone || "text-slate-100"}`} data-testid={testId}>{value}</span>
  </div>
);

export const LaneCard = ({ meta, k, stats: s, reuse, items, selected, onSelect, delivered, L }) => {
  const sr = delivered ? (((s.dec + s.rec) / delivered) * 100).toFixed(1) : "100.0";
  const ex = exposure(k, s, L);
  const Icon = ICONS[k];
  return (
    <article id={`lane-card-${k + 1}`} className={`panel lane ${meta.proposed ? "lane-proposed" : ""}`} style={{ "--lane": meta.color, animationDelay: `${k * 80}ms` }} data-testid={`receiver-lane-${k + 1}`}>
      {s.fail > 0 && <span key={`f${s.fail}`} className="lane-flash fail" />}
      {s.rec > 0 && <span key={`r${s.rec}`} className="lane-flash rec" />}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="lane-icon"><Icon size={15} /></span>
            <span className="lane-tag">{meta.tag}</span>
            <h3 className="font-semibold text-slate-100 text-sm sm:text-base">{meta.name}</h3>
            {meta.proposed && <span className="proposed-chip" data-testid="proposed-chip">PROPOSED</span>}
          </div>
          <p className="text-xs text-slate-500 mt-1">{meta.sub}</p>
        </div>
        <span className={`badge sync-${s.sync}`} data-testid={`lane-sync-badge-${k + 1}`}><i />{SYNC_TEXT[s.sync]}</span>
      </header>
      <div className="mt-3 space-y-1">
        {meta.proposed && <div className="micro flex justify-between"><span>Main sequential engine</span><span>+ seek lane (parallel)</span></div>}
        <TimelineStrip items={items} lane={k} selected={selected} onSelect={onSelect} testId={`timeline-strip-${k + 1}`} />
        {meta.proposed && <SeekStrip items={items} />}
      </div>
      <div className="stats-grid mt-3">
        <Stat label="Success" value={`${sr}%`} tone={+sr > 95 ? "text-emerald-400" : +sr < 50 ? "text-rose-400" : "text-amber-400"} testId={`lane-success-${k + 1}`} />
        <Stat label="Decrypted" value={s.dec} testId={`lane-decrypted-${k + 1}`} />
        <Stat label="Recovered" value={s.rec} tone="text-violet-300" testId={`lane-recovered-${k + 1}`} />
        <Stat label="Failed" value={s.fail} tone={s.fail ? "text-rose-400" : "text-slate-100"} testId={`lane-failed-${k + 1}`} />
        <Stat label="Recovery (last/avg)" value={`${s.lastLat} / ${s.nLat ? Math.round(s.sumLat / s.nLat) : 0} cyc`} testId={`lane-latency-${k + 1}`} />
        <Stat label="Pipeline stall" value={`${s.stall} cyc`} tone={s.stall ? "text-amber-400" : "text-emerald-400"} testId={`lane-stall-${k + 1}`} />
        <Stat label="Stored secrets" value={`${s.mem} (max ${s.maxMem})`} testId={`lane-memory-${k + 1}`} />
        <Stat label="Past-key exposure" value={ex.text} tone={ex.bad ? "text-rose-400" : "text-emerald-400"} testId={`lane-exposure-${k + 1}`} />
        <Stat label="Keystream reuse" value={reuse ? `${reuse} REUSED` : "0 · none"} tone={reuse ? "text-rose-400" : "text-emerald-400"} testId={`lane-reuse-${k + 1}`} />
        <Stat label="Late (ok / lost)" value={`${s.late} / ${s.lateLost}`} tone={s.lateLost ? "text-amber-400" : "text-slate-100"} testId={`lane-late-${k + 1}`} />
        <Stat label="Dup·replay (rej / acc)" value={`${s.rej} / ${s.acc}`} tone={s.acc ? "text-rose-400" : "text-emerald-400"} testId={`lane-replay-${k + 1}`} />
      </div>
    </article>
  );
};
