# DZ1 demo — sensitivity router in action

Eleven chat turns (mixed Russian and English) sent through the live assistant
(`POST /api/assistant/chat`, signed in as a regular customer). Each turn shows how
the router decides **where** the turn is processed based on data sensitivity, not
just the raw message text.

Three routing outcomes:

- **local** — handled on-device by `qwen3:8b-q8_0`; data never leaves the machine; $0.
- **cloud** — a public turn handled by `gpt-4o-mini` (no personal data involved).
- **cloud (minimized + masked)** — needs frontier reasoning *and* touches personal
  data, so the order is minimized and the customer's identity is tokenized before
  anything reaches the cloud, then de-tokenized in the reply (see the `MINIMIZED`
  and `MASKED` badges).

Proof files:
- `router-logs.json` — the full per-turn record (route, reason, model, PII entities,
  privacy flags, latency, estimated cost, reply) exported from the tracking store.
- `dashboard.png` — the admin AI Router dashboard showing all eleven turns (route,
  privacy badges, PII column, per-turn cost).

## Results

| # | Lang | Message | What it probes | Route | Model | Privacy |
|---|------|---------|----------------|-------|-------|---------|
| 1 | EN | What products do you sell? | public catalog | cloud | gpt-4o-mini | — |
| 2 | RU | Какие товары у вас есть в наличии? | public catalog | cloud | gpt-4o-mini | — |
| 3 | RU | Посоветуй беспроводные наушники до $100 | recommendation but **no** personal data | cloud | gpt-4o-mini | — |
| 4 | EN | Track my order — my email is john@example.com | PII (email) in the text | local | qwen3:8b | — |
| 5 | RU | Мой email john@example.com — есть новости по моему заказу? | PII (email) in Russian text | local | qwen3:8b | — |
| 6 | RU | Где мой заказ? | clean text, but needs the user's orders | local | qwen3:8b | — |
| 7 | RU | Когда приедет моя посылка? | clean text, needs orders (synonym) | local | qwen3:8b | — |
| 8 | EN | What did I order recently? | clean text, needs orders | local | qwen3:8b | — |
| 9 | EN | Summarize my recent orders and recommend what to buy next | personal data + frontier reasoning | cloud | gpt-4o-mini | **minimized + masked** |
| 10 | RU | Суммируй мои последние заказы и посоветуй, что купить дальше | personal data + frontier reasoning | cloud | gpt-4o-mini | **minimized + masked** |
| 11 | RU | Исходя из моих покупок, посоветуй хороший подарок | personal data + frontier reasoning | local | qwen3:8b | — (see note) |

### What each group shows

- **#1–#3 → cloud.** Public questions go to the frontier model. #3 is the
  interesting one: it asks for a *recommendation* (frontier-style) but touches no
  personal data, so it still goes to the cloud raw — wanting a better model does
  **not** by itself trigger the privacy path.
- **#4–#5 → local (PII in text).** The message itself contains an email address;
  the turn is kept on-device regardless of intent. This holds for Russian text too.
- **#6–#8 → local (tool sensitivity).** The text is clean and would naively look
  "safe for the cloud", but answering needs the customer's own orders. The router
  predicts this and keeps the turn local — closing the leak where personal data is
  pulled from the database *after* a naive text-only routing decision.
- **#9–#10 → cloud, minimized + masked.** These need frontier reasoning over the
  customer's orders. The order is reduced to non-identifying fields and the customer
  name is replaced with a token before the cloud sees it; the real name is restored
  only in the final reply. `router-logs.json` records `minimized: true, masked: true`
  for these two.

### Note on #7 and #11 (PII detection on Russian)

The in-text PII detector runs an English NER model. On some capitalized Russian
words it emits a **false-positive `PERSON`** (score 0.85 — the same score real
English names get, so it cannot be filtered by threshold). That is why #7 and #11
are logged with a `PERSON` entity and routed **local**:

- #7 would have gone local anyway (it needs the user's orders), so the outcome is
  correct; only the stated reason differs.
- #11 was forced local by the false positive instead of taking the minimized+masked
  cloud path. The clean Russian recommendation path is still demonstrated by #10.

Crucially, every misfire here errs **toward more privacy** (local), never less —
the architecture fails safe. A production fix would run a Russian NER model for
Russian input; for this project the behavior is documented rather than worked
around.

## Cost snapshot (this run)

| Metric | Value |
|---|---|
| Total turns | 11 |
| Local (private, $0) | 6 |
| Cloud | 5 |
| Cloud spend (estimated) | ~$0.00125 |
| Estimated saving vs all-cloud | ~$0.0015 |

Per-turn cloud cost is fractions of a cent and is **estimated** from text length
(the agent runtime does not surface token usage); local turns are always $0 because
no API is called. Exact per-turn figures are in `router-logs.json`.
