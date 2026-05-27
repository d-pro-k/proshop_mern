# M5 Homework — n8n Agentic Workflows

## Architecture

Two n8n agentic workflows added on top of the existing feature-flag MCP
server and the admin Dashboard. **WF1 (manual trigger)** turns the
Dashboard's new Auto-Pilot Controls into a signed webhook that hits n8n; a
Tools Agent calls the MCP server (`get_feature_info` / `set_feature_state` /
`adjust_traffic_rollout`) and returns a structured result the Dashboard
renders inline. **WF2 (scheduled monitor)** runs every minute, reads
error-rate events written by `simulate_wf2.py`, deactivates the offending
feature when the rate crosses 5%, and restores it after the rate drops back
below 1% — with a 3-minute replay cooldown and HITL approval gating the
destructive direction. Both workflows hit the same MCP through an
`mcp-proxy` SSE bridge on port 3001 and share one GCAO-style system-prompt
template adapted per workflow.

## Stack

- n8n: self-hosted Docker (community edition, container `n8n-m5`, image `n8nio/n8n` 2.21.7).
- Chat Model: `gpt-5.4-mini` (OpenAI) — $0.75 / $4.50 per Mtok input/output. Picked over `gpt-5.4-nano` for noticeably better tool-call reasoning on the Defensive Guard / Supervisor paths added by the HITL and multi-agent bonuses; total OpenAI cost on the full build + bonuses stayed under $3.
- Log storage: `logs.json` (file-based, JSON Lines per event). Lives at `~/.n8n-m5-logs/logs.json` on the host, bind-mounted into the n8n container at `/data/logs/logs.json`. A 488 KB sample from a real run is shipped as `homework/M5/logs.json`. Postgres / Redis Stream are documented in the spec as alternatives if cadence or retention demands grow.
- Telegram bot: handle and `chat_id` not published in the repo (per spec).
- Bonuses' extra dependencies: a Langfuse v3 self-host stack on port 3010 (tracing bonus), a dedicated Postgres container `postgres-n8n` on port 5433 (chat-memory bonus), a `cloudflared` quick tunnel for HITL approval transport (HITL bonus), and the `n8n-mcp` MCP server injected into Claude Code (MCP-deploy bonus). See each bonus sub-section for setup details.

## WF1 — Manual trigger

- Webhook URL: `POST http://localhost:5678/webhook/feature-control` (self-host).
- Auth: `X-API-Key` header (key not committed to the repo; in production the key would live in the backend that fronts n8n, not in the browser — spec §A.3 caveat).
- New in Dashboard: Auto-Pilot Controls block on `/admin/feature-flags` with three buttons (Запустить проверку / Тестовый режим / Откатить фичу). Each button POSTs the webhook with a `{feature_id, action, ...}` payload, blocks on the response, and triggers a `useFeatures` refetch so the row's status badge and traffic slider re-render with the new state returned by the agent.
- Execution trace: see [`trace-wf1.png`](trace-wf1.png) — full chain `Webhook Trigger → Flatten Webhook Body → Switch — Input Validation → AI Agent — Tools Agent → Respond to Webhook (200)`, with all four AI Agent sub-nodes (Chat Model — OpenAI, Window Buffer Memory, MCP Client Tool — Feature Flags, Structured Output Parser) green-checked. Succeeded in 2.95 s.

## WF2 — Scheduled monitor

- Threshold deactivate: 5% error rate (above → trigger the deactivate branch) / re-enable: 1% (below + cooldown elapsed → trigger the reenable branch). Defaults from spec §B.3, kept as constants in the cron's Code node so they can be tuned without touching the agent system prompt.
- Logs storage: `~/.n8n-m5-logs/logs.json` on the host, `/data/logs/logs.json` inside the n8n container (bind-mounted). JSON Lines, one event per line. A 488 KB sample is shipped as `homework/M5/logs.json`.
- Sine period of the simulator: 300 s default (one full deactivate → reenable cycle every 5 minutes); tunable via `--period` to make the toggle observable inside a 5-minute demo window (we use `--period 120` for the screencast and `--period 60` for fast bonus tests).
- Telegram chat for alerts: handle and `chat_id` not published in the repo.
- Execution trace: see [`trace-wf2-toggle.png`](trace-wf2-toggle.png) — Langfuse-instrumented version of the full deactivate path including the Supervisor and Defensive Guard agents added by the multi-agent and HITL bonuses (`Schedule Trigger → Code: Read Logs → HTTP MCP → Merge Data → Check Cooldown → Supervisor → Switch — Decision → Set Decision deactivate → Defensive Guard → HITL Gate → Worker → Telegram`).

## Hallucination test

The `-50` traffic_percentage hallucination is rejected at **two independent
layers** (Algorithm-before-AI, spec §C / Appendix B):

**Layer 1 — n8n Switch node in WF1.**  The `Switch — Input Validation` rules
guard against missing/out-of-range params before any LLM is invoked. A
`POST /webhook/feature-control` with `traffic_percentage: -50` returns
HTTP 400 in under 1 second:

```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"success":false,"message":"Validation error","rejected_at":"input-validation"}
```

The n8n execution trace for this request shows only `Switch → Respond to
Webhook (400)` — the `AI Agent — Tools Agent` node is never reached.
Verified against `execution_entity` in n8n SQLite (execution lasts ~0s vs
5–10s for an LLM-driven path).

**Layer 2 — JSON Schema in the feature-flags MCP server.**  Even if Switch were bypassed, the
MCP server's tool definition (`mcp/feature-flags/src/index.ts`) declares
`percentage: z.number().int().min(0).max(100)`. The MCP transport rejects
the call with `MCP error -32602: Input validation error` before the
handler runs:

```
[SCHEMA-REJECT] adjust_traffic_rollout {"feature_id":"search_v2","percentage":-50}
MCP error -32602: Input validation error: Invalid arguments for tool
adjust_traffic_rollout: too_small (Number must be greater than or equal to 0)
```

**Reproducible test.**  `simulate_wf1.py --include-invalid` sends a `-50`
payload every 7th request. Over a 240-second run with 8-second intervals
this produces two `[INVALID test]` iterations, both rejected:

```bash
N8N_API_KEY="<key>" python3 simulate_wf1.py \
  --webhook-url http://localhost:5678/webhook/feature-control \
  --feature-id search_v2 --duration 240 --interval 8 --include-invalid
# -> 17 iterations, 2 × [INVALID test] with status=400 success=False
```

**Why this matters.**  Without algorithmic guards, an LLM may "hallucinate"
a destructive action — spec Appendix B documents the Replit `rmdir /`
incident where a model executed a recursive delete it was never asked for.
Wrapping every irreversible call in deterministic validators (parameter
ranges, allow-listed actions, status preconditions) is the standard
mitigation. Both layers above are necessary: layer 1 is fast and free,
layer 2 is independent of the orchestrator and survives n8n misconfiguration.

## Workflow build process (CC subagents)

