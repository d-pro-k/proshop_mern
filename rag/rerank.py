#!/usr/bin/env python3
import sys, json
from sentence_transformers import CrossEncoder

# device='cpu' explicitly — avoids CUDA init errors on CPU-only machines (macOS, sandboxes)
reranker = CrossEncoder('BAAI/bge-reranker-v2-m3', device='cpu')

req = json.load(sys.stdin)  # { "query": str, "candidates": [{"id": str, "text": str}, ...] }
pairs = [[req["query"], c["text"]] for c in req["candidates"]]
scores = reranker.predict(pairs).tolist()
out = sorted(
    [{"id": c["id"], "score": float(s)} for c, s in zip(req["candidates"], scores)],
    key=lambda x: -x["score"],
)
json.dump(out, sys.stdout)
