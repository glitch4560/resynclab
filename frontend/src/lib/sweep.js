import { Sim, LANES } from "./sim";

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function runSweep({ step, packets, trials, burst, L, onProgress, isCancelled }) {
  const levels = [];
  for (let l = 0; l <= 50; l += step) levels.push(l);
  const total = levels.length * trials * packets;
  let done = 0;
  const rows = [];
  for (const loss of levels) {
    const acc = LANES.map(() => ({ sr: 0, stall: 0, exp: 0 }));
    for (let t = 0; t < trials; t++) {
      const sim = new Sim(L);
      const exp = [0, 0, 0, 0];
      let snaps = 0;
      const q = Math.max(1, Math.floor(packets / 4));
      for (let p = 0; p < packets; p++) {
        sim.step({ loss: loss / 100, burst });
        done++;
        if ((p + 1) % q === 0) { sim.leak().forEach((r, k) => { exp[k] += r.idx.length; }); snaps++; }
        if (p % 25 === 0) {
          onProgress(done / total);
          await tick();
          if (isCancelled()) return null;
        }
      }
      sim.stats.forEach((s, k) => {
        acc[k].sr += ((s.dec + s.rec) / (sim.delivered || 1)) * 100;
        acc[k].stall += (s.stall / sim.sent) * 100;
        acc[k].exp += snaps ? exp[k] / snaps : 0;
      });
    }
    const row = { loss };
    acc.forEach((a, k) => {
      row[`sr${k}`] = +(a.sr / trials).toFixed(1);
      row[`stall${k}`] = Math.round(a.stall / trials);
      row[`exp${k}`] = +(a.exp / trials).toFixed(1);
    });
    rows.push(row);
  }
  onProgress(1);
  return rows;
}

export const sweepCsv = (rows) => {
  const head = ["loss_pct", ...LANES.flatMap((m) => [`${m.id}_success_pct`, `${m.id}_stall_cyc_per_100pkt`, `${m.id}_exposed_pkts`])];
  return [head.join(","), ...rows.map((r) => [r.loss, ...LANES.flatMap((_, k) => [r[`sr${k}`], r[`stall${k}`], r[`exp${k}`]])].join(","))].join("\n");
};

export const downloadText = (name, text) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
