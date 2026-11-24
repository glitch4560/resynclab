import { hex, LANES } from "../../lib/sim";
import { STATUS_LABEL } from "./TimelineStrip";

const Row = ({ label, children, testId }) => (
  <div className="grid grid-cols-[120px_1fr] gap-3 py-1.5 border-b border-[#1e2633] last:border-0">
    <span className="micro pt-0.5">{label}</span>
    <span className="mono text-xs text-slate-200 break-all" data-testid={testId}>{children}</span>
  </div>
);

export const PacketInspector = ({ ev, lane, setLane }) => {
  if (!ev) {
    return (
      <section className="panel p-4" data-testid="packet-inspector-panel">
        <h2 className="h2">Packet inspector</h2>
        <p className="text-sm text-slate-500 mt-3">Click any packet in a lane timeline to see its counter, epoch, ciphertext, tag check and decrypted reading.</p>
      </section>
    );
  }
  const pkt = ev.pkt;
  const part = lane === 3 ? pkt.seek : pkt.chain;
  const ct = part.ct;
  const r = ev.res[lane];
  const tag = ev.kind === "dropped" ? "NOT RECEIVED" : ev.kind === "held" ? "HELD IN CHANNEL"
    : r.status === "rejected" ? "DISCARDED · DUP/REPLAY" : r.status === "replayed" ? "REPLAY ACCEPTED" : r.pt ? "TAG VALID" : "TAG MISMATCH";
  const good = r.pt && r.status !== "replayed";
  return (
    <section className="panel p-4" data-testid="packet-inspector-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2">Packet #{pkt.i}</h2>
        <div className="seg">
          {LANES.map((m, k) => (
            <button key={m.id} className={k === lane ? "on" : ""} onClick={() => setLane(k)} data-testid={`inspector-lane-${k + 1}`}>{m.tag}</button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <Row label="Counter" testId="packet-counter-value">{pkt.i}</Row>
        <Row label="Epoch · offset" testId="packet-epoch-value">{lane === 3 ? `${pkt.e} · ${pkt.j}` : "— (continuous chain)"}</Row>
        <Row label="Delivery" testId="packet-delivery-kind">{STATUS_LABEL[ev.kind === "normal" ? "delivered" : ev.kind]}{ev.id !== pkt.i ? ` · event ${ev.id}` : ""}</Row>
        <Row label="Lane result" testId="packet-lane-status">{STATUS_LABEL[r.status]} · {r.sync}{r.lat ? ` · ${r.lat} cyc recovery` : ""}</Row>
        {r.note && <Row label="Lane note" testId="packet-lane-note">{r.note}</Row>}
        <Row label="Header (AD)">{hex(part.hdr)}</Row>
        <Row label="Nonce">{part.nonce}</Row>
        <Row label="Ciphertext" testId="packet-ciphertext-hex">{hex(ct.subarray(0, ct.length - 16))}</Row>
        <Row label="Tag">{hex(ct.subarray(ct.length - 16))}</Row>
        <Row label="Tag check">
          <span data-testid="packet-auth-tag-badge" className={`badge-sm ${good ? "ok" : "bad"}`}>{tag}</span>
        </Row>
        <Row label="Reading" testId="packet-reading">{r.pt || <span className="text-slate-500">— not decrypted</span>}</Row>
      </div>
    </section>
  );
};
