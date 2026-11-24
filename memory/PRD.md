# ResyncLab — PRD

## Original problem
User uploaded LitSurvey.pptx (stream cipher desynchronization) and asked "can uh build this project". Approved plan: browser simulator comparing resynchronization methods for a forward-secret, continuous key engine over a lossy UDP-style edge network.

## Architecture
- Frontend-only simulation (React). Backend untouched (template).
- `src/lib/ascon.js`: Ascon-AEAD128 + Ascon-XOF128 (NIST SP 800-232), verified against the pyascon reference, with a round counter used as the cycle model.
- `src/lib/sim.js`: Sender (sequential chain plus the proposed epoch engine s_j = base + j·Δ with a one-way ratchet), 4 lanes, event-based channel (drop / held / late / dup / replay), stats, leak test, CSV.
- `src/lib/sweep.js` (batch sweep), `src/lib/hardware.js` (GE cost model).
- UI: `src/pages/Simulator.jsx`, `src/components/resync/*` (ControlBar, LaneCard, TimelineStrip, PacketInspector, LeakPanel, ComparisonCharts, HardwarePanel, SweepPanel, ReportSheet).

## Implemented
- Phase 1 (June 2026): live stream, loss / burst / drop, 4 lanes, inspector, leak test, live charts, CSV.
- Iteration 2 (June 2026): reorder / duplicate / replay injection plus a random disorder slider; late and replay stats per lane (L4 replay bitmap); hardware cost table (storage bits, perm calls per recovery, stall, GE area); loss-rate sweep 0–50% with charts, table and CSV; printable one-page results report (A4 print CSS).

## Backlog
- P1: save and reload named runs; sweep including disorder; run the sweep in a Web Worker.
- P2: CSV sensor dataset upload; configurable GE constants; previous-epoch grace key option for L4 late packets.
