import { xof, aeadEncrypt, aeadDecrypt, counter } from "./ascon";

const MOD = 1n << 128n;
export const mulCycles = (L) => Math.max(1, Math.ceil(Math.log2(L)));
export const CACHE_WINDOW = 8;
export const MAX_SKIP = 256;
const HISTORY = 3000;
const te = new TextEncoder();
const td = new TextDecoder();

export const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const b2n = (b) => { let x = 0n; for (let i = b.length - 1; i >= 0; i--) x = (x << 8n) | BigInt(b[i]); return x; };
const n2b = (x) => { const b = new Uint8Array(16); for (let i = 0; i < 16; i++) { b[i] = Number(x & 0xffn); x >>= 8n; } return b; };
const H = (label, data, n = 16) => {
  const l = te.encode(label);
  const m = new Uint8Array(l.length + data.length);
  m.set(l); m.set(data, l.length);
  return xof(m, n);
};
const w32 = (a, o, v) => { for (let k = 0; k < 4; k++) a[o + k] = (v >>> (8 * k)) & 255; };
const r32 = (a, o) => (a[o] | (a[o + 1] << 8) | (a[o + 2] << 16) | (a[o + 3] << 24)) >>> 0;

// Sequential continuous engine: s_{i+1} = (s_i + XOF(s_i)) mod 2^128, old state erased
const chainInit = (seed) => b2n(H("RL/chain/seed", seed));
const chainStep = (s) => (s + b2n(H("RL/chain/step", n2b(s)))) % MOD;
const chainKN = (s) => { const o = H("RL/chain/pkt", n2b(s), 32); return { key: o.slice(0, 16), nonce: o.slice(16) }; };
const chainHdr = (i) => { const h = new Uint8Array(4); w32(h, 0, i); return h; };

// Proposed epoch engine: one-way epoch ratchet, s_j = base + j*delta mod 2^128 (seekable)
const epochInit = (seed) => H("RL/epoch/seed", seed);
const ratchet = (E) => H("RL/epoch/ratchet", E);
const epochParams = (E) => ({ base: b2n(H("RL/epoch/base", E)), delta: b2n(H("RL/epoch/delta", E)) | 1n });
const seekState = (p, j) => (p.base + BigInt(j) * p.delta) % MOD;
const seekKey = (s) => H("RL/epoch/key", n2b(s));
const seekNonce = (e, j) => { const n = new Uint8Array(16); w32(n, 0, e); w32(n, 4, j); n[15] = 0x5e; return n; };
const seekHdr = (e, j) => { const h = new Uint8Array(8); w32(h, 0, e); w32(h, 4, j); return h; };

const tryDec = (kn, part) => { const p = aeadDecrypt(kn.key, kn.nonce, part.hdr, part.ct); return p ? td.decode(p) : null; };

class ReuseTracker {
  constructor() { this.m = new Map(); this.count = 0; }
  add(kn, i) {
    const k = hex(kn.key) + hex(kn.nonce);
    const p = this.m.get(k);
    if (p !== undefined && p !== i) this.count++;
    else this.m.set(k, i);
    if (this.m.size > 20000) this.m.delete(this.m.keys().next().value);
  }
}

class Sender {
  constructor(seed, L) {
    this.s = chainInit(seed);
    this.E = epochInit(seed); this.p = epochParams(this.E);
    this.e = 0; this.j = 0; this.es = this.p.base; this.L = L; this.i = 0;
    this.reuse = new ReuseTracker();
  }
  emit(reading) {
    const pt = te.encode(reading);
    const i = this.i;
    const kn = chainKN(this.s);
    const ch = chainHdr(i);
    const chain = { hdr: ch, ct: aeadEncrypt(kn.key, kn.nonce, ch, pt), nonce: hex(kn.nonce) };
    this.reuse.add(kn, `c${i}`);
    this.s = chainStep(this.s);
    if (this.j === this.L) {
      this.E = ratchet(this.E); this.p = epochParams(this.E);
      this.e++; this.j = 0; this.es = this.p.base;
    }
    const sk = { key: seekKey(this.es), nonce: seekNonce(this.e, this.j) };
    const sh = seekHdr(this.e, this.j);
    const seek = { hdr: sh, ct: aeadEncrypt(sk.key, sk.nonce, sh, pt), nonce: hex(sk.nonce) };
    this.reuse.add(sk, `s${i}`);
    const pkt = { i, e: this.e, j: this.j, reading, chain, seek };
    this.es = (this.es + this.p.delta) % MOD;
    this.j++; this.i++;
    return pkt;
  }
}

