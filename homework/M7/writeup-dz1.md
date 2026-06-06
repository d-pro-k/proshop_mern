# DZ1 — a privacy-aware AI assistant with a sensitivity router

The assistant added to this shop answers customer questions about the catalog, the
customer's own orders, and their profile. Every chat turn first passes through a
**router** that decides *where* the turn is processed — a local open-weight model on
the machine, or a frontier model in the cloud — based on **how sensitive the data
involved is**, not just on the words the customer typed.

Core thesis, demonstrated end-to-end: **privacy is a property of the architecture,
not a policy bolted on at the end**, and the thing you must protect is the agent's
*actions and data flows*, not the text of its answers.

A run of eleven mixed Russian/English turns and the resulting routing decisions are
in [`demo/`](demo/) (`router-logs.json` + dashboard screenshots).

## What sends a turn to the local model

A turn is kept **local** (on `qwen3:8b-q8_0`, never leaving the machine) when either
of these is true:

1. **PII is present in the message text.** A Presidio analyzer scans every message
   for emails, phone numbers, credit cards and names. If anything is found, the turn
   is local — full stop.
2. **Answering will require the customer's own data.** A small intent classifier
   (`qwen3:4b-q8_0`, prompted as a JSON-schema reasoning task) predicts whether the
   turn needs personal account data (orders, profile, address, payment). If yes and
   the task is a simple lookup, it stays local.

Only turns that are **both** free of PII *and* purely public (catalog, stock,
policies, general knowledge) are eligible for the cloud. A turn that needs personal
data **and** genuinely benefits from frontier reasoning takes a third path —
minimized and masked — described below.

### Why text-only routing is not enough (the trap we close)

The naive version of this router only looks for PII in the user's message. That
leaks. Consider "where is my order?" — there is no PII in the text, so a text-only
router sends it to the cloud. The cloud agent then calls `getMyOrders`, which returns
the name, address and order history, and *that* tool result is fed back into the
cloud model. **The PII leaked into the cloud after the routing decision was made.**

We close this by routing on **tool sensitivity**: tools that can return personal
data (`getMyOrders`, `getMyProfile`) are treated as `PII_SOURCE`, and the classifier
predicts whether the turn will need one *before* routing. In the demo, the clean-text
turns #6–#8 ("где мой заказ?", "когда приедет моя посылка?", "what did I order
recently?") are correctly kept local for this reason.

## The privacy architecture (four layers, increasing strength)

| Layer | Where it lives | What it does |
|---|---|---|
| PII-in-text detection | Presidio analyzer (router) | Any PII in the message → local. |
| Tool-sensitivity routing | intent classifier + router policy | A turn that *will pull* personal data → local, even with clean text. |
| Data minimization | backend (`assistantPrivacy.js`) | When a turn must use the cloud for personal data, the order is reduced to non-identifying fields (`orderId`, `status`, `eta`, totals, line items); name/address/payment/email never leave the machine. |
| PII masking (reversible) | backend, Presidio-driven | Any identifier that must be kept (e.g. the customer name for personalization) is tokenized (`<PERSON_1>`) before the cloud sees it, and restored only in the final reply. |

The key design choice for the last two layers: they run **server-side, at the tool
boundary**, driven by a trusted directive — never by the language model. The
cloud-personal agent has **no tools that return raw personal data**; it only receives
a pre-built, minimized, masked context (and a public catalog tool). So even a
jailbroken or confused cloud model physically cannot reach raw PII — there is no
handle for it to grab. The token→value mapping that reverses the masking stays on the
local perimeter and is never sent to the cloud.

Demo turns #9 and #10 take this path: the dashboard shows `MINIMIZED` and `MASKED`
badges, and the execution record confirms the cloud received `Customer: <PERSON_1>`
with an order stripped of address and payment, while the customer still saw their
real name in the answer.

## Economics — what the router saves

Costs split cleanly:

- **Local turns cost $0** — no API call is made; the data never leaves the machine.
- **Cloud turns** are priced from token usage against the model's rate. The cloud
  model here is a **budget-tier** model (`gpt-4o-mini`), the tier meant to absorb the
  bulk of routine traffic; the system can also call a frontier model for contrast.

The metric that matters is **blended cost** — the average cost per turn across the
whole traffic mix. Every turn the router keeps local drops out of the cloud bill
entirely, so blended cost falls roughly in proportion to the share routed local.

In the eleven-turn sample, 6 turns (~55%) were served locally at $0 and 5 hit the
cloud for an estimated **~$0.00125 total**. Had those 6 local turns also gone to the
cloud at the observed average (~$0.00025/turn), the run would have cost ~55% more;
the dashboard reports the saving as ~$0.0015 for this sample. The proportion scales
with real traffic: the more personal-data and PII turns a shop sees, the more the
router saves — and, more importantly, the more PII it keeps off third-party
infrastructure. Cost is the second-order win; privacy is the first.

(Per-turn cloud cost is an **estimate** from text length, because the agent runtime
does not surface token counts; local turns are exactly $0. See `demo/router-logs.json`.)

## Why the router needs no GPU

The expensive part of an LLM stack is *generating answers*. The **routing decision**
is cheap:

- Presidio PII detection is rule + small-NER, milliseconds on CPU.
- The intent classifier is a 4B model answering one tiny JSON question — a few
  seconds on CPU/Apple-Silicon, no GPU.

Only the *answering* model (`qwen3:8b`) is heavier, and it runs only for local turns;
on a personal/learning deployment its 20–60 s agentic latency is acceptable, and
under real load it is the one component you would move to a GPU endpoint. The router
that *decides* where to send a turn never needs one. Deciding is far cheaper than
doing.

## Honest limitations

- **PII detection on Russian.** The analyzer uses an English NER model. On some
  capitalized Russian words it emits a false-positive `PERSON` at the same confidence
  (0.85) as a real English name, so it cannot be filtered by threshold. In the demo
  this pushed #11 to local instead of the minimized+masked cloud path. Every such
  misfire errs **toward more privacy** (local), never less — the architecture fails
  safe. The proper fix is a Russian NER model for Russian input.
- **Masking is necessary but not sufficient.** Tokenization loses some semantics
  (the model reasons less well over `<PERSON_1>`), is vulnerable to mosaic /
  entity-linking attacks (`<PERSON_1>` lives in `<CITY_1>` and works at `<ORG_1>` can
  still re-identify a person), and custom formats (internal order IDs) are not caught
  without dedicated recognizers.
- **Cost is estimated**, not metered, for cloud turns (see above).

## What "doing it properly in production" looks like

Beyond what is built here, stronger guarantees exist and are worth naming even though
they are out of scope for this project:

- **Dual-LLM pattern** (Willison) — a privileged model with tools never sees raw
  private content; a quarantined model reads private content but has no tools; they
  exchange only symbolic variables. Our minimized+masked path is a lightweight step
  in this direction.
- **CaMeL** (DeepMind) — dual-LLM plus capability/provenance labels and a constrained
  interpreter, so a value tagged "private / readers=alice" physically cannot flow
  somewhere it is not allowed.
- **Zero Data Retention** modes — provider contracts where prompts are not stored
  after the response. A contractual control: it limits retention, but the model still
  reasons over the plaintext during the request.
- **Confidential inference / TEEs** — the prompt is encrypted from client into a
  hardware enclave, so even the provider's infrastructure never sees plaintext.

These form a ladder of increasing assurance: text routing < tool/intent routing <
masking < data-plane separation (dual-LLM / CaMeL / minimization) < confidential
inference. This project implements the first three and the minimization rung, and
documents the rest.
