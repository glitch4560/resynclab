// Ascon-AEAD128 and Ascon-XOF128 per NIST SP 800-232 (little-endian lanes).
const M = 0xffffffffffffffffn;
const IV_AEAD = 0x00001000808c0001n;
const IV_XOF = 0x0000080000cc0003n;
const RC = [0xf0n, 0xe1n, 0xd2n, 0xc3n, 0xb4n, 0xa5n, 0x96n, 0x87n, 0x78n, 0x69n, 0x5an, 0x4bn];

export const counter = { rounds: 0 };

const ror = (x, n) => ((x >> n) | (x << (64n - n))) & M;

function perm(s, nr) {
  let [x0, x1, x2, x3, x4] = s;
  for (let r = 12 - nr; r < 12; r++) {
    x2 ^= RC[r];
    x0 ^= x4; x4 ^= x3; x2 ^= x1;
    const t0 = (x0 ^ M) & x1, t1 = (x1 ^ M) & x2, t2 = (x2 ^ M) & x3, t3 = (x3 ^ M) & x4, t4 = (x4 ^ M) & x0;
    x0 ^= t1; x1 ^= t2; x2 ^= t3; x3 ^= t4; x4 ^= t0;
    x1 ^= x0; x0 ^= x4; x3 ^= x2; x2 ^= M;
    x0 ^= ror(x0, 19n) ^ ror(x0, 28n);
    x1 ^= ror(x1, 61n) ^ ror(x1, 39n);
    x2 ^= ror(x2, 1n) ^ ror(x2, 6n);
    x3 ^= ror(x3, 10n) ^ ror(x3, 17n);
    x4 ^= ror(x4, 7n) ^ ror(x4, 41n);
  }
  counter.rounds += nr;
  s[0] = x0; s[1] = x1; s[2] = x2; s[3] = x3; s[4] = x4;
}

const ld = (b, o) => {
  let x = 0n;
  for (let i = 7; i >= 0; i--) x = (x << 8n) | BigInt(b[o + i]);
  return x;
};
const st = (x, b, o) => {
  for (let i = 0; i < 8; i++) { b[o + i] = Number(x & 0xffn); x >>= 8n; }
};
const pad = (d, rate) => {
  const o = new Uint8Array((Math.floor(d.length / rate) + 1) * rate);
  o.set(d);
  o[d.length] = 1;
  return o;
};

function init(key, nonce, ad) {
  const K0 = ld(key, 0), K1 = ld(key, 8);
  const s = [IV_AEAD, K0, K1, ld(nonce, 0), ld(nonce, 8)];
  perm(s, 12);
  s[3] ^= K0; s[4] ^= K1;
  if (ad.length) {
    const p = pad(ad, 16);
    for (let o = 0; o < p.length; o += 16) { s[0] ^= ld(p, o); s[1] ^= ld(p, o + 8); perm(s, 8); }
  }
  s[4] ^= 1n << 63n;
  return { s, K0, K1 };
}

function finalize(s, K0, K1) {
  s[2] ^= K0; s[3] ^= K1;
  perm(s, 12);
  const t = new Uint8Array(16);
  st(s[3] ^ K0, t, 0); st(s[4] ^ K1, t, 8);
  return t;
}

export function aeadEncrypt(key, nonce, ad, pt) {
  const { s, K0, K1 } = init(key, nonce, ad);
  const p = pad(pt, 16);
  const c = new Uint8Array(p.length);
  for (let o = 0; o < p.length; o += 16) {
    s[0] ^= ld(p, o); s[1] ^= ld(p, o + 8);
    st(s[0], c, o); st(s[1], c, o + 8);
    if (o + 16 < p.length) perm(s, 8);
  }
  const out = new Uint8Array(pt.length + 16);
  out.set(c.subarray(0, pt.length));
  out.set(finalize(s, K0, K1), pt.length);
  return out;
}

export function aeadDecrypt(key, nonce, ad, ct) {
  if (ct.length < 16) return null;
  const n = ct.length - 16;
  const { s, K0, K1 } = init(key, nonce, ad);
  const pt = new Uint8Array(n);
  let o = 0;
  for (; o + 16 <= n; o += 16) {
    const c0 = ld(ct, o), c1 = ld(ct, o + 8);
    st(s[0] ^ c0, pt, o); st(s[1] ^ c1, pt, o + 8);
    s[0] = c0; s[1] = c1;
    perm(s, 8);
  }
  const blk = new Uint8Array(16);
  st(s[0], blk, 0); st(s[1], blk, 8);
  const r = n - o;
  for (let i = 0; i < r; i++) { pt[o + i] = blk[i] ^ ct[o + i]; blk[i] = ct[o + i]; }
  blk[r] ^= 1;
  s[0] = ld(blk, 0); s[1] = ld(blk, 8);
  const tag = finalize(s, K0, K1);
  let d = 0;
  for (let i = 0; i < 16; i++) d |= tag[i] ^ ct[n + i];
  return d === 0 ? pt : null;
}

export function xof(msg, outLen) {
  const s = [IV_XOF, 0n, 0n, 0n, 0n];
  perm(s, 12);
  const p = pad(msg, 8);
  for (let o = 0; o < p.length; o += 8) { s[0] ^= ld(p, o); perm(s, 12); }
  const out = new Uint8Array(outLen);
  const b = new Uint8Array(8);
  for (let o = 0; o < outLen; o += 8) {
    st(s[0], b, 0);
    out.set(b.subarray(0, Math.min(8, outLen - o)), o);
    if (o + 8 < outLen) perm(s, 12);
  }
  return out;
}
