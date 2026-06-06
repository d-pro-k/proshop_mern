# Local model & infrastructure — deploy notes

## Approach

**Path A — Ollama locally.** Ollama runs the open-weight models on the machine and
exposes an OpenAI-compatible endpoint, so the router talks to local and cloud models
through the same client shape (only `base_url`/`model` differ). No GPU rental, and
private requests never leave the machine.

Hardware: Apple Silicon Mac, 48 GB unified memory. Inference runs on the local
CPU/GPU via Ollama. An 8B model answers an agentic (tool-calling) turn in roughly
**20–60 s**; that is acceptable for a personal/learning run. Under real concurrent
load a GPU endpoint would be used for the answering model — but the **routing
decision itself** (PII detection + a 4B intent classifier) is light and CPU-friendly,
so the router never needs a GPU.

## Models

| Role | Model | Quant | Size | Why |
|---|---|---|---|---|
| Processor (answers, calls tools) | `qwen3:8b-q8_0` | Q8_0 | 8.9 GB | `q6_K` is **not published** for `qwen3` on Ollama, so Q8_0 (~99 % of FP16) is used — comfortably above the Q6 floor needed for Russian and reliable tool-calling. The default `qwen3:8b` is Q4, which degrades both, so the quant is set **explicitly**. |
| Intent router (classifier) | `qwen3:4b-q8_0` | Q8_0 | 4.4 GB | Lightweight: classifies whether a turn needs the user's personal data, so the router can keep personal turns on-device. Runs fast on CPU. |

> Explicit quant matters: `ollama pull qwen3:8b-q8_0` (not `qwen3:8b`).

## Endpoints

| Service | Endpoint | Notes |
|---|---|---|
| Ollama (local models) | `http://localhost:11434` (OpenAI-compatible at `/v1`) | Bound to `127.0.0.1` only (not exposed; Ollama has no built-in auth). |
| Presidio analyzer | `POST http://localhost:5002/analyze` | PII detection (NER + rules). |
| Presidio anonymizer | `http://localhost:5003` | Masking/de-masking for the privacy-hardening layer. |
| Router webhook (n8n) | `POST http://localhost:5678/webhook/assistant-chat` | `{ userId, message }` + `Authorization` header. |
| Cloud model | OpenAI `gpt-4o-mini` via an existing API credential | Used for non-private ("clean") turns. |
| Shop API | `http://localhost:5001` | The assistant's scoped tools call back here. |
| MongoDB | `localhost:27017`, db `proshop`, collection `chatlogs` | Tracking log. |

From inside the n8n container, host services are reached via `host.docker.internal:<port>`.

## Working call logs

**Local model (Ollama, OpenAI-compatible), Russian — checks the quant handles RU:**
```
$ curl http://localhost:11434/v1/chat/completions -d \
  '{"model":"qwen3:8b-q8_0","messages":[{"role":"user","content":"Коротко по-русски: что такое интернет-магазин?"}]}'
→ "Интернет-магазин — это онлайн-платформа, где можно заказать и оплатить товары
   или услуги через интернет."
   finish_reason: stop ; usage: prompt_tokens 29, completion_tokens 211
```

**Cloud model (gpt-4o-mini) through the router — a clean question goes to the cloud
and the agent answers from the live catalog:**
```
$ POST /api/assistant/chat  { "message": "What products do you sell?" }
→ "Airpods Wireless Bluetooth Headphones — $89.99 …
   iPhone 11 Pro 256GB Memory — $599.99 …"   (route: cloud, model: gpt-4o-mini)
```

**Presidio analyzer — catches names (NER), email and card:**
```
$ curl -X POST http://localhost:5002/analyze -H 'content-type: application/json' -d \
  '{"text":"My name is John Doe, john@example.com, card 4111111111111111",
    "language":"en","entities":["PERSON","EMAIL_ADDRESS","CREDIT_CARD"]}'
→ [ EMAIL_ADDRESS score 1.0, CREDIT_CARD score 1.0, PERSON score 0.85 ]
```

All three legs verified working: a private message stays on the local model, a clean
one goes to the cloud, and PII detection drives the routing decision.
