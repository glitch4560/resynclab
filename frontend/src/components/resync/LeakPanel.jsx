import { LANES } from "../../lib/sim";

const range = (idx) => {
  if (!idx.length) return "—";
  const s = idx.slice(0, 10).map((i) => `#${i}`).join(" ");
  return idx.length > 10 ? `${s} … +${idx.length - 10}` : s;
};

export const LeakPanel = ({ leak }) => {
  const max = leak ? Math.max(1, ...leak.res.map((r) => r.idx.length)) : 1;
  return (
    <section className="panel p-4" data-testid="memory-leak-results-panel">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="h2">Compromise test</h2>
        {leak && <span className="micro">snapshot at packet #{leak.at}</span>}
      </div>
      {!leak ? (
        <p className="text-sm text-slate-500 mt-3">
          Press "Leak receiver memory" to hand each receiver's memory to an attacker who sniffed every packet on air.
          Each captured packet is then really decrypted with the leaked secrets.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {leak.res.map((r, k) => (
            <div key={k} data-testid={`leak-row-${k + 1}`}>
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-sm text-slate-200"><span className="lane-tag mr-2" style={{ "--lane": LANES[k].color }}>{LANES[k].tag}</span>{LANES[k].name}</span>
                <span className={`mono text-sm ${!r.idx.length ? "text-emerald-400" : k === 3 ? "text-amber-300" : "text-rose-400"}`} data-testid={`leak-count-${k + 1}`}>
                  {r.idx.length} past pkts decryptable
                </span>
              </div>
              <div className="leak-bar mt-1.5"><i style={{ width: `${(r.idx.length / max) * 100}%`, background: LANES[k].color }} /></div>
              <p className="text-xs text-slate-500 mt-1">{r.note}</p>
              <p className="mono text-[11px] text-slate-400 mt-0.5 break-all">{range(r.idx)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
