# M7 — Private AI assistant with a data-sensitivity router

This module adds a working AI shopping assistant to the ProShop store and uses it to
demonstrate two things end to end:

- **DZ1 — privacy by architecture.** Every chat turn is routed to a *local* open-weight
  model or a *cloud* frontier model based on **how sensitive the data involved is**,
  not just on the words typed. Private data stays on the machine; only public turns
  reach the cloud.
- **DZ2 — prompt injection, attacked and defended.** The same assistant is made
  deliberately vulnerable behind a feature flag, attacked (direct + indirect / OWASP
  LLM01), then defended with a deterministic, code-level guard and measured with a
  red-team.

The thesis tying both together: **protect the agent's *actions and data flows*, not the
text of its answers.** Privacy and authorization are properties of the architecture and
the trusted code, never of the prompt.

## What was chosen

| Decision | Choice | Why |
|---|---|---|
| Local deployment | **Ollama** on Apple Silicon (48 GB), no GPU rental | OpenAI-compatible endpoint; private requests never leave the machine. See [`0-deploy.md`](0-deploy.md). |
| Local models | `qwen3:8b-q8_0` (answers/tools) + `qwen3:4b-q8_0` (intent classifier) | Q8_0 because `q6_K` is not published for qwen3; above the quant floor for Russian + reliable tool-calling. |
| Cloud provider | **OpenAI `gpt-4o-mini`** (budget tier) | Absorbs routine public traffic cheaply; a frontier model is available for contrast. |
| Router path | **Express proxy → n8n workflow → AI agents** | The trusted Express layer derives identity from the JWT and forwards it; n8n owns PII detection, routing, tool calls and logging. |
| PII detection | **Presidio** (primary) + LLM-node + regex compared | Presidio analyzer drives the routing decision; the three detectors are compared in [`router/pii-detection-comparison.md`](router/pii-detection-comparison.md). |

## Architecture at a glance

```
Customer → ChatWidget → Express POST /api/assistant/chat   (JWT → trusted userId)
                              │
                              ▼
        n8n "Privacy-Aware Chat Router" (WF3)
          Presidio PII scan ─┐
          qwen3:4b intent ───┴─→ Routing Decision ──→ one of:
             • local        → qwen3:8b  (private data never leaves the host)
             • cloud         → gpt-4o-mini (public turns only)
             • cloud_personal→ minimize + mask on the host, then gpt-4o-mini
                              │
                              ▼
        scoped tools call back to Express (identity from JWT, never from the LLM)
                              │
                              ▼
        every turn logged to MongoDB `chatlogs` → admin "AI Router" dashboard
```

Backend: [`backend/controllers/assistantController.js`](../../backend/controllers/assistantController.js),
[`backend/routes/assistantRoutes.js`](../../backend/routes/assistantRoutes.js),
[`backend/utils/assistantPrivacy.js`](../../backend/utils/assistantPrivacy.js),
[`backend/utils/featureFlag.js`](../../backend/utils/featureFlag.js),
[`backend/models/chatLogModel.js`](../../backend/models/chatLogModel.js).
Frontend: `frontend/src/components/ChatWidget.jsx`,
`frontend/src/screens/admin/AIRouterDashboardScreen.jsx`.
Router export: [`router/workflow.json`](router/workflow.json).

## How to run

Bring up the stack (each in its own shell unless noted):

```bash
# 1. Local model server (bound to localhost; no built-in auth)
ollama serve                     # 127.0.0.1:11434
ollama pull qwen3:8b-q8_0        # explicit quant — not qwen3:8b (that is Q4)
ollama pull qwen3:4b-q8_0

# 2. PII detection
docker run -d --name presidio-analyzer -p 5002:3000 mcr.microsoft.com/presidio-analyzer:latest

# 3. n8n router (already provisioned) + MongoDB
#    Import router/workflow.json into n8n if recreating; credentials are referenced
#    by id (Ollama, OpenAI, MongoDB) and must exist in the n8n credential store.

# 4. Backend + frontend
npm run server                   # Express :5001
npm run client                   # React :3000
```

Seed users (password `123456`): `admin@example.com`, `john@example.com`, `jane@example.com`.
Open http://localhost:3000, log in, and use the chat bubble (bottom-right). The admin
"AI Router" dashboard is at `/admin/ai-router`.

## Reproduce the evidence

- **DZ1 routing demo** — 11 mixed RU/EN turns with their routing decisions, dashboard
  screenshots and logs: [`demo/`](demo/). Analysis: [`writeup-dz1.md`](writeup-dz1.md).
- **DZ2 attack/defense** — vulnerable build, before/after logs, red-team and analysis:
  [`dz2/`](dz2/) (start with [`dz2/README.md`](dz2/README.md)). Toggle the demo flag and
  re-run the attacks with the scripts in [`dz2/tools/`](dz2/tools/).

## Tests

New code is covered in the repo test directory (`homework/M7/tests/`), run with Vitest
from the repo root:

```bash
npx vitest run        # 49 tests — privacy invariants, cost, logs, chat proxy, DZ2 scope guards
```

The key security test asserts the deterministic guarantee behind DZ2: scoped tools take
identity from the JWT (never from LLM-supplied arguments) and the broad/admin tools
refuse with 403 unless the demo flag is enabled.

## Deliverables map

| Path | What |
|---|---|
| [`0-deploy.md`](0-deploy.md) | Local-model + infrastructure deploy notes, with working-call logs |
| [`router/`](router/) | n8n `workflow.json` export + PII-detector comparison |
| [`demo/`](demo/) | DZ1 proof: routing logs + dashboard screenshots |
| [`writeup-dz1.md`](writeup-dz1.md) | DZ1 analysis (routing, privacy layers, economics) |
| [`dz2/`](dz2/) | DZ2: vulnerable build, before/after logs, red-team, `writeup-dz2.md` |
| [`tests/`](tests/) | Vitest suites for the new backend code |
