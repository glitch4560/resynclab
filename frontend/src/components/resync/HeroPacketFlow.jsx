import { useEffect, useRef } from "react";
import { LANES } from "../../lib/sim";

const KIND = { normal: "#10b981", late: "#f59e0b", dup: "#38bdf8", replay: "#fb923c" };
const RESULT = { recovered: ["#a78bfa", "RECOVERED"], failed: ["#f43f5e", "FAIL"], rejected: ["#94a3b8", "DISCARD"], replayed: ["#f97316", "REPLAY!"] };
const SHORT = ["No recovery", "Cache past states", "Skipped keys", "Seek lane"];
const SYNC = { SYNCED: ["#34d399", "IN SYNC"], DESYNCED: ["#fb7185", "DESYNCED"], RESYNCING: ["#fbbf24", "RECOVERING"], SEEK_DIRECT: ["#67e8f9", "SEEK"] };
const D0 = 520;
const D1 = 680;

const bz = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };

export const HeroPacketFlow = ({ sim, loss, armedDrop, onChannelClick, onLaneClick }) => {
  const wrap = useRef(null);
  const cv = useRef(null);
  const props = useRef({});
  props.current = { sim, loss, armedDrop, onChannelClick, onLaneClick };
  const S = useRef({ parts: [], fx: [], queue: [], seen: -1, sim: null, last: 0, flash: [], seekGlow: 0, hover: null, geo: null });

  useEffect(() => {
    const c = cv.current;
    const ctx = c.getContext("2d");
    let W = 0, H = 0, raf;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = wrap.current.getBoundingClientRect();
      W = r.width; H = r.height;
      c.width = W * dpr; c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current);

    const geo = () => {
      const bw = Math.min(210, Math.max(108, W * 0.25));
      const bh = Math.min(66, H * 0.19);
      const sw = Math.min(150, Math.max(78, W * 0.15));
      const cx = W * 0.4;
      const cw = Math.max(34, W * 0.07);
      return { bw, bh, sw, sx: 12, sh: 92, out: [12 + sw, H / 2], cx, cw, rx: W - bw - 12, ys: LANES.map((_, k) => (H / 4) * (k + 0.5)) };
    };
    const path = (g, k, u, seek) => {
      const x0 = g.cx + g.cw / 2, y0 = H / 2, x3 = g.rx, y3 = g.ys[k];
      if (seek) return [bz(x0, x0 + (x3 - x0) * 0.25, x3 - (x3 - x0) * 0.25, x3, u), bz(y0, H + 10, H + 10, y3, u)];
      const mx = x0 + (x3 - x0) * 0.5;
      return [bz(x0, mx, mx, x3, u), bz(y0, y0, y3, y3, u)];
    };
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
    const dot = (x, y, col, r = 4) => {
      ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    };
    const ring = (x, y, col, text) => S.current.fx.push({ x, y, col, text, t0: performance.now() });

    const draw = (t) => {
      const st = S.current;
      const { sim: sm, loss: ls, armedDrop: ad } = props.current;
      const g = geo();
      st.geo = g;
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";

      // links
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -t / 40;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "#10b98155";
      ctx.beginPath(); ctx.moveTo(g.out[0], g.out[1]); ctx.lineTo(g.cx - g.cw / 2, H / 2); ctx.stroke();
      LANES.forEach((m, k) => {
        ctx.strokeStyle = m.color + "44";
        ctx.beginPath();
        for (let u = 0; u <= 1.001; u += 0.05) { const [x, y] = path(g, k, u, false); u ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      });
      const sg = Math.max(0, 1 - (t - st.seekGlow) / 700);
      ctx.strokeStyle = `rgba(0,240,255,${0.25 + sg * 0.6})`;
      ctx.lineWidth = 1.2 + sg * 1.5;
      ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = sg * 14;
      ctx.beginPath();
      for (let u = 0; u <= 1.001; u += 0.04) { const [x, y] = path(g, 3, u, true); u ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      const [lx, ly] = path(g, 3, 0.5, true);
      ctx.font = "600 9px JetBrains Mono"; ctx.fillStyle = "#67e8f9"; ctx.textAlign = "center";
      ctx.fillText("PARALLEL SEEK LANE · s_j = base + j·Δ", lx, Math.min(H - 6, ly + 4));

      // channel
      const top = H * 0.08, bot = H * 0.92, hov = st.hover === "channel";
      ctx.fillStyle = ad ? "rgba(244,63,94,0.16)" : `rgba(244,63,94,${0.03 + ls / 400})`;
      rr(g.cx - g.cw / 2, top, g.cw, bot - top, 10); ctx.fill();
      ctx.strokeStyle = ad ? "#f43f5e" : hov ? "#f43f5e99" : "#2b384e";
      ctx.lineWidth = ad ? 2 : 1; ctx.stroke();
      const amp = 3 + ls * 0.25;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = ["#f43f5e66", "#f59e0b44", "#38bdf844"][i];
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = top + 8; y < bot - 8; y += 4) {
          const x = g.cx + Math.sin(y * 0.07 + t * 0.004 * (i + 1) + i * 2) * amp + (Math.random() - 0.5) * ls * 0.06;
          y === top + 8 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.font = "700 9px JetBrains Mono"; ctx.fillStyle = ad ? "#fda4af" : "#94a3b8";
      ctx.fillText(ad ? "DROP ARMED" : `${ls}% LOSS`, g.cx, top - 2 + 0);
      ctx.fillStyle = hov ? "#fda4af" : "#475569";
      ctx.fillText(hov ? "CLICK: DROP NEXT" : "UDP · 5G EDGE", g.cx, bot + 11);

      // sender
      const sy = H / 2 - g.sh / 2;
      ctx.fillStyle = "#0b1019"; rr(g.sx, sy, g.sw, g.sh, 10); ctx.fill();
      ctx.strokeStyle = "#10b98188"; ctx.lineWidth = 1; ctx.stroke();
      const pr = ((t / 1200) % 1);
      ctx.strokeStyle = `rgba(16,185,129,${1 - pr})`;
      ctx.beginPath(); ctx.arc(g.sx + 18, sy + 20, 4 + pr * 14, 0, 7); ctx.stroke();
      dot(g.sx + 18, sy + 20, "#10b981", 3.5);
      ctx.textAlign = "left";
      ctx.font = "700 10px JetBrains Mono"; ctx.fillStyle = "#e2e8f0"; ctx.fillText("IoT SENSOR", g.sx + 32, sy + 24);
      ctx.font = "9px JetBrains Mono"; ctx.fillStyle = "#64748b";
      ctx.fillText("Ascon-AEAD128", g.sx + 10, sy + 48);
      ctx.fillText("forward-secret", g.sx + 10, sy + 61);
      ctx.font = "700 13px JetBrains Mono"; ctx.fillStyle = "#34d399"; ctx.fillText(`#${sm.sent}`, g.sx + 10, sy + 81);

      // receivers
      LANES.forEach((m, k) => {
        const y = g.ys[k] - g.bh / 2, f = st.flash[k];
        const ft = f ? Math.max(0, 1 - (t - f.t) / 650) : 0;
        const s = sm.stats[k];
        const isH = st.hover === k;
        ctx.fillStyle = "#0b1019"; rr(g.rx, y, g.bw, g.bh, 10); ctx.fill();
        ctx.shadowColor = ft ? f.col : m.color; ctx.shadowBlur = ft * 22 + (m.proposed ? 12 : 0);
        ctx.strokeStyle = ft ? f.col : isH ? "#f1f5f9" : m.color + (m.proposed ? "" : "88");
        ctx.lineWidth = 1 + ft * 1.5 + (isH ? 0.5 : 0); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = m.color; ctx.fillRect(g.rx, y + 8, 3, g.bh - 16);
        ctx.textAlign = "left";
        ctx.font = "700 10px JetBrains Mono"; ctx.fillText(m.tag, g.rx + 10, y + 16);
        ctx.font = "600 10px IBM Plex Sans"; ctx.fillStyle = "#cbd5e1";
        const name = g.bw > 170 || k !== 1 ? SHORT[k] : "Cache";
        ctx.fillText(name, g.rx + 32, y + 16);
        const nameEnd = 32 + ctx.measureText(name).width;
        const sr = sm.delivered ? ((s.dec + s.rec) / sm.delivered) * 100 : 100;
        const [sc, stx] = SYNC[s.sync];
        ctx.font = "700 8.5px JetBrains Mono";
        const syncW = ctx.measureText(stx).width;
        const syncTop = nameEnd + syncW + 14 < g.bw;
        ctx.font = `700 ${syncTop ? 16 : 13}px JetBrains Mono`;
        ctx.fillStyle = sr > 95 ? "#34d399" : sr < 50 ? "#fb7185" : "#fbbf24";
        ctx.fillText(`${sr.toFixed(1)}%`, g.rx + 10, y + g.bh - 12);
        const pctW = ctx.measureText(`${sr.toFixed(1)}%`).width;
        ctx.textAlign = "right"; ctx.font = "700 8.5px JetBrains Mono"; ctx.fillStyle = sc;
        ctx.fillText(stx, g.rx + g.bw - 10, syncTop ? y + 16 : y + g.bh - 12);
        ctx.fillStyle = "#64748b"; ctx.font = "8.5px JetBrains Mono";
        const stallTxt = `stall ${s.stall} · mem ${s.mem}`;
        if (syncTop && 10 + pctW + ctx.measureText(stallTxt).width + 20 < g.bw) ctx.fillText(stallTxt, g.rx + g.bw - 10, y + g.bh - 12);
      });

      // particles
      st.parts = st.parts.filter((p) => {
        const u = (t - p.t0) / (p.stage ? D1 : D0);
        if (p.stage === 0) {
          if (u >= 1) {
            if (p.ev.kind === "dropped") { ring(g.cx, H / 2, "#f43f5e", "DROPPED"); return false; }
            if (p.ev.kind === "held") { ring(g.cx, H / 2, "#f59e0b", "HELD"); return false; }
            p.stage = 1; p.t0 = t; return true;
          }
          const x = g.out[0] + (g.cx - g.out[0]) * u;
          const col = p.ev.kind === "dropped" ? "#f43f5e" : KIND[p.ev.kind] || "#f59e0b";
          for (let i = 3; i > 0; i--) { ctx.globalAlpha = 0.15 * (4 - i); dot(x - i * 7, H / 2, col, 3); }
          ctx.globalAlpha = 1; dot(x, H / 2, col, 4.5);
          if (W > 520) { ctx.font = "8px JetBrains Mono"; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center"; ctx.fillText(p.ev.pkt.i, x, H / 2 - 9); }
          return true;
        }
        if (u >= 1) {
          p.ev.res.forEach((r, k) => {
            const hit = RESULT[r.status];
            st.flash[k] = { t, col: hit ? hit[0] : LANES[k].color };
            if (hit) ring(g.rx - 26, g.ys[k], hit[0], hit[1]);
          });
          return false;
        }
        p.ev.res.forEach((r, k) => {
          const seek = k === 3 && r.seek;
          if (seek) st.seekGlow = t;
          const [x, y] = path(g, k, u, seek);
          const col = seek ? "#00f0ff" : KIND[p.ev.kind] || LANES[k].color;
          const [tx, ty] = path(g, k, Math.max(0, u - 0.05), seek);
          ctx.globalAlpha = 0.35; dot(tx, ty, col, 2.5); ctx.globalAlpha = 1;
          dot(x, y, col, seek ? 4.5 : 3.5);
        });
        return true;
      });

      // effects
      st.fx = st.fx.filter((f) => {
        const u = (t - f.t0) / 800;
        if (u >= 1) return false;
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = f.col; ctx.lineWidth = 2; ctx.shadowColor = f.col; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(f.x, f.y, 6 + u * 26, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.font = "800 9px JetBrains Mono"; ctx.fillStyle = f.col; ctx.textAlign = "center";
        ctx.fillText(f.text, f.x, f.y - 14 - u * 14);
        ctx.globalAlpha = 1;
        return true;
      });
    };

    const loop = (t) => {
      const st = S.current, sm = props.current.sim;
      if (st.sim !== sm) { st.sim = sm; st.parts = []; st.fx = []; st.queue = []; st.flash = []; st.seen = sm.evSeq - 1; }
      for (const ev of sm.events.slice(-40)) if (ev.id > st.seen) { st.queue.push(ev); st.seen = ev.id; }
      if (st.queue.length > 24) st.queue.splice(0, st.queue.length - 24);
      const gap = Math.max(35, 240 - st.queue.length * 25);
      if (st.queue.length && t - st.last > gap) {
        const ev = st.queue.shift();
        st.parts.push({ ev, t0: t, stage: ev.kind === "late" ? 1 : 0 });
        st.last = t;
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const hit = (e) => {
      const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, g = S.current.geo;
      if (!g) return null;
      if (Math.abs(x - g.cx) < g.cw / 2 + 6 && y > H * 0.06 && y < H * 0.94) return "channel";
      const k = g.ys.findIndex((yy) => x >= g.rx && x <= g.rx + g.bw && Math.abs(y - yy) <= g.bh / 2);
      return k >= 0 ? k : null;
    };
    const move = (e) => { const h = hit(e); S.current.hover = h; c.style.cursor = h === null ? "default" : "pointer"; };
    const click = (e) => {
      const h = hit(e);
      if (h === "channel") props.current.onChannelClick();
      else if (h !== null) props.current.onLaneClick(h);
    };
    c.addEventListener("mousemove", move);
    c.addEventListener("click", click);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); c.removeEventListener("mousemove", move); c.removeEventListener("click", click); };
  }, []);

  return (
    <div ref={wrap} className="hero-flow h-[340px] sm:h-[420px]" data-testid="hero-packet-flow">
      <canvas ref={cv} data-testid="hero-canvas" />
      <div className="hero-hint micro hidden sm:block">Click the channel to drop the next packet · click a receiver to jump to its lane</div>
    </div>
  );
};
