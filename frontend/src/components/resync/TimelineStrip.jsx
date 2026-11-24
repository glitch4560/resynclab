export const STATUS_LABEL = {
  decrypted: "Decrypted",
  recovered: "Recovered",
  failed: "Failed",
  dropped: "Dropped",
  delivered: "Delivered",
  held: "Held (reordered)",
  late: "Late arrival",
  dup: "Duplicate",
  replay: "Replay injected",
  rejected: "Discarded (dup/replay)",
  replayed: "Replay ACCEPTED",
};

const chStatus = (ev) => (ev.kind === "normal" ? "delivered" : ev.kind);

export const TimelineStrip = ({ items, lane, selected, onSelect, testId }) => (
  <div className="strip" data-testid={testId}>
    {items.map((ev) => {
      const status = lane < 0 ? chStatus(ev) : ev.res[lane].status;
      const isSel = selected && selected.id === ev.id && (lane < 0 || selected.lane === lane);
      return (
        <button
          key={ev.id}
          title={`#${ev.pkt.i} · ${STATUS_LABEL[status]}`}
          data-testid={`pkt-${lane < 0 ? "ch" : lane}-${ev.id}`}
          className={`node st-${status} ${isSel ? "sel" : ""}`}
          onClick={() => onSelect({ id: ev.id, lane: lane < 0 ? 3 : lane })}
        />
      );
    })}
  </div>
);

export const SeekStrip = ({ items }) => (
  <div className="strip seek-strip" data-testid="timeline-strip-seek-lane">
    {items.map((ev) => (
      <span key={ev.id} className={`node ${ev.res[3].seek ? "st-seek" : "st-idle"}`} title={ev.res[3].seek ? `#${ev.pkt.i} seek: state computed from counter` : ""} />
    ))}
  </div>
);

export const Legend = () => (
  <div className="flex flex-wrap gap-x-4 gap-y-1.5 micro">
    {["delivered", "dropped", "held", "late", "dup", "replay", "decrypted", "recovered", "failed", "rejected", "replayed"].map((s) => (
      <span key={s} className="flex items-center gap-1.5"><i className={`node st-${s} legend`} />{STATUS_LABEL[s]}</span>
    ))}
    <span className="flex items-center gap-1.5"><i className="node st-seek legend" />Seek-lane compute</span>
  </div>
);