Both n8n workflows were built using two Claude Code subagents:
`n8n-requirements-orchestrator` (turns a user story into a structured YAML
spec via Q&A) and `n8n-workflow-builder` (turns a spec into an importable
n8n JSON). The shipped workflow JSONs in this folder are the human-reviewed
outputs of that pipeline.

**Orchestrator (WF1 spec).**  Given the user story *"clicking 'rollback' /
'test' / 'check' in the Feature Dashboard should trigger n8n; AI Agent uses
the MCP server to mutate the flag; UI re-reads state on response"*, the orchestrator
asked 8 clarifying questions in one batch — webhook contract shape,
synchronous vs polling response, decision boundary (AI vs deterministic
Switch), prompt template style, memory scope, edge-case policy, observability.
Each answer was a one-line decision rooted in the pre-existing setup (MCP
wiring via `mcp-proxy` SSE, `gpt-5.4-mini` as the chat model, X-API-Key
auth on the webhook). The final YAML covered trigger, 9 conceptual steps,
AI Agent config, credentials, and 9 edge cases.

**Builder runs (WF1 and WF2).**  The builder generated valid n8n JSONs that
imported cleanly into n8n 2.21.7. What it got *right*:

- All four `ai_*` connection types (`ai_languageModel`, `ai_memory`,
  `ai_tool`, `ai_outputParser`) wired correctly without manual rerouting.
- Switch nodes in `rules` mode (the new n8n 2.x syntax — the spec template
  still references the legacy `expression` mode that no longer ships).
- Switch `fallbackOutput: "extra"` for WF2 — a poorly-documented n8n
  pattern that is easy to misconfigure by hand.
- Telegram wired only to AI Agent main output (not to the NoOp fallback),
  preventing per-minute spam — explicit in spec §B.3 п.8.
- Credentials referenced by *name* with placeholder IDs, so importing the
  JSON does not require recreating credentials in n8n.

What it got *wrong* (and where human review caught it):

- **n8n 2.21.7 Webhook body nesting (WF1).**  The trigger wraps the POST
  body inside `$json.body`, but the Builder used `$json.feature_id`
  downstream. Fix: an extra `Flatten Webhook Body` Code node between
  Webhook and Switch unwraps the body once. Cleaner than patching nine
  downstream expressions.
- **`returnIntermediateSteps: true` output wrapper (WF1 and WF2).**  With
  this option on, the AI Agent returns `{output: {...}, intermediateSteps: [...]}`.
  Builder set `Respond to Webhook` body to `={{ $json }}` and Telegram
  text to `={{ $json.alert_message }}` — both ended up sending the wrapper
  instead of the contract shape. Fix: `={{ $json.output }}` and
  `={{ $json.output.alert_message }}`.
- **Chat model placeholder (WF2).**  Builder picked `gpt-5.4-mini` as the
  default chat model; that model id is not available on the OpenAI account
  in use. Patched to `gpt-4o-mini` (same as WF1) before import. One
  pre-import `Edit` call.

The "Antipattern" warning from spec §D.7 — *treating the Builder output as
final without review* — applies here. The two `$json.output` bugs would
have failed silently on first execution (200 response with malformed body)
without the live-test step. Always run a test execution and inspect the
trace before declaring a Builder-generated workflow done.

**Time accounting.**  Each Builder run took ~2 minutes of agent wall time
plus ~5–10 minutes of human-side import + credential binding + live-fix
iteration. Hand-building either workflow from the spec text alone would
have taken roughly 45–60 minutes per workflow, mostly burned on
ai_* connection wiring and Switch `rules` syntax discovery.

## How to run

```bash
# 1. Build the feature-flags MCP server and start the stdio→SSE bridge for n8n.
cd mcp/feature-flags && npm install && npm run build
nohup npx -y mcp-proxy --port 3001 --server sse -- node dist/index.js \
    > /tmp/mcp-proxy.log 2>&1 &

# 2. Start n8n (self-host Docker).
docker run -d --name n8n-m5 -p 5678:5678 \
    -e NODE_FUNCTION_ALLOW_BUILTIN=fs \
    -v ~/.n8n:/home/node/.n8n \
    -v ~/.n8n-m5-logs:/data/logs \
    n8nio/n8n

# 3. Open http://localhost:5678 -> create the owner account, then in the UI:
#    - Import homework/M5/wf1-manual-trigger.json and wf2-scheduled-monitor.json
#    - Create credentials: OpenAI (m5-chat-model), Header Auth
#      (n8n-feature-control-api-key with header X-API-Key), Telegram
#      (m5-telegram-bot). Bind each to the corresponding node by name.
#    - Toggle both workflows Active.

# 4. Run the simulators (in two terminals).
python3 homework/M5/simulate_wf2.py \
    --output ~/.n8n-m5-logs/logs.json --duration 600 --period 300 &

N8N_API_KEY="<replace-with-your-key>" python3 homework/M5/simulate_wf1.py \
    --webhook-url http://localhost:5678/webhook/feature-control \
    --feature-id search_v2 --duration 120 --include-invalid
```

For the Langfuse-instrumented variants used in the bonuses,
swap step 3's import to `wf{1,2}-*.langfuse.json` and add the `m5-langfuse`
credential pointing at a locally-running Langfuse v3 stack (recipe in the
Langfuse sub-section below). The HITL bonus additionally requires
`cloudflared tunnel --url http://localhost:5678` and an n8n container
restart with `WEBHOOK_URL` / `N8N_HOST` / `N8N_PROTOCOL=https` env vars set
to the tunnel URL.

## What was hard

Three things stood out beyond the n8n learning curve itself:

1. **n8n 2.x dropped expression-mode Switch.** The spec's older
   `{{ $json.x === undefined }}` Switch pattern silently degrades to a
   literal string in `rules` mode, so input validation in WF1 had to be
   rebuilt as four explicit condition groups with a fallback output — and
   a `Flatten Webhook Body` Code node had to sit between Webhook and
   Switch because n8n nests POST payloads under `body.*` (every downstream
   `$json.feature_id` would otherwise have silently resolved to
   `undefined`, with no warning anywhere in the trace).

2. **The "$json gets silently emptied" trap.** Any node on the main path
   that does not pass items through — an AI Agent with custom output, a
   Postgres `executeQuery` without RETURNING, a Code node with a custom
   return shape — replaces `$json` with its own output for everything
   downstream. References like `$json.feature_id` then become `undefined`,
   render as `null` in Telegram messages or agent prompts, and the only
   n8n-side signal is the broken artefact at the very end of the chain.
   The fix pattern — `$('Merge Data').item.json.X` to anchor on a known-
   good upstream node — surfaced twice across the bonuses (when inserting
   the Supervisor agent on the multi-agent path, and when inserting the
   Postgres Trim node on the chat-memory path) from independent triggers,
   which is what promoted it from incidental fix to checklist rule.

