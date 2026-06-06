#!/usr/bin/env python3
"""
Compare three PII-detection strategies for the assistant router on one test set:
  (a) Presidio analyzer (NER + rules)   -> http://localhost:5002/analyze
  (b) Regex (deterministic, no ML)
  (c) LLM classifier (local qwen3:4b via Ollama)

Run:  python3 homework/M7/router/pii-compare.py
The router itself uses Presidio (variant a); this script justifies that choice.
"""
import json
import re
import urllib.request

PRESIDIO_URL = "http://localhost:5002/analyze"
OLLAMA_URL = "http://localhost:11434/api/chat"
ENTITIES = ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD"]

TESTS = [
    "Where is my order?",
    "What laptops do you have in stock?",
    "My email is john@example.com",
    "Call me back at +1 415 555 0132",
    "My card number is 4111 1111 1111 1111",
    "I am John Smith, please track my parcel",
    "Меня зовут Иван Петров",
    "email john@example.com and phone +14155550132",
    "Jane Doe, jane@example.com, card 4242424242424242",
    "what is your return policy",
]


def http_json(url, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def presidio(text):
    try:
        res = http_json(PRESIDIO_URL, {"text": text, "language": "en", "entities": ENTITIES})
        return sorted({e["entity_type"] for e in res})
    except Exception as e:
        return ["ERR:" + str(e)[:30]]


EMAIL_RE = re.compile(r"[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")
CARD_RE = re.compile(r"\b(?:\d[ -]?){13,16}\b")


def regex(text):
    found = []
    if EMAIL_RE.search(text):
        found.append("EMAIL_ADDRESS")
    if PHONE_RE.search(text):
        found.append("PHONE_NUMBER")
    if CARD_RE.search(text):
        found.append("CREDIT_CARD")
    return sorted(set(found))


def llm(text):
    prompt = (
        "You are a PII detector. Return ONLY a JSON array of the PII types present, "
        'chosen from ["PERSON","EMAIL_ADDRESS","PHONE_NUMBER","CREDIT_CARD"]. '
        "If none, return []. No prose. /no_think\n\nText: " + text
    )
    try:
        res = http_json(
            OLLAMA_URL,
            {
                "model": "qwen3:4b-q8_0",
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": 0},
            },
        )
        content = res["message"]["content"]
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.S).strip()
        m = re.search(r"\[.*?\]", content, flags=re.S)
        arr = json.loads(m.group(0)) if m else []
        return sorted({x for x in arr if x in ENTITIES})
    except Exception as e:
        return ["ERR:" + str(e)[:30]]


def main():
    rows = []
    for t in TESTS:
        rows.append((t, presidio(t), regex(t), llm(t)))

    print("| Message | Presidio (a) | Regex (b) | LLM qwen3:4b (c) |")
    print("|---|---|---|---|")
    for t, p, rx, l in rows:
        short = (t[:46] + "…") if len(t) > 47 else t
        f = lambda xs: ", ".join(xs) if xs else "—"
        print(f"| {short} | {f(p)} | {f(rx)} | {f(l)} |")


if __name__ == "__main__":
    main()
