# ResyncLab

ResyncLab is a browser-based simulator for comparing packet recovery strategies over a lossy UDP-style channel. It demonstrates packet loss, reordering, duplication, replay, recovery latency, receiver memory, and estimated hardware costs.

This is an educational simulation, not a production cryptographic protocol or hardware implementation.

## Run locally

From the repository root:

```powershell
Set-Location .\frontend
corepack yarn install
corepack yarn start
```

Create a production build with:

```powershell
corepack yarn build
```

## Deploy the frontend to Vercel

Import the repository and configure the project as follows:

- **Root directory:** `frontend`
- **Framework preset:** Create React App
- **Build command:** `yarn build`
- **Output directory:** `build`
- **Install command:** `yarn install --frozen-lockfile`

The simulator currently runs entirely in the browser and does not require the backend. The backend is a separate FastAPI/MongoDB template and needs its own environment configuration if you choose to deploy it.