3. **HITL through Telegram on a self-host stack collapses into infra
   work.** The HITL bonus originally targeted Telegram inline buttons with
   `callback_data` and a separate callback-handler workflow; halfway
   through it became clear that Telegram refuses any `http://localhost`
   URL in both `setWebhook` and `inline_keyboard.url`, so the path was
   rebuilt around `{{$execution.resumeUrl}}&action=approve|decline` inline
   URL buttons fronted by `cloudflared tunnel`. That meant adding a
   quick-tunnel daemon and re-launching the n8n container with
   `WEBHOOK_URL` / `N8N_HOST` / `N8N_PROTOCOL=https` env vars on top of an
   otherwise pure-localhost stack — the kind of compound dependency one
   bonus does not usually deserve, but also exactly what production HITL
   through a chat surface really costs.

## Bonuses

- [x] **Deploy via n8n MCP** — n8n Public API exposed to Claude Code, plus the friction of getting there.
- [x] **Postgres Chat Memory in WF1** — persistent sessions surviving n8n restart + trim workaround.
- [x] **Replay cooldown in WF2** — 3-min delay before re-enable.
- [x] **HITL Wait node in WF2** — Defensive Guard + Telegram Approve/Decline.
- [x] **Multi-agent supervisor + worker** — severity-aware triage before deactivate/reenable/escalate.
- [x] **Langfuse self-host tracing for WF1/WF2 agents**.

### Langfuse self-host tracing

