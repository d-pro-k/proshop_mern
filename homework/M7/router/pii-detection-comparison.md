# PII detection — three strategies compared

The router decides **local vs cloud** by detecting PII in the user's message. Three
strategies were evaluated on the same test set; the workflow ships with **Presidio**.
Reproduce with `python3 homework/M7/router/pii-compare.py` (needs Presidio on :5002
and Ollama with `qwen3:4b-q8_0`).

## Results

| Message | Presidio (NER+rules) | Regex | LLM (qwen3:4b) |
|---|---|---|---|
| Where is my order? | — | — | — |
| What laptops do you have in stock? | — | — | — |
| My email is john@example.com | EMAIL_ADDRESS | EMAIL_ADDRESS | EMAIL_ADDRESS |
| Call me back at +1 415 555 0132 | PHONE_NUMBER | PHONE_NUMBER | PHONE_NUMBER |
| My card number is 4111 1111 1111 1111 | CREDIT_CARD | CREDIT_CARD, **PHONE_NUMBER** | CREDIT_CARD |
| I am John Smith, please track my parcel | PERSON | **—** | PERSON |
| Меня зовут Иван Петров (RU name) | **—** | **—** | PERSON |
| email john@…, phone +14155550132 | EMAIL_ADDRESS, PHONE_NUMBER | EMAIL_ADDRESS, PHONE_NUMBER | EMAIL_ADDRESS, PHONE_NUMBER |
| Jane Doe, jane@…, card 4242…4242 | CREDIT_CARD, EMAIL_ADDRESS, PERSON | CREDIT_CARD, EMAIL_ADDRESS, **PHONE_NUMBER** | CREDIT_CARD, EMAIL_ADDRESS, PERSON |
| what is your return policy | — | — | — |

(**bold** = wrong: a miss or a false positive.)

## Trade-offs

| | Presidio | Regex | LLM (qwen3:4b) |
|---|---|---|---|
| Structured PII (email/phone/card) | ✅ | ✅ | ✅ |
| **Names (NER)** | ✅ English; ❌ misses Cyrillic name | ❌ never | ✅ incl. Russian |
| False positives | none observed | card digits also matched as PHONE_NUMBER | none observed |
| Deterministic | ✅ (rules+model, stable) | ✅ fully | ❌ probabilistic |
| Latency | ~10–30 ms | <1 ms | ~1–3 s (a model call) |
| Infrastructure | Docker container | none | a running model |
| CPU only (router must be cheap) | ✅ | ✅ | ✅ (small model) but heaviest |

## Decision

The router uses **Presidio**. It is the only deterministic option that catches
**names** (the regex cannot, and names are common PII in "track my order, I'm
&lt;name&gt;" messages), and it adds no false positives. The regex is kept as a
zero-infra fallback but is unsafe alone (misses names, and miscounts card digits as
phone numbers). The LLM detector is the most capable (it even catches the Russian
name that Presidio's English model misses) but is probabilistic, slower, and needs a
model — overkill for a routing gate that must stay light.

**Known gap:** Presidio's English model misses Cyrillic names. For a Russian-facing
shop this matters — mitigations are to load Presidio's multilingual/Russian
recognizer, or to fall back to the small LLM detector for non-Latin text. This is a
configuration choice, not a change to the routing architecture.
