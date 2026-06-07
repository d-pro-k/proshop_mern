# 0006: AI Assistant via a Data-Sensitivity Router with Code-Scoped Tools

## Status

Accepted — implemented in `backend/controllers/assistantController.js`, `backend/routes/assistantRoutes.js`, `backend/utils/assistantPrivacy.js`, `backend/utils/featureFlag.js`, `backend/models/chatLogModel.js`, the n8n "Privacy-Aware Chat Router" workflow, and the `frontend/src/components/ChatWidget.jsx` / `frontend/src/screens/admin/AIRouterDashboardScreen.jsx` frontend.

## Context

The shop gained an AI assistant that answers questions about the public catalog, the customer's **own** orders, and their profile. Two risks come with making an LLM agentic (able to call tools):

- **Privacy / data residency.** Naively, a cloud model would see whatever the agent reads — including a customer's name, address and order history.
- **Prompt injection (OWASP LLM01) and excessive agency (LLM06).** Attacker-controlled text — typed directly, or embedded in data the agent must read, such as a product review — can steer the agent into actions the user never intended.

The repo already has JWT bearer auth with an `admin` middleware (ADR 0003), a feature-flags JSON store written only through an MCP server (ADR 0005), MCP-over-Qdrant retrieval (ADR 0004), and Ollama running locally. The assistant had to build on these, not introduce a parallel stack, and had to keep guarantees in trusted code rather than in model prompts.

## Decision Drivers

- Private data should stay on the machine unless a turn is provably public.
- The thing protected must be the agent's **actions and data flows**, not the text of its answers — a prompt is not a security boundary.
- Identity must be non-forgeable by the model.
- Reuse existing infrastructure (n8n, Ollama, Presidio, the feature-flags MCP, JWT auth).

## Decision

Run the assistant as a **hybrid pipeline**: a trusted Express proxy (`POST /api/assistant/chat`, `protect`) derives `userId` from the JWT and forwards the turn to an **n8n router workflow**, which owns PII detection, model routing, tool calls and chat logging.

1. **Sensitivity routing (not text routing).** The router combines a Presidio PII scan of the message with a `qwen3:4b` intent classifier (JSON-schema-prompted) that predicts whether the turn needs the customer's own data. A turn is processed **local** (`qwen3:8b` on Ollama) when PII is present or personal data is needed for a simple lookup; **cloud** (`gpt-4o-mini`) only when both PII-free and public; **cloud_personal** (minimized + masked) when personal data genuinely needs frontier reasoning.
2. **Privacy at the tool boundary.** Minimization and reversible PII masking (`assistantPrivacy.js`, Presidio-driven) run server-side. The cloud-personal agent has **no tool that returns raw personal data**; it receives a pre-built minimized/masked context. The token→value map never leaves the host.
3. **Code-scoped tools (the deterministic invariant).** Scoped tools (`/tools/my-orders`, `/tools/my-profile`, `/tools/products`) derive identity from `req.user` (the JWT), **never** from LLM-supplied arguments. The n8n agent calls them with the forwarded bearer token, so a jailbroken agent has no handle to widen scope.
4. **Injection defense (DZ2).** A demo feature flag `assistant_vulnerable_mode` (Disabled by default, toggled only through the feature-flags MCP per ADR 0005) gates broad/admin tools: with the flag off they return **HTTP 403** in trusted code. A hardened system prompt is a second, probabilistic layer. Authorization is enforced in code, not in the prompt.
5. **Observability.** Every turn is logged to a `chatlogs` collection (route, model, PII entities, latency, estimated cost, privacy flags) and surfaced in an admin "AI Router" dashboard.

## Alternatives

- **Text-only PII routing** — rejected: a clean-text turn ("where is my order?") routes to the cloud, then a tool result leaks PII into the cloud model after the decision was made. Routing on tool sensitivity closes this.
- **Prompt-only injection defense** — rejected as the *guarantee*: measured Attack Success Rate stays non-zero (5%) for hardening alone; only the code-level scope guard reaches 0%. Kept as defense-in-depth.
- **Trusting an LLM-supplied user id / a single broad data tool** — rejected: reintroduces exactly the excessive-agency path DZ2 exists to prevent.
- **Cloud-only assistant** — rejected: defeats the data-residency goal; the local tier keeps private turns off third-party infrastructure at $0.

## Consequences

- Private turns never leave the machine and cost $0; only public turns incur cloud spend, lowering blended cost and, more importantly, keeping PII off third-party infrastructure.
- The deterministic scope guard is verifiable and unit-tested (Vitest suites for the assistant): jailbroken arguments cannot widen scope, broad tools 403 unless the flag is enabled.
- **Latency:** an 8B agentic turn takes ~20–60 s locally; acceptable for a learning deployment, would move to a GPU endpoint under real load. The routing decision itself is CPU-cheap and never needs a GPU.
- **Cost is estimated**, not metered, for cloud turns (the agent runtime does not surface token counts); local turns are exactly $0.
- **PII detection uses an English NER model**; it over-flags some Russian names, always erring toward *more* privacy (local). A Russian NER model is the proper fix.
- Masking loses some semantics and is vulnerable to mosaic re-identification; stronger production patterns (Dual-LLM, CaMeL, ZDR, confidential inference) are out of scope for this deployment.
- The router export references credentials by id (Ollama, OpenAI, MongoDB) that must exist in the n8n credential store; no secrets are committed.

## Confidence

HIGH for the code-scoped-tools invariant and the routing policy — both implemented, exercised live, and covered by tests. MEDIUM for the privacy-masking layer (works, but with the documented NER and mosaic-re-identification limits) and for cost figures (estimated, not metered).