class NoRecovery {
  constructor(seed) { this.s = chainInit(seed); }
  process(pkt) {
    const kn = chainKN(this.s);
    const pt = tryDec(kn, pkt.chain);
    this.s = chainStep(this.s);
    if (pt) return { status: "decrypted", pt, kn, lat: 0, stall: 0, sync: "SYNCED" };
    return { status: "failed", lat: 0, stall: 0, sync: "DESYNCED" };
  }
  memory() { return 1; }
  leak() {
    return { idx: [], note: "Only the current chain state is held. The step is one-way, so no past packet can be decrypted." };
  }
}

class CacheLane {
  constructor(seed, W) { this.s = chainInit(seed); this.pos = 0; this.W = W; this.cache = new Map(); }
  remember(idx, s, used) {
    const prev = this.cache.get(idx);
    this.cache.delete(idx);
    this.cache.set(idx, { s, used: used || (prev ? prev.used : false) });
    while (this.cache.size > this.W) this.cache.delete(this.cache.keys().next().value);
  }
  process(pkt) {
    const r0 = counter.rounds;
    const kn = chainKN(this.s);
    const pt = tryDec(kn, pkt.chain);
    if (pt) {
      this.remember(this.pos, this.s, true);
      this.s = chainStep(this.s); this.pos++;
      return { status: "decrypted", pt, kn, lat: 0, stall: 0, sync: "SYNCED" };
    }
    for (const [idx, c] of this.cache) {
      if (idx >= this.pos) continue;
      const k2 = chainKN(c.s);
      const p2 = tryDec(k2, pkt.chain);
      if (!p2) continue;
      const extra = counter.rounds - r0;
      if (c.used) return { status: "rejected", lat: 0, stall: extra, sync: "SYNCED", note: "replay: cached state already used" };
      c.used = true;
      return { status: "recovered", pt: p2, kn: k2, lat: extra, stall: extra, sync: "SYNCED", note: "late packet decrypted from cache" };
    }
    this.remember(this.pos, this.s, false);
    let s = this.s;
    for (let k = 1; k <= this.W; k++) {
      s = chainStep(s);
      const rk = counter.rounds;
      const k2 = chainKN(s);
      const p2 = tryDec(k2, pkt.chain);
      this.remember(this.pos + k, s, !!p2);
      if (p2) {
        this.s = chainStep(s); this.pos += k + 1;
        const extra = rk - r0;
        return { status: "recovered", pt: p2, kn: k2, lat: extra, stall: extra, sync: "RESYNCING", note: `trial-decrypted ${k} step(s) ahead` };
      }
    }
    return { status: "failed", lat: 0, stall: counter.rounds - r0, sync: "DESYNCED", note: "no match in cache or lookahead window" };
  }
  memory() { return this.cache.size + 1; }
  leak(history) {
    const idx = [];
    for (const [i, c] of this.cache) {
      const p = history.get(i);
      if (p && tryDec(chainKN(c.s), p.chain)) idx.push(i);
    }
    return { idx, note: `Up to ${this.W} cached past states stay in memory, so recent past packets are exposed.` };
  }
}

