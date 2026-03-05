# AI-Powered 3D Global Flight Tracker

A real-time, AI-powered 3D flight tracker built on Cloudflare's developer platform as part of the optional engineering assignment.

Track every plane in the sky on an interactive 3D globe, chat with an AI assistant about any flight, and bookmark flights to follow — all powered by Cloudflare's edge infrastructure.

---

## What It Does

- Live 3D globe with every airborne plane on Earth rendered in real time
- Real flight data powered by the OpenSky Network's free ADS-B API (no API key required)
- AI chat assistant powered by Llama 3.3 — ask anything about flights, routes, or airports
- Persistent memory — bookmarked flights and chat history saved via Durable Objects
- Search any flight by callsign (e.g. UAL123, BAW456, DLH400)
- Click any plane to see real-time altitude, speed, heading, and origin country

---

## Architecture

| Assignment Requirement | Solution |
|---|---|
| LLM | Llama 3.3 70B via Cloudflare Workers AI |
| Workflow / Coordination | Cloudflare Workers + Agents SDK (Durable Objects) |
| User Input | Chat UI + flight search via Cloudflare Pages |
| Memory / State | Durable Objects built-in SQL via Agents SDK |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend Agent | Cloudflare Workers + Agents SDK |
| AI Model | Llama 3.3 70B (Workers AI) |
| State / Memory | Durable Objects (SQLite) |
| Frontend | Vanilla JS + Three.js, hosted on Cloudflare Pages |
| 3D Globe | Three.js r128 |
| Flight Data | OpenSky Network REST API (free, no key needed) |

---

## Project Structure

```
flight-tracker/
├── README.md
├── worker/
│   ├── package.json          # Worker dependencies
│   ├── wrangler.jsonc        # Cloudflare config (AI binding + Durable Objects)
│   └── src/
│       └── index.ts          # Agent: OpenSky proxy, Llama 3.3 chat, state management
└── frontend/
    ├── index.html            # App shell and UI layout
    ├── globe.js              # Three.js 3D globe, live plane sprites, drag/zoom/click
    └── chat.js               # AI chat panel
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Wrangler CLI — install with: `npm install -g wrangler`

---

## Deployment

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/flight-tracker.git
cd flight-tracker
```

### 2. Deploy the Worker (backend)

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

After deploying, copy the worker URL shown in the terminal. It will look like:
`https://flight-tracker-worker.YOUR_SUBDOMAIN.workers.dev`

### 3. Set the worker URL in the frontend

Open `frontend/globe.js` and replace line 3:

```js
const WORKER_URL = "https://flight-tracker-worker.YOUR_SUBDOMAIN.workers.dev";
```

### 4. Deploy the frontend (Cloudflare Pages)

```bash
cd ../frontend
npx wrangler pages deploy . --project-name=flight-tracker
```

Your app is now live on Cloudflare's global edge network.

---

## Local Development

```bash
# Terminal 1 — run the worker locally
cd worker
npx wrangler dev

# Terminal 2 — serve the frontend
cd frontend
npx serve .
# Then open http://localhost:3000 in your browser
# Make sure WORKER_URL in globe.js points to http://localhost:8787
```

---

## How It Works

### Data Flow

```
OpenSky Network API  (polled every 12 seconds)
        |
Cloudflare Worker (FlightAgent)
        |-- Caches flight state in Durable Object
        |-- Serves /flights  --> frontend globe
        |-- Serves /chat     --> Llama 3.3 on Workers AI
        |-- Serves /track    --> saves bookmarked callsigns
        |
Three.js Globe (frontend)
        |-- Renders live plane positions on rotating 3D Earth
        |-- Click a plane    --> shows flight detail panel
        |-- Chat panel       --> talks to AI with live flight context
```

### Flight Data

The OpenSky Network API is free and requires no API key for anonymous access. It returns live ADS-B state vectors for every tracked aircraft globally, updated every 10–15 seconds. Typical coverage is 5,000–15,000 airborne flights at any given time.

### AI Assistant

The Llama 3.3 70B model is given a live snapshot of current flights as context on every request, so it can answer specific questions like:
- "Which flights are currently over the North Atlantic?"
- "What altitude is UAL123 flying at?"
- "Which country does this flight originate from?"

Chat history is persisted in the Durable Object so the assistant remembers context across the session.

---

## Cloudflare Bindings

These are configured automatically via `wrangler.jsonc` — no manual setup needed.

| Binding | Purpose |
|---|---|
| `AI` | Workers AI — Llama 3.3 inference |
| `FlightAgent` | Durable Object — persistent state and chat memory |

---

## Assignment Requirements

- LLM: Llama 3.3 70B on Cloudflare Workers AI
- Workflow / Coordination: Cloudflare Workers Agent backed by Durable Objects
- User Input via Chat: Real-time chat UI and flight search on Cloudflare Pages
- Memory / State: Agent persists tracked flights and chat history in Durable Object SQL
