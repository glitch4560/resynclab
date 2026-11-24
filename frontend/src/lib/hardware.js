import { CACHE_WINDOW, MAX_SKIP, mulCycles } from "./sim";

export const GE = { dff: 6, fa: 7, mux: 2.5 };
const area = (bits, fa = 0, mux = 0) => Math.round(bits * GE.dff + fa * GE.fa + mux * GE.mux);

export const HW_NOTE =
  `Area estimates: ${GE.dff} GE per flip-flop bit, ${GE.fa} GE per full-adder bit, ${GE.mux} GE per 2:1 mux bit (typical standard-cell figures). ` +
  "Extra = beyond the shared sequential engine and one Ascon core (the 320-bit Ascon state alone is 1,920 GE of flip-flops). " +
  "Permutation calls are measured in this run: Ascon rounds spent on recovery ÷ 12 (p12-equivalents). Stall = cycles the main pipeline is blocked per recovery (the live lane stall total also includes work spent rejecting duplicates and replays).";

export function hardwareRows(sim) {
  const s = sim.stats;
  const L = sim.L;
  const jb = mulCycles(L);
  const avg = (k) => (s[k].nLat ? s[k].sumLat / s[k].nLat : null);
  const cacheBits = CACHE_WINDOW * 129 + 32;
  const skipNow = Math.max(0, s[2].maxMem - 1);
  const seekBits = 3 * 128 + L + jb;
  return [
    { k: 0, bits: 0, worstBits: 0, datapath: "None", rounds: null, stall: null, area: 0, worstArea: 0, scaling: "Cannot recover; one loss is permanent" },
    {
      k: 1, bits: cacheBits, worstBits: cacheBits, datapath: `${CACHE_WINDOW}-entry state cache + trial-decrypt control`,
      rounds: avg(1), stall: avg(1), area: area(cacheBits, 0, (CACHE_WINDOW - 1) * 128), worstArea: null,
      scaling: `Recovery cost grows linearly with gap; fails past ${CACHE_WINDOW}`,
    },
    {
      k: 2, bits: skipNow * 288 + 32, worstBits: MAX_SKIP * 288 + 32, datapath: "Skipped-key store (key+nonce+index) + compare",
      rounds: avg(2), stall: avg(2), area: area(skipNow * 288 + 32), worstArea: area(MAX_SKIP * 288 + 32),
      scaling: "Storage grows with every lost packet",
    },
    {
      k: 3, bits: seekBits, worstBits: seekBits, datapath: `128-bit adder + ${jb}-step shift-add seek, ${L}-bit replay bitmap`,
      rounds: avg(3), stall: 0, area: area(seekBits, 128, 128), worstArea: null,
      scaling: "Constant storage; O(1) seek, ratchet only on epoch skip",
    },
  ];
}