class SkipLane {
  constructor(seed, max) { this.s = chainInit(seed); this.n = 0; this.max = max; this.skipped = new Map(); }
  process(pkt) {
    const i = r32(pkt.chain.hdr, 0);
    if (i < this.n) {
      const kn = this.skipped.get(i);
      if (!kn) return { status: "rejected", lat: 0, stall: 0, sync: "SYNCED", note: "no stored key: duplicate/replay or evicted" };
      const pt = tryDec(kn, pkt.chain);
      if (!pt) return { status: "failed", lat: 0, stall: 0, sync: "SYNCED" };
      this.skipped.delete(i);
      return { status: "recovered", pt, kn, lat: 0, stall: 0, sync: "SYNCED", note: "late packet, used stored skipped key" };
    }
    if (i - this.n > this.max) return { status: "failed", lat: 0, stall: 0, sync: "DESYNCED" };
    const gap = i - this.n;
    const r0 = counter.rounds;
    while (this.n < i) {
      this.skipped.set(this.n, chainKN(this.s));
      this.s = chainStep(this.s); this.n++;
      if (this.skipped.size > this.max) this.skipped.delete(this.skipped.keys().next().value);
    }
    const extra = counter.rounds - r0;
    const kn = chainKN(this.s);
    const pt = tryDec(kn, pkt.chain);
    this.s = chainStep(this.s); this.n++;
    if (!pt) return { status: "failed", lat: 0, stall: extra, sync: "DESYNCED" };
    return { status: gap ? "recovered" : "decrypted", pt, kn, lat: extra, stall: extra, sync: gap ? "RESYNCING" : "SYNCED" };
  }
  memory() { return this.skipped.size + 1; }
  leak(history) {
    const idx = [];
    for (const [i, kn] of this.skipped) {
      const p = history.get(i);
      if (p && tryDec(kn, p.chain)) idx.push(i);
    }
    return { idx, note: "Keys for skipped packets wait in memory for packets UDP never resends. Sniffed copies of those packets are exposed." };
  }
}

class SeekLane {
  constructor(seed, L) {
    this.E = epochInit(seed); this.e = 0; this.p = epochParams(this.E);
    this.s = this.p.base; this.next = 0; this.L = L; this.mul = mulCycles(L); this.seen = new Set();
  }
  advance(n) {
    for (let k = 0; k < n; k++) { this.E = ratchet(this.E); this.e++; }
    this.p = epochParams(this.E); this.s = this.p.base; this.next = 0; this.seen = new Set();
  }
  process(pkt) {
    const e = r32(pkt.seek.hdr, 0), j = r32(pkt.seek.hdr, 4);
    if (e < this.e) return { status: "rejected", lat: 0, stall: 0, sync: "SYNCED", note: "epoch key already erased (forward secrecy)" };
    if (e === this.e && j < this.next) {
      if (this.seen.has(j)) return { status: "rejected", lat: 0, stall: 0, sync: "SYNCED", note: "replay bitmap hit" };
      const kn = { key: seekKey(seekState(this.p, j)), nonce: seekNonce(e, j) };
      const pt = tryDec(kn, pkt.seek);
      if (!pt) return { status: "failed", lat: 0, stall: 0, sync: "SYNCED" };
      this.seen.add(j);
      return { status: "recovered", pt, kn, lat: this.mul, stall: 0, sync: "SEEK_DIRECT", seek: true, note: "late packet, seek lane computed state from counter" };
    }
    const rollover = e === this.e + 1 && j === 0 && this.next === this.L;
    if (rollover || (e === this.e && j === this.next)) {
      if (rollover) this.advance(1);
      const kn = { key: seekKey(this.s), nonce: seekNonce(e, j) };
      const pt = tryDec(kn, pkt.seek);
      this.s = (this.s + this.p.delta) % MOD; this.next = j + 1;
      if (pt) this.seen.add(j);
      return pt ? { status: "decrypted", pt, kn, lat: 0, stall: 0, sync: "SYNCED" } : { status: "failed", lat: 0, stall: 0, sync: "DESYNCED" };
    }
    const r0 = counter.rounds;
    if (e > this.e) this.advance(e - this.e);
    const s = seekState(this.p, j);
    const extra = counter.rounds - r0 + this.mul;
    const kn = { key: seekKey(s), nonce: seekNonce(e, j) };
    const pt = tryDec(kn, pkt.seek);
    this.s = (s + this.p.delta) % MOD; this.next = j + 1;
    if (!pt) return { status: "failed", lat: extra, stall: 0, sync: "DESYNCED" };
    this.seen.add(j);
    return { status: "recovered", pt, kn, lat: extra, stall: 0, sync: "SEEK_DIRECT", seek: true, note: "gap: seek lane computed state from counter" };
  }
  memory() { return 4; }
  leak(history) {
    const idx = [];
    for (let j = 0; j < this.next; j++) {
      const i = this.e * this.L + j;
      const p = history.get(i);
      if (p && tryDec({ key: seekKey(seekState(this.p, j)), nonce: seekNonce(this.e, j) }, p.seek)) idx.push(i);
    }
    return { idx, note: `Only the current epoch (≤ ${this.L} packets) is exposed. Older epoch keys were erased by the one-way ratchet.` };
  }
}

