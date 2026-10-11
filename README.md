# AI Troubleshooting Agent

A small Express-based demo that simulates an application with different runtime faults and an investigation agent that inspects service health, logs, and version information before returning a diagnosis and next step.

## Features

- Simulated target service with multiple scenarios:
  - `normal`
  - `db_down`
  - `slow`
  - `timeout`
- Two-agent investigation flow:
  - Agent 1: gathers evidence and diagnoses the issue
  - Agent 2: reviews the diagnosis and recommends the next operational action
- Agent investigation endpoint that checks:
  - `/service/health`
  - `/service/logs`
  - `/service/version`
- Simple HTML UI with a Hebrew interface and investigation flow
- Fallback diagnostics when no external model key is configured
- Optional Gemini integration through `GOOGLE_API_KEY` or `GEMINI_API_KEY` for both agents

## Run the app

1. Copy `.env.example` to `.env` and update any values.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   node server.js
   ```

4. Open http://localhost:3000

## API endpoints

- `GET /api/scenarios` — returns available runtime modes
- `POST /api/scenario` — sets the current runtime mode
- `POST /api/provider-key` — saves or clears the runtime Gemini key
- `GET /api/config` — returns current config and provider state
- `POST /api/investigate` — runs the investigation against the internal service
- `GET /service/health` — service health endpoint
- `GET /service/logs` — structured log events with timestamp, level, message, component, code, and context fields
- `GET /service/version` — application version

The investigation endpoint queries the health, logs, and version endpoints independently in parallel. Each request is aborted after 3 seconds; a failed request is reported as incomplete evidence without discarding successful results. The simulated service logs are returned as structured JSON objects so the UI and investigation agent can inspect individual fields.

## Model configuration

The app supports Google Gemini if you provide an API key in `.env` or via the runtime UI:

```env
GOOGLE_API_KEY=your_key_here
```

If no key is present, the app falls back to a deterministic diagnosis from the tool output.

## Demo flow

1. Change the scenario from the dropdown (for example `db_down`)
2. Click "חקור"
3. The agent collects evidence from the service and returns a diagnosis with a recommended next step.

## Notes

- Secrets stay in environment variables or runtime memory, not hard-coded into the app.
- The agent only sees results from the tools, never the source code itself.