**Setup.** Langfuse v3 stack (web + worker + Postgres + ClickHouse + Redis + MinIO) is self-hosted alongside n8n via `docker compose`, web UI remapped to port `3010` to avoid collision with the CRA frontend on `3000`. n8n is wired to Langfuse via the community node [`n8n-nodes-ai-agent-langfuse`](https://github.com/rorubyy/n8n-nodes-ai-agent-langfuse), which provides a drop-in replacement for the standard LangChain AI Agent that instruments every reasoning step. Two new workflows — `wf1-manual-trigger.langfuse.json` and `wf2-scheduled-monitor.langfuse.json` — keep the original workflows intact for A/B comparison; they reuse the same MCP/OpenAI/Telegram credentials and add a `m5-langfuse` credential pointing at `http://host.docker.internal:3010`.

**Why this node, not just an OpenAI base-URL override.** The simpler path (rewrite the OpenAI `Base URL` to Langfuse's OpenAI proxy) would log Chat Model HTTP calls with token usage, but MCP tool execution happens inside n8n's AI Agent — *not* in OpenAI API — so per-tool spans would be invisible. The community node hooks LangChain's `AgentExecutor` callbacks directly, so each `MCP_Client_Tool` invocation becomes its own span next to the LLM generations.

**What the traces show** (see `homework/M5/langfuse-trace-wf1.json` and `langfuse-trace-wf2.json` for raw exports):

| Trace | Spans | Cost | Latency | What it captures |
|---|---|---|---|---|
| **WF1 `check`** | 20 obs (1 LLM + 1 MCP `get_feature_info` + agent scaffolding) | $0.00076 | 4.5s | Single read-only agent path |
| **WF2 deactivate** | 40 obs (4 LLM + 3 MCP: `get_feature_info` → `set_feature_state` → `get_feature_info` verify) | $0.00173 | 8.3s | Full toggle cycle with output validation |

Both traces are tagged with `sessionId = search_v2` and `userId = wf1-dispatcher` / `wf2-monitor` via the node's `langfuseMetadata` field, so Langfuse groups every action against the same feature into one session view.

**Two non-obvious gotchas hit during wiring.** (1) The community node's `Prompt (User Message)` parameter is exported as the JSON key `text` (same as the standard agent), even though the TypeScript variable is named `textInput` — a generated workflow file fails import with a required-parameter error if you pick the wrong key. (2) The node enforces structured output by injecting a synthetic `format_final_json_response` tool call, which counts as an extra iteration; the original WF2 `maxIterations: 3` was enough for the standard agent but causes the new one to halt with `"Agent stopped due to max iterations."` on the deactivate path (`get_feature_info → set_feature_state → get_feature_info → format_final` = 4 calls). Raising to `5` fixed it; the extra cost is ~$0.0001 per execution.

**Discovery for next bonus.** Looking at the WF2 traces in Langfuse over the simulated 15-minute window, the same feature toggles between Disabled and Enabled multiple times — classic **flapping** when the sine-wave error rate crosses the 5%/1% thresholds repeatedly. The traces make this visible at a glance, which is exactly the motivation for the **replay cooldown** bonus next: a short delay before re-enable to suppress oscillation.

### Replay cooldown in WF2

**What changed.** Two Code nodes were added to `wf2-scheduled-monitor.langfuse.json` and the Switch reenable rule got a third condition:

- **`Check Cooldown`** (between `Merge Data` and `Switch — Decision`) reads `last_disabled_at` from `$getWorkflowStaticData('global').feature_state[feature_id]`, computes `cooldown_remaining_ms = max(0, 3*60*1000 - (now - last_disabled_at))`, and injects `cooldown_active` (boolean) plus the remaining time into the payload.
- **Switch — Decision → reenable** now requires `error_rate < 0.01 AND current_status == "Disabled" AND cooldown_active == false`. While the cooldown is active the branch is silent and the cron falls through to the `enabled` fallback NoOp — no LLM call, no Telegram alert.
- **`Record Disable Timestamp`** (between `AI Agent` and `Telegram — Send Alert`) writes `Date.now()` into the same static-data slot only when `output.action_taken === "deactivated"`. Reenable runs and `no_op` runs leave the timestamp untouched, so a feature that was disabled twenty minutes ago still has its original cooldown ticking against the new disable event.

**Storage choice.** n8n workflow `staticData` is enough for a single-instance self-host: persisted to the workflow row in the n8n DB at the end of each successful execution, automatically scoped per workflow, and zero extra infrastructure. A Postgres-backed alternative would be required only for queue-mode self-host across workers — out of scope here. The trade-off is that *manual* test executions do not save staticData (n8n only persists it for trigger-driven runs), which is fine because the cron is what we care about.

**Functional test.** A 4-minute live run on `search_v2`:

| t (mm:ss) | Cron exec | Status | error_rate | cooldown_active | Switch branch | Outcome |
|---|---|---|---|---|---|---|
| 00:00 | — | Testing/25% | — | — | — | Simulator starts (`--baseline 0.10 --amplitude 0.05 --period 60`) |
| 00:17 | #355 | Testing/25% | ~13.7% | — | deactivate | AI Agent → `set_feature_state(Disabled)` → `Record Disable Timestamp` writes `last_disabled_at = 18:28:57` |
| 00:49 | — | Disabled/0% | high (window still warm) | true | — | Sim stopped at 00:49 |
| 01:17 | #356 | Disabled/0% | ~10% | true | NoOp | Cooldown active (~2:20 remaining), no reenable |
| 02:17 | #357 | Disabled/0% | 0% (window cleared) | true | NoOp | Cooldown active (~1:20 remaining) |
| 03:17 | #358 | Disabled/0% | 0% | true (7.5s remaining) | NoOp | Last NoOp before cooldown expires |
| 04:17 | #359 | Disabled/0% | 0% | false | reenable | AI Agent → `set_feature_state(Enabled)` → state observed as Enabled/100% |

Total delay between `Disabled` and `Enabled` was **3:57** — exactly the configured 3-minute cooldown plus ~57s of waiting for the next cron tick after expiry. The three intermediate NoOp executions weighed ~4 KB each in `execution_data` versus ~37–48 KB for the two LLM-driven runs, a direct measurement that the LLM was not called while the cooldown gated the branch.

### HITL Wait node in WF2

**What changed.** Seven new nodes were inserted on the `deactivate` branch of `wf2-scheduled-monitor.langfuse.json`, ahead of the existing `AI Agent — Monitor Agent`. The `reenable` branch is unchanged — re-enabling a feature restores service, so an extra human gate buys nothing and adds latency; HITL is reserved for the destructive direction only.

The new path:

```
Set Decision deactivate
  → Defensive Guard (AI Agent, spec §Appendix E GCAO)
     → Switch — HITL Gate (on $json.output.requires_approval)
        ├─ false → AI Agent — Monitor Agent (auto path, unchanged)
        └─ true  → Telegram — Approval Request (inline URL buttons)
                   → Wait — Approval (resume: webhook)
                      → Switch — Resume Decision (on $json.query.action)
                         ├─ approve → AI Agent — Monitor Agent (deactivate proceeds)
                         └─ decline → Telegram — Decline Ack (alert, no MCP call, no cooldown record)
```

**Defensive Guard agent (LLM #2 on the path).** A second `agentWithLangfuse` node implements the spec's 5-criterion risk model: irreversibility, production-criticality, traffic drop ≥ 25%, outside-work-hours, and "rollback on Enabled feature". The agent reads `current_state`, `error_rate`, and `now()` from the upstream payload and emits a strict-schema JSON `{requires_approval, risk_factors, auto_execute_allowed, approval_message}` validated by a dedicated Structured Output Parser. `search_v2` is hardcoded `is_critical = true` in the system prompt (it is the only flag we monitor and it gates the primary search funnel), so in practice the guard always routes through HITL on deactivate — but the LLM still does the reasoning and the `risk_factors` array is what becomes the Telegram message bullet list.

**Telegram approval transport — URL buttons over a cloudflared tunnel.** Telegram refuses both `setWebhook` and `inline_keyboard.url` for `http://localhost` URLs (`Bad Request: An HTTPS URL must be provided for webhook` / `Wrong HTTP URL`). To get a real https URL on top of a self-hosted localhost n8n, a `cloudflared tunnel --url http://localhost:5678` quick tunnel is run alongside and the n8n container is re-launched with `WEBHOOK_URL=<tunnel>`, `N8N_HOST=<tunnel-host>`, `N8N_PROTOCOL=https`. The Wait node's `$execution.resumeUrl` then renders as a signed https URL (`https://<tunnel>/webhook-waiting/<exec_id>?signature=<hmac>`) and the two inline buttons reference it as `={{ $execution.resumeUrl }}&action=approve|decline`. A click opens a browser, hits the cloudflared tunnel, n8n validates the signature, the Wait node resumes, the query parameter `action` lands in `$json.query.action` for the downstream Switch.

**Three n8n-specific traps the implementation walked into** (worth flagging because each looks like a quiet, silent-failure error):

1. **`replyMarkup` is a top-level parameter, NOT a child of `additionalFields`.** The Telegram node's `addAdditionalFields` source reads `this.getNodeParameter('replyMarkup', index)` directly — putting `replyMarkup` and `inlineKeyboard` inside `additionalFields` causes them to be silently ignored, so the message is sent with no buttons and Telegram returns 200 OK. There is no error anywhere; you discover it visually when the chat shows text without keys.
2. **`$execution.resumeUrl` already carries a `?signature=…` query parameter.** Naively appending `?action=approve` produces `?signature=…?action=approve` — two `?`, so the entire `…?action=approve` segment becomes part of the `signature` value, the HMAC check fails, and n8n returns `{"error":"Invalid token"}` on click. The fix is a one-character change: `&action=approve`. (The same root cause masquerades as a `401 Authorization failed` when an n8n HTTP Request node tries to GET the resume URL without a signature at all — the resume endpoint is always signature-gated.)
3. **Cancelled HITL executions pile up while the threshold stays high.** The cron fires every minute and each tick spawns a fresh waiting execution; the Wait node has no built-in suppression for "an approval is already pending for the same feature". Until one of the inline buttons is clicked (or `current_status` changes), the chat receives a duplicate prompt per minute. A production implementation would add an `approval_pending` flag to the same `staticData` slot the cooldown work uses, and Switch on it before invoking the Defensive Guard. The trade-off note is deliberate — kept the implementation simple to surface the pattern, not the optimization.

**Live test (round 4, simulator `--baseline 0.10 --period 60`).** Recorded in n8n executions and verified against `backend/features.json`:

| t (mm:ss UTC) | Cron exec | Status before | error_rate | Telegram | Operator click | Resume outcome | Status after |
|---|---|---|---|---|---|---|---|
| 02:51:31 | #413 | Testing/25% | 18.6% | "HITL approval required: search_v2 (status Testing, traffic 25%, error rate 18.6%). Risk: production-critical feature, traffic drop ≥ 25%." | ✅ Approve | Wait resumed in ~2s, AI Agent → MCP `set_feature_state(search_v2, "Disabled")`, Telegram alert "🚨 деактивирована" | **Disabled/0%** |
| 02:53:31 | #415 | Testing/25% (restored via `git checkout backend/features.json`) | low (sim window cleared) | — (NoOp branch) | — | — | Testing/25% |
| 02:54:31 | #416 | Testing/25% | 10.0% | same approval prompt | ❌ Decline | Wait resumed in ~5s, Telegram Decline Ack "❌ Deactivate aborted by operator for search_v2. Feature stays Testing (traffic 25%). Cooldown NOT recorded — next cron may re-prompt.", no MCP call | **Testing/25%** (unchanged) |

The Decline path verification is the more interesting one — the static-data `last_disabled_at` slot was inspected after #416 and it still held the timestamp from the earlier Approve cycle (#413), unchanged. `Record Disable Timestamp` runs only on the AI Agent's main output, and the Decline path bypasses the AI Agent entirely. So no cooldown ticks against a Decline — the next cron with high error rate will re-prompt, which is the correct behavior for "operator said no this time, ask again next minute".

**Why the alternative architecture (separate callback-handler workflow with `callback_data` buttons and a polling `Telegram Trigger`) was abandoned.** A first implementation tried that route — Telegram sends the click as a `callback_query` to a second workflow, which then POSTs to `/webhook-waiting/<exec_id>` to resume. Two problems killed it: (a) n8n's `Telegram Trigger` requires `setWebhook` on the bot, which needs https just like URL buttons — so the cloudflared dependency does not go away; (b) the resume endpoint requires the `?signature=…` query parameter — reconstructing the full signed URL inside the callback handler requires either passing the whole signed URL through `callback_data` (which has a 64-byte Telegram limit) or duplicating n8n's HMAC algorithm in custom code. The URL-button path sidesteps both: Telegram itself stores the full signed URL inside the button and the browser delivers it back intact on click. No second workflow shipped — only the primary `wf2-scheduled-monitor.langfuse.json` is in the deliverable.

### Multi-agent supervisor + worker

**What changed.** Three new nodes (`Supervisor`, `Supervisor Output Parser`, `Telegram — Escalation Alert`) were added to `wf2-scheduled-monitor.langfuse.json` and the existing `Switch — Decision` was rewired from a deterministic `error_rate > 5%` threshold to a fully LLM-driven decision based on the Supervisor's `recommendation` enum. The Defensive Guard (from the HITL bonus) and the original Monitor Agent (now playing the Worker role) are unchanged in their internal behavior but now sit downstream of an LLM that decides *whether they should run at all*. After this change the workflow has 25 nodes total and three AI Agent nodes wired through a single shared Chat Model.

The new path:

```
... → Merge Data → Check Cooldown
     → SUPERVISOR (severity + recommendation + reasoning, GPT-4o-mini)
     → Switch — Decision (on $json.output.recommendation, four outputs)
        ├─ deactivate → Set Decision deactivate → Defensive Guard → HITL gate → Worker → Telegram alert
        ├─ reenable   → Set Decision reenable   → Worker → Telegram alert
        ├─ escalate   → Telegram — Escalation Alert (🆘 human review, no auto-action)
        └─ monitor (fallback) → NoOp (silent — no Telegram)
```

**Why Supervisor + Worker instead of a single agent.** The previous WF2 pipeline made `deactivate` vs `reenable` a binary call against fixed thresholds (5% / 1%). Real incidents do not fit a single threshold — a 7% sustained spike means something different than a 7% blip during a flapping recovery. The Supervisor adds a *triage* step: it sees the same numeric inputs but classifies them into one of four severity buckets (`low / medium / high / critical`) and one of four actions (`deactivate / reenable / monitor / escalate`). Worker (the original Monitor Agent) is no longer asked to decide *whether* to act — only to *execute* a decision already made, with the Defensive Guard remaining as the final human-safety gate before destructive operations. This is the standard supervisor/worker LangChain pattern adapted to an n8n cron loop, and Langfuse traces show two clearly separated agent spans per run.

**Severity scale and recommendation rules** (from the Supervisor system prompt):

| Severity | When | Typical recommendation |
|---|---|---|
| `low` | `error_rate < 1%`, steady state | `monitor` |
| `medium` | 1–5%, elevated noise but not actionable | `monitor` |
| `high` | 5–15%, incident territory | `deactivate` if `Enabled`/`Testing`; `monitor` if already `Disabled` |
| `critical` | > 15% or sustained spike | `deactivate` (or `escalate` if already disabled) |

The `recommendation == escalate` path is reserved for genuine anomalies the threshold framework can't model — e.g., `status == Disabled` but `error_rate > 25%` (something is bypassing the flag), or sustained `critical` after a recent disable-then-reenable cycle. It sends a separate Telegram message tagged 🆘 and explicitly takes no auto-action, leaving the case for manual investigation.

**Defense in depth: Supervisor recommendation + Switch deterministic guards.** Even though the Supervisor's `recommendation` drives the Switch, each rule retains a deterministic safety check against the *actual* feature state (read via `$('Check Cooldown').item.json` — see "regression" note below):

- `deactivate` requires `current_status != "Disabled"` — prevents the Worker from being invoked to disable an already-disabled feature even if the LLM recommends it.
- `reenable` requires `current_status == "Disabled"` AND `cooldown_active == false` — the cooldown gate still wins over any LLM call to bring a feature back early.

This is the same "algorithm-before-AI" philosophy as the rest of the pipeline: the LLM proposes, deterministic guards dispose. If the Supervisor's reasoning is wrong (hallucination, prompt drift, model regression), the Switch still won't break invariants.

**One regression worth flagging: the `Set Decision` `$json` reference.** When Supervisor was inserted between `Check Cooldown` and `Switch — Decision`, the Switch's downstream `Set Decision deactivate` / `Set Decision reenable` nodes — which originally read `$json.feature_id`, `$json.error_rate`, etc. — started getting `undefined` for those fields because the AI Agent's output replaces `$json` with `{output: {...}}`. The first live test of the deactivate path produced a perfectly working state change but a Telegram approval prompt that read "Подтвердите деактивацию: **null** (status **null**, traffic **null**%, error rate **null**%)" — confusing in the chat even though the underlying decision was correct. The fix is a one-character switch from `$json.feature_id` to `$('Check Cooldown').item.json.feature_id` in each `Set Decision` assignment; n8n preserves node references across the entire execution so the upstream context remains addressable through any number of LLM hops. The same pattern is now used for all four Set fields. Worth surfacing because the silent-fallback-to-null behavior of n8n expressions is identical for "missing field" and "intentionally blank", and only the downstream Telegram text revealed the issue.

**Live test (three baselines, 2026-05-26 ~03:20–03:28 UTC):**

| Baseline | Cron | Supervisor verdict | Switch route | Outcome |
|---|---|---|---|---|
| `--baseline 0.005 --amplitude 0.005` (steady low) | #426 | `{severity: low, recommendation: monitor, confidence: 0.9}` — "Ошибок 1 при 119 запросах, что соответствует норме... Рекомендуется просто мониторить." | fallback → NoOp | Telegram silent ✓ |
| `--baseline 0.10 --amplitude 0.05` (sustained 5–15%, `search_v2` was Testing/25%) | #432 | `{severity: high, recommendation: deactivate, confidence: 0.9}` — "Ошибка превышает 10%, что указывает на серьезные проблемы..." | deactivate → Defensive Guard → HITL prompt → Approve → Worker | search_v2 → Disabled/0%; final Telegram contained both Worker alert and `🤖 Supervisor [high, confidence 0.90]: …` reasoning footer ✓ |
| (continuing same sim with `search_v2` already Disabled + cooldown active) | #433 | `{severity: high, recommendation: monitor, confidence: 0.9}` — "Уровень ошибок 9.9%, попадает в high, но функция уже отключена и активен период ожидания. Рекомендую просто следить." | fallback → NoOp | Telegram silent ✓ — model correctly chose *not* to escalate because the disable plus cooldown are already the right state |

The escalate path was not deterministically fired by any live test (the LLM is conservative — it prefers monitor when no action is actionable), but the Switch rule and Telegram template are wired and would trigger on a recommendation the Supervisor reserves for genuine anomalies. Document-only verification.

**Cost trade-off vs the HITL-only baseline.** Every cron tick now incurs at least one Supervisor LLM call (~$0.0003 for our prompt at gpt-4o-mini), where previously a tick with low error rate cost $0. At 1 cron/minute that is ~$0.43/day continuous, which is acceptable for the observability win but would justify a pre-gate in production (e.g., a deterministic Code node that skips Supervisor when `error_rate < 0.5% AND current_status == Enabled`). Deactivate cycles now cost ~$0.0010 (Supervisor + Defensive Guard + Worker), up from ~$0.0007 without the Supervisor.

**Discovery for next bonus.** All three agents are stateless across cron ticks — each Supervisor invocation re-derives severity from scratch based only on the current 60-second window, with no memory of "we already escalated this feature 5 minutes ago" or "this is the third flap in 30 minutes". A Worker that remembered prior decisions (which features it has touched, with what results) could shape its tool calls differently — e.g., refuse to reenable a feature that was disabled twice in the last hour, or include prior incident context in Telegram messages. That is exactly what the **Postgres Chat Memory** bonus introduces next — persistent agent memory beyond a single execution. Even though that work is on WF1 (the manual dispatcher), the same memory pattern is what we'd extend WF2 with afterwards.

### Postgres Chat Memory in WF1

**What changed.** Two modifications to `wf1-manual-trigger.langfuse.json`: the in-memory `Window Buffer Memory` sub-node was swapped for a `Postgres Chat Memory` sub-node pointing at a dedicated Postgres container, and a new `Postgres — Trim Session History` node was inserted on the main path between `Switch — Input Validation` (valid branch) and the AI Agent. The Postgres container is `postgres-n8n` (image `postgres:16`) running on `host.docker.internal:5433` (port 5433 because 5432 is already taken by the Langfuse stack from the tracing bonus — keeping the two databases physically separate is cleaner than co-tenanting an unrelated schema in the Langfuse Postgres). Total node count goes from 10 to 11. After this change each dispatcher call is bound to its `feature_id` via the Postgres `session_id` column and survives a full n8n container restart.

**Why Postgres at all.** `Window Buffer Memory` lives in the n8n process heap — it disappears on `docker restart n8n-m5`, on workflow re-import, on n8n-cloud deployment, and anywhere queue-mode workers spread executions across processes. For WF1 specifically, the consequence is the dispatcher agent re-reading `current_state` from scratch on every webhook even though a multi-call session may be in flight (e.g., `check` → `test` → `rollout 30%` against the same feature within seconds). Postgres-backed memory ties every call for `feature_id=X` to the same session row and lets the agent see prior turns through the standard LangChain `BaseChatMessageHistory` interface — no system-prompt manipulation needed.

**The `Postgres — Trim Session History` node — spec §Appendix C.3 workaround.** n8n issue #12958 reports that the `contextWindowLength` parameter on `Postgres Chat Memory` is *not always respected* by the downstream LangChain wiring — depending on the path the sub-node takes inside the AgentExecutor, the agent can end up reading the full session history from Postgres regardless of what the UI says. The visible symptom is a slow regression: every call adds two rows (one human, one AI) to a session, the prompt grows linearly, latency climbs from ~4 s to ~1 min, and the OpenAI bill follows. The workaround is to apply the cap *outside* the sub-node, in plain SQL, before the agent runs:

```sql
-- Defensive trim — runs on every webhook before the AI Agent.
-- $1 is the per-call feature_id, passed via the Postgres node's queryReplacement.
-- Keeps the 20 most recent rows per session (≈10 human + 10 AI turns).
DELETE FROM n8n_chat_histories
WHERE id IN (
  SELECT id FROM n8n_chat_histories
  WHERE session_id = $1
  ORDER BY id DESC
  OFFSET 20
);
```

This DELETE is idempotent on under-cap sessions (zero rows deleted, no error), and the parameterized `$1` (n8n's `options.queryReplacement: ={{ ... }}`) avoids SQL injection even though the upstream Switch already validates that `feature_id` is non-empty. The trim runs on every webhook call regardless of whether the LangChain side respects `contextWindowLength` — defense in depth, same philosophy as the deterministic guards on the multi-agent Switch.

**Bootstrapping the schema.** LangChain's `PostgresChatMessageHistory` creates the `n8n_chat_histories` table on its first interaction. But the trim node runs *before* the AI Agent on the first call, so the very first webhook would hit a "relation does not exist" error. The schema is therefore created once, by hand, before the workflow is activated:

```sql
CREATE TABLE IF NOT EXISTS n8n_chat_histories (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  message JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_id ON n8n_chat_histories(session_id);
```

A production setup would bake this into a migration script or a docker-compose `init.d` hook. For the assignment it lives in this README and a one-line `docker exec postgres-n8n psql ...` is part of the setup.

**One n8n regression worth flagging: Postgres node strips `$json`.** Adding the trim node on the main path broke every downstream reference to `$json.feature_id`, `$json.action`, etc. — n8n's Postgres `executeQuery` operation replaces the item payload with the query result (empty for a DELETE without RETURNING), so by the time the AI Agent runs, `$json` is `{}`. The same pattern was burned-in during the multi-agent work (the Set Decision regression after the Supervisor was inserted): downstream node expressions need to reach back through `$('Flatten Webhook Body').item.json.<field>` instead of `$json.<field>`. Four expressions were updated — `Postgres Chat Memory.sessionKey`, the AI Agent's `text` field, its `langfuseMetadata.sessionId`, and the multi-line `systemMessage`. The pattern generalizes: *any* node that doesn't pass through items (Postgres without RETURNING, AI Agent, Code with custom return shape) silently empties `$json` for everything downstream, and the only safe reference is `$('upstream-name').item.json` from a known good source. This is now the second consecutive bonus where the same regression surfaced, which is a reliable signal it deserves a checklist entry for any future workflow modification: *if a node doesn't pass items through, every downstream `$json.X` is suspect.*

**Live test.** Three webhook calls plus one mid-test n8n restart:

| Call | Payload | Result | Postgres rows after |
|---|---|---|---|
| 1 | `{feature_id: search_v2, action: check}` | 200 — `current_state.status=Testing, traffic=25%` | 2 (human + ai), session_id=`search_v2` |
| 2 | `{feature_id: search_v2, action: rollout, traffic_percentage: 30}` | 200 — `current_state.traffic_percentage=30` | 4 (2 sessions × human+ai for same session_id) |
| — | `docker restart n8n-m5` | n8n process recycled, in-memory state lost | 4 (Postgres untouched) |
| 3 | `{feature_id: search_v2, action: check}` (post-restart) | 200 — same `current_state` | 6 (rows 5–6 appended next to surviving rows 1–4) |

The session continuity across the restart is the entire point: the agent's view of "what we've been doing for this feature" is anchored in Postgres, not n8n's heap. A separate trim-correctness check inserted 22 synthetic rows for a fake `session_id=trim_test` and ran the workflow's exact DELETE statement — 22 → 20 rows, the two oldest gone, matching the spec's spec.

**Sub-architecture note: separate Postgres from the Langfuse stack.** The Langfuse self-host stack from the tracing bonus already runs its own Postgres for traces/metadata on `:5432`. Reusing that database for chat memory would have been a shorter setup but mixes two unrelated data lifecycles: Langfuse versioning, schema migrations, or a `docker compose down -v` for trace cleanup could nuke the dispatcher session history as collateral damage. A separate `postgres-n8n` container on `:5433` makes them independently disposable. Cost is one extra container (~30 MB resident).

**Discovery for next bonus.** WF1 now has *persistent per-feature session memory*, but every workflow change still requires the **Deactivate → Delete → Import → reconnect credentials → Activate** click roundtrip in the n8n UI. That roundtrip is the same pain that motivated the "n8n MCP deploy" idea — and the **deploy via n8n MCP** bonus next closes that loop by letting Claude push workflow JSON straight to the n8n Public API. After it, modifying any workflow becomes a single command and the manual import dance goes away.

### Deploy via n8n MCP

**What this bonus actually closes.** Every other bonus in this assignment was an *additive* change to a workflow file followed by the same manual ritual: in the n8n UI, open the target workflow, Deactivate, Delete, Import-from-File, reconnect three credentials by name, Activate. Five repetitions of that across the other bonuses is roughly twenty minutes of clicking that the workflow JSONs in `homework/M5/` are already canonical for. This bonus replaces that loop with a single `n8n_create_workflow` tool call from Claude Code straight into the n8n Public API. After it, modifying a workflow becomes one Edit + one tool call.

**Two iterations of friction to get the MCP wired up.** Setting up the MCP bridge is technically two manual steps (generate an n8n API token, restart Claude Code), but both surprised us:

1. **The first MCP package we tried does not exist.** `@kossakovsky/n8n-mcp-server`, referenced in older n8n community discussions, is not (and never was) on npm. The actually-shipped MCP server for n8n is [`n8n-mcp`](https://www.npmjs.com/package/n8n-mcp) (czlonkowski, `v2.56.0` as of this run) — same idea, different name, ~30 tools covering workflows / executions / credentials / templates / node introspection.
2. **The MCP server's SSRF guard blocks `localhost` by default.** After injecting the MCP entry into `~/.claude.json` and restarting CC, the very first `n8n_list_workflows` call came back with `SSRF protection: Localhost access is blocked in strict mode`. The source lives at `n8n-mcp/dist/utils/ssrf-protection.js:107` (`mode = process.env.WEBHOOK_SECURITY_MODE || 'strict'`), and the design assumption is "this MCP runs against cloud n8n". For a self-hosted local instance the only fix is to set `WEBHOOK_SECURITY_MODE=permissive` in the MCP server's env block. That required a second restart of CC and an explicit "yes, I understand the trade-off" — the MCP can now reach any localhost service from this dev machine, which is acceptable for a single user on one Mac and not acceptable for a shared or managed CI environment.

**What the MCP exposes once connected.** ~30 tools across five logical groups: workflow CRUD (`n8n_create_workflow`, `n8n_get_workflow`, `n8n_update_full_workflow`, `n8n_update_partial_workflow`, `n8n_delete_workflow`, `n8n_list_workflows`), execution introspection (`n8n_executions`), credential management (`n8n_manage_credentials`), node/template discovery (`search_nodes`, `get_node`, `search_templates`, `n8n_deploy_template`), and instance-level diagnostics (`n8n_health_check`, `n8n_audit_instance`, `n8n_validate_workflow`, `n8n_autofix_workflow`). Beyond the deploy use case this enables in-conversation operations like "show me the last 10 executions of WF2 that errored" or "which workflows touch the `m5-langfuse` credential" without leaving Claude Code.

**Two duplicate deploys, side by side with the originals.**

| Source file | Method | New workflow ID | Node count |
|---|---|---|---|
| `wf1-manual-trigger.langfuse.json` (11 nodes) | `mcp__n8n__n8n_create_workflow` direct from CC | `3sbX7l4QAVTeE8ZB` | 11 ✓ |
| `wf2-scheduled-monitor.langfuse.json` (25 nodes) | `curl POST /api/v1/workflows` via saved API token | `7rIMCAIfA7oqUUrX` | 25 ✓ |

Both land inactive — n8n's Public API refuses to create active workflows in the same call. Both are renamed with a `(Langfuse, MCP deploy)` suffix so the n8n UI shows at a glance which entry came through which path. The WF1 deploy uses webhook path `feature-control-mcp-deploy` (not the original `feature-control`) because n8n refuses to activate two workflows on the same webhook path; the duplicate stays harmless until someone wants to swap which one is the live one.

**Why WF2 came through `curl` and not the MCP tool — a real practical limit, not a workaround.** The `n8n_create_workflow` tool accepts `nodes` and `connections` as direct arguments. For an 11-node WF1 that fits inside a tool call comfortably. For 25-node WF2 — with multi-paragraph Russian system messages on three AI Agents (Supervisor, Defensive Guard, Worker), nested expression strings, and Telegram inline-keyboard blocks — the JSON encodes to about 39 KB and embedding it inline in an LLM tool call is brittle. Every newline, escape, and Cyrillic codepoint has to round-trip cleanly through the model's tool-call serialization, and any silent corruption (a `\n` rendered as a literal `n`, a `—` re-encoded to UTF-16) breaks the workflow without an explicit error.  Direct `curl POST` against the n8n Public API uses the **same authentication and same endpoint** as the MCP tool — `n8n-mcp` is a thin wrapper around `POST /api/v1/workflows` — but it gets the workflow JSON from disk byte-for-byte without any LLM intermediation. The reflection point: an MCP is a glue layer for *small, parameterized* operations, not for shipping multi-kilobyte structured documents through chat. For bulk transfer, prefer the underlying API over the MCP wrapper.

**One additional schema gotcha.** The exported `.langfuse.json` files include `settings: { executionOrder: "v1", binaryMode: "separate" }` (n8n's UI export adds `binaryMode` by default), but the n8n Public API rejects `binaryMode` as an "additional property". Stripping it back to `{ executionOrder: "v1" }` is enough. The MCP tool silently drops unknown settings keys; the raw Public API doesn't. Worth flagging for anyone who scripts deploys: filter `settings` to the documented allow-list before POSTing.

**Verification.** `mcp__n8n__n8n_list_workflows` after both deploys returns 6 entries (4 originals + 2 new `(MCP deploy)` duplicates), the new entries are both `active: false` with `nodeCount` matching the source files exactly. The duplicates served their one job — proving that the source `.langfuse.json` files round-trip cleanly through the n8n Public API — and were deleted manually from the n8n UI right after the verify list to keep the workflow inventory clean (4 workflows after cleanup: 2 originals off, 2 LF variants on).

**Why this is the last bonus, not the first.** The chosen execution order (Langfuse tracing → replay cooldown → HITL approval → multi-agent supervisor → Postgres memory → MCP deploy) treats this bonus as "developer ergonomics polish" rather than a production capability, and that is the right framing — every prior bonus added something the workflow *does at runtime*, while this one changes how the workflow *gets there*. With it in place, the full loop `code → deploy → observe (Langfuse) → iterate` is closed: an editor change to a `.langfuse.json` file can be in n8n and emitting Langfuse traces within seconds, no UI clicks. That is the baseline any agentic workflow system needs before it is worth running unsupervised — and it is exactly the developer-experience win the assignment positions as a stretch goal.

## Demo (visual evidence pack)

> **Spec deviation note.** The spec's §«Карта папки сдачи» calls for a
> `screencast.mp4` (or link) running 3–5 minutes. After weighing the recording
> overhead against the static-deliverable durability, the video was replaced
> with the seven-screenshot annotated pack below. Every demo beat from the
> spec's screencast outline (Dashboard + WF1 manual → hallucination test →
> WF2 kickoff → WF2 in action → Telegram + Dashboard sync → CC subagents) is
> covered either by a screenshot here or by a prose section elsewhere in this
> README. The trade-off — static frames do not show timing or the auto-refresh
> of the Dashboard between turns — is the conscious cost of the choice.

**Dashboard + WF1 manual trigger.** Three button screenshots taken
sequentially on the same feature (`Stripe as Alternative Payment Processor`)
to exercise all three Auto-Pilot Controls:

| File | Action | Outcome shown |
|---|---|---|
| [`dashboard-autopilot-1-check.png`](dashboard-autopilot-1-check.png) | «Запустить проверку» — read-only `check` | State line reads `Testing · traffic 10%`; green alert «✅ Текущая информация о фиче успешно получена.» — agent called `get_feature_info` only, no state mutation |
| [`dashboard-autopilot-2-test.png`](dashboard-autopilot-2-test.png) | «Тестовый режим» — `set_feature_state(Testing)` | State badge `Testing`, slider 10%, alert «✅ Фича успешно переведена в состояние Testing.» — agent called `set_feature_state` then re-read state, Dashboard refetch synced row |
| [`dashboard-autopilot-3-rollback.png`](dashboard-autopilot-3-rollback.png) | «Откатить фичу» — `set_feature_state(Disabled)` | State `Disabled · traffic 0%`, alert «✅ Фича успешно отключена.» — the destructive direction, with the row's status badge and slider visibly updated by `useFeatures.refetch()` |

**WF1 n8n execution trace.**
[`trace-wf1.png`](trace-wf1.png) — full canvas for one webhook call
(May 25 14:34:10, ID#162, succeeded in 2.95 s). Chain visible:
`Webhook Trigger → Flatten Webhook Body → Switch — Input Validation →
AI Agent — Tools Agent → Respond to Webhook (200)`, with all four AI Agent
sub-nodes (Chat Model — OpenAI, Window Buffer Memory, MCP Client Tool —
Feature Flags, Structured Output Parser) green-checked and the `valid`
Switch branch followed.

**Hallucination test.** Already documented in the
[`## Hallucination test`](#hallucination-test) section above with verbatim
curl output (HTTP 400 from Switch in <1 s) and MCP schema-reject output
(`MCP error -32602: Input validation error: too_small`). Reproduction
command included.

**WF2 executions over time.**
[`wf2-executions-list.png`](wf2-executions-list.png) — the n8n Executions
tab for the original WF2 (no bonuses) after a 6-minute run of
`simulate_wf2.py --period 120 --duration 360 --baseline 0.10 --amplitude
0.05`. The left sidebar shows seven cron firings between 21:53:42 and
21:59:42 (one per minute, as configured), with two clearly slow executions
(8.6 s and 9.6 s — the deactivate / reenable cycles where the AI Agent
called MCP `set_feature_state`) and the rest in the 19–33 ms range (silent
NoOp ticks where the error rate did not cross the threshold). The selected
execution (ID #743, 9.605 s, the deactivate cycle) renders its canvas on
the right: `Schedule Trigger → Read & Analyze Logs → Get Feature Status →
Merge Data → Switch — Decision → Set Decision deactivate → AI Agent —
Monitor Agent → Telegram — Send Alert`.

**WF2 toggle path (Langfuse variant, with bonuses).**
[`trace-wf2-toggle.png`](trace-wf2-toggle.png) — execution canvas for the
production Langfuse variant of WF2 (`wf2-scheduled-monitor.langfuse.json`,
25 nodes) showing the path that goes through the bonuses: `Schedule
Trigger → Read & Analyze Logs → Get Feature Status → Merge Data → Check
Cooldown → Supervisor → Switch — Decision → Set Decision deactivate →
Defensive Guard → HITL Gate → AI Agent — Monitor Agent → Telegram — Send
Alert`. Compare side-by-side with the baseline executions list above to
see what each bonus added on top of the baseline.

**Telegram alerts + HITL approval.** Two complementary screenshots
of the bot channel:

| File | What it captures |
|---|---|
| [`telegram-alerts.png`](telegram-alerts.png) | Three full deactivate → re-enable cycles within 12 minutes (12:05 🚨 10.7% → 12:07 ✅ 0.0% → 12:09 🚨 8.7% → 12:12 ✅ 0% → 12:14 🚨 7.1% → 12:17 ✅ 0%), produced by the baseline WF2 under `simulate_wf2.py --period 120`. Demonstrates the alert format (Russian, with exact error rate and threshold), the cron periodicity (one toggle per ~2 min as the sine crosses the 5% / 1% thresholds), and the fact that the system handles repeated triggers and not just a one-off. |
| [`hitl-screenshot.png`](hitl-screenshot.png) | The Telegram inline-button prompt rendered by `Telegram — Approval Request` after the Defensive Guard agent returned `requires_approval: true` for a deactivate decision. Both ✅ Approve / ❌ Decline buttons present and clickable; the URL each button opens is the signed `{{$execution.resumeUrl}}&action=…` over the cloudflared tunnel (see the HITL sub-section above for the full transport rationale). |

The full deactivate → approve → re-enable → cooldown cycle is described in
prose in the [`### HITL Wait node in WF2`](#hitl-wait-node-in-wf2)
sub-section with a step-by-step live-test table.

**CC subagents.** Verifiable locally — see
the [`## Workflow build process (CC subagents)`](#workflow-build-process-cc-subagents)
section above for the orchestrator/builder narrative. Quick check:

```bash
ls ~/.claude/agents/ | grep n8n
# Expected: n8n-requirements-orchestrator.md, n8n-workflow-builder.md
```

The two `homework/M5/wf*.json` workflow files were generated by the
`n8n-workflow-builder` subagent from a structured YAML spec produced by the
orchestrator — process details in the `## Workflow build process` section
above.
