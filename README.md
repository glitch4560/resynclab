# ResyncLab

**An interactive simulator for studying packet resynchronization in lightweight IoT communication.**

ResyncLab models what happens when encrypted sensor packets are lost, reordered, duplicated, or replayed over a UDP-style edge network. It compares four receiver strategies and visualizes recovery success, latency, pipeline stalls, memory use, and estimated hardware cost.

> **Academic prototype:** ResyncLab is a software simulation for learning and evaluation. It is not a production-ready cryptographic protocol, certified implementation, or hardware design.

## What you can explore

- Watch packets move from an IoT sender through a lossy channel to four receiver strategies.
- Run guided scenarios for clean traffic, a single drop, burst loss, reordering, replay, and harsh channel conditions.
- Adjust packet loss, burst loss, disorder, stream speed, and epoch length.
- Compare:
  1. **No recovery** — sequential state with no resynchronization.
  2. **Past-state caching** — keeps a bounded window of states and searches for a match.
  3. **Skipped keys** — derives and temporarily stores keys for missing packets.
  4. **Seekable counter lane** — computes packet state from its epoch and counter.
- Inspect packet headers, nonces, ciphertext, authentication tags, and receiver results.
- Simulate receiver-memory compromise and compare past-packet exposure.
- Review live charts and hardware-cost estimates, run a loss-rate sweep, and export CSV or a printable report.

## Technology

- React and JavaScript
- Ascon-AEAD128 and Ascon-XOF128 simulation code
- Recharts for live comparisons
- Canvas-based packet-flow animation

The cryptographic primitives and state-management strategies are implemented for this simulator. Timing and gate-equivalent figures are estimates, not measurements from physical hardware.

## Run locally

Install Node.js with Corepack enabled. From the repository root, run:

```powershell
Set-Location .\frontend
corepack yarn install --frozen-lockfile
corepack yarn start
```

Create a production build:

```powershell
corepack yarn build
```

## Deploy the frontend to Vercel

Import this repository into Vercel and use:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Framework preset | Create React App |
| Install command | `yarn install --frozen-lockfile` |
| Build command | `yarn build` |
| Output directory | `build` |

The simulator currently runs entirely in the browser and does not require environment variables or the backend.

## Project structure

```text
frontend/
  src/
    components/resync/  Interface, packet flow, scenarios, charts, and reports
    lib/ascon.js        Ascon primitive simulation
    lib/sim.js          Packet channel and receiver-strategy models
    lib/hardware.js     Illustrative hardware-cost estimates
    lib/sweep.js        Batch loss-rate experiments
backend/
  server.py             Optional FastAPI/MongoDB template; not used by the simulator
```

## Suggested four-person team split

1. **Protocol and security model** — define packet counters, epochs, replay handling, and threat assumptions.
2. **Cryptography and simulation** — implement Ascon operations and receiver-state models.
3. **Frontend and scenarios** — build the interactive dashboard, packet visualization, and channel controls.
4. **Evaluation and reporting** — analyze results, hardware estimates, compromise exposure, and documentation.

## Security note

Do not use this prototype to protect real data. In particular, the proposed seekable-state construction and its compromise-resistance properties require independent cryptographic analysis before any production use.
