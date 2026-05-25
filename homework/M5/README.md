# M5 Homework — n8n Agentic Workflows

> Skeleton — sections are filled in across Parts 1–5. See [`assignments/M5/plan.md`](../../assignments/M5/plan.md) for execution status.

## Architecture (2–3 sentences)

TBD — Part 5.

## Stack

- n8n: self-hosted Docker (community edition, container `n8n-m5`).
- Chat Model: TBD — Part 1 (default: `gpt-5.4-mini`).
- Log storage: `logs.json` (file-based, JSON Lines per event).
- Telegram bot: TBD — Part 2.

## WF1 — Manual trigger

- Webhook URL: TBD — Part 1.
- Auth: `X-API-Key` header (key delivered out-of-band).
- New in Dashboard: Auto-Pilot Controls block on `/admin/feature-flags`.

## WF2 — Scheduled monitor

- Threshold deactivate: TBD — Part 2 / threshold re-enable: TBD — Part 2.
- Logs storage: `logs.json`.
- Sine period of the simulator: TBD — Part 2.
- Telegram chat for alerts: TBD — Part 2.

## Hallucination test

- Defenses: Switch node **and** JSON Schema (both layers).
- Rejection log for `-50%`: TBD — Part 3.

## How to run

```bash
# 1. Import workflows into n8n.
# 2. Configure credentials (MCP M3, Telegram, X-API-Key).
# 3. Start simulators:
python3 simulate_wf2.py --output logs.json --duration 600 --period 120 &
python3 simulate_wf1.py --webhook-url ... --duration 120 --include-invalid
```

## What was hard

TBD — Part 5.

## Bonuses

- [ ] B.1 — Deploy via n8n MCP
- [ ] B.2 — Postgres Chat Memory in WF1
- [ ] B.3 — Replay logic in WF2
- [ ] B.4 — HITL Wait node in WF2
- [ ] B.5 — Multi-agent supervisor + worker
- [ ] B.6 — Langfuse tracing

## Screencast

TBD — Part 5.