export const LANES = [
  { id: "none", tag: "L1", name: "No recovery", sub: "Sequential chain, no resync. One loss breaks every later packet.", color: "#f43f5e", print: "#e11d48" },
  { id: "cache", tag: "L2", name: "Caching past states", sub: `Keeps a window of ${CACHE_WINDOW} past states and trial-decrypts ahead to catch up.`, color: "#f59e0b", print: "#d97706" },
  { id: "skip", tag: "L3", name: "SINGLETON-style skipped keys", sub: "Packet carries its chain position. Receiver derives and stores keys for skipped packets.", color: "#8b5cf6", print: "#7c3aed" },
  { id: "seek", tag: "L4", name: "Proposed: seekable counter lane", sub: "Second execution lane computes the missing state from the counter in O(1). Main pipeline never stalls.", color: "#00f0ff", print: "#0e7490", proposed: true },
];

const newStats = () => ({ dec: 0, rec: 0, fail: 0, drop: 0, lastLat: 0, sumLat: 0, nLat: 0, maxLat: 0, stall: 0, mem: 1, maxMem: 1, sync: "SYNCED", rej: 0, acc: 0, late: 0, lateLost: 0 });

export class Sim {
  constructor(L) {
    const seed = crypto.getRandomValues(new Uint8Array(16));
    this.L = L;
    this.sender = new Sender(seed, L);
    this.lanes = [new NoRecovery(seed), new CacheLane(seed, CACHE_WINDOW), new SkipLane(seed, MAX_SKIP), new SeekLane(seed, L)];
    this.stats = this.lanes.map(newStats);
    this.stats[3].mem = this.stats[3].maxMem = 4;
    this.reuse = this.lanes.map(() => new ReuseTracker());
    this.history = new Map();
    this.order = [];
    this.points = [];
    this.sent = 0; this.dropped = 0; this.burstLeft = 0;
    this.env = { t: 22.5, h: 48, p: 1012.5 };
    this.events = []; this.evMap = new Map(); this.evSeq = 0; this.held = null; this.delivered = 0;
  }
  reading() {
    const v = this.env, r = () => Math.random() - 0.5;
    v.t += r() * 0.3; v.h = Math.min(95, Math.max(10, v.h + r())); v.p += r() * 0.4;
    return `S09|T=${v.t.toFixed(2)}C|H=${v.h.toFixed(1)}%|P=${v.p.toFixed(1)}hPa`;
  }
  step({ loss, burst, disorder = 0, force = {} }) {
    const pkt = this.sender.emit(this.reading());
    this.history.set(pkt.i, pkt);
    this.order.push(pkt.i);
    if (this.order.length > HISTORY) this.history.delete(this.order.shift());
    let drop = !!force.drop;
    if (!drop && this.burstLeft > 0) { drop = true; this.burstLeft--; }
    else if (!drop && Math.random() < loss) { drop = true; if (burst) this.burstLeft = 2 + Math.floor(Math.random() * 4); }
    pkt.dropped = drop;
    this.sent++;
    const out = [];
    if (drop) { this.dropped++; out.push(["dropped", pkt]); }
    else {
      const rnd = Math.random() < disorder ? (Math.random() < 0.5 ? "reorder" : "dup") : null;
      const reorder = !this.held && (force.reorder || rnd === "reorder");
      if (reorder) { out.push(["held", pkt]); this.held = pkt; }
      else {
        out.push(["normal", pkt]);
        if (this.held) { out.push(["late", this.held]); this.held = null; }
        if (force.dup || rnd === "dup") out.push(["dup", pkt]);
      }
    }
    if (force.replay) { const old = this.pickReplay(pkt.i); if (old) out.push(["replay", old]); }
    out.forEach(([kind, p]) => this.deliver(kind, p));
    this.point();
  }
  pickReplay(cur) {
    const c = [];
    for (let i = Math.max(0, cur - 40); i < cur - 2; i++) {
      const p = this.history.get(i);
      if (p && !p.dropped && p !== this.held) c.push(p);
    }
    return c.length ? c[Math.floor(Math.random() * c.length)] : null;
  }
  deliver(kind, pkt) {
    const first = kind === "normal" || kind === "late";
    if (first) this.delivered++;
    const res = this.lanes.map((lane, k) => {
      const st = this.stats[k];
      if (kind === "dropped" || kind === "held") {
        if (kind === "dropped") st.drop++;
        return { status: kind, lat: 0, stall: 0, sync: st.sync, pt: null, mem: st.mem, seek: false, note: "" };
      }
      const r = lane.process(pkt);
      let status = r.status;
      if (first) {
        if (status === "decrypted") st.dec++;
        else if (status === "recovered") st.rec++;
        else { status = "failed"; st.fail++; if (kind === "late") st.lateLost++; }
        if (kind === "late" && r.pt) st.late++;
        if (status === "recovered") { st.lastLat = r.lat; st.sumLat += r.lat; st.nLat++; st.maxLat = Math.max(st.maxLat, r.lat); }
      } else if (r.pt) { status = "replayed"; st.acc++; }
      else { status = "rejected"; st.rej++; }
      st.stall += r.stall; st.sync = r.sync;
      if (r.kn) this.reuse[k].add(r.kn, pkt.i);
      st.mem = lane.memory(); st.maxMem = Math.max(st.maxMem, st.mem);
      return { status, lat: r.lat, stall: r.stall, sync: r.sync, pt: r.pt || null, mem: st.mem, seek: !!r.seek, note: r.note || "" };
    });
    const ev = { id: this.evSeq++, kind, pkt, res };
    this.events.push(ev);
    this.evMap.set(ev.id, ev);
    if (this.events.length > HISTORY) this.evMap.delete(this.events.shift().id);
  }
  point() {
    const pt = { i: this.sent - 1 };
    this.stats.forEach((s, k) => {
      const delivered = this.delivered;
      pt[`sr${k}`] = delivered ? +(((s.dec + s.rec) / delivered) * 100).toFixed(1) : 100;
      pt[`mem${k}`] = s.mem;
      pt[`lat${k}`] = s.nLat ? Math.round(s.sumLat / s.nLat) : 0;
      pt[`stall${k}`] = s.stall;
    });
    this.points.push(pt);
    if (this.points.length > 160) this.points.shift();
  }
  recent(n) { return this.events.slice(-n); }
  leak() { return this.lanes.map((l) => l.leak(this.history)); }
  csv() {
    const rows = ["event,seq,epoch,epoch_offset,channel,lane,status,sync_state,recovery_cycles,stall_cycles,stored_secrets,note,reading"];
    for (const ev of this.events) {
      const p = ev.pkt;
      ev.res.forEach((r, k) => rows.push([ev.id, p.i, p.e, p.j, ev.kind, LANES[k].id, r.status, r.sync, r.lat, r.stall, r.mem, `"${r.note}"`, `"${p.reading}"`].join(",")));
    }
    return rows.join("\n");
  }
}
