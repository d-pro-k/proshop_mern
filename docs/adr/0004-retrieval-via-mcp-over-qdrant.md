# 0004: Serve Document Retrieval Through an MCP Server Over Qdrant

## Status

Accepted (inferred from current implementation) — with a known unresolved divergence (see Consequences).

## Context

This fork adds a documentation-retrieval subsystem on top of the core MERN app:

- An embedding model (`bge-m3` served by Ollama) turns text into vectors.
- A Qdrant vector store holds the embedded documentation corpus (`rag/docs-corpus/`).
- A `search-docs` MCP server (`mcp/search-docs/src/index.ts`) exposes a `search_project_docs` tool. `AGENTS.md` mandates that agents call this tool first for any question about project functionality, before falling back to grep+read.
- A set of CLI scripts under `rag/` implement ingestion and several query strategies: dense-only (`rag/query.ts`), hybrid dense+BM25 with reciprocal-rank fusion (`rag/hybrid.ts`), and hybrid plus a cross-encoder rerank step (`rag/hybrid-rerank.ts`, `rag/rerank.ts`/`rag/rerank.py`).

The pieces are real and used, but two facts shape this decision. First, the served MCP path and the experimental CLIs target **different** Qdrant collections (`proshop_docs` dense-only vs `proshop_docs_hybrid`). Second, the embedding call and Qdrant client setup are duplicated across roughly six files rather than living in one shared module. No document records which retrieval design is canonical or how the parts relate, which makes the subsystem hard to reason about and easy to drift.

## Decision Drivers

- Give agents a single, stable retrieval entry point rather than a choice of scripts.
- Keep the embedding model, vector store, and collection contract describable in one place.
- Reuse the existing local-first stack (Ollama + Qdrant) without adding a hosted dependency.

## Decision

Document retrieval is served through the `search-docs` MCP server backed by Qdrant, using Ollama-produced embeddings. The MCP tool is the canonical interface agents use to query the documentation corpus; the `rag/` scripts are the ingestion and experimentation surface for the same store.

New retrieval features should extend the MCP server and the shared ingest/query path rather than adding further detached scripts. Converging the embedding and Qdrant-client logic into one shared module, and reconciling the served pipeline with the stronger hybrid/rerank variant, is the intended direction and is tracked as an open architectural item (see Consequences).

## Alternatives

- Expose every pipeline (dense, hybrid, hybrid+rerank) as separate MCP tools — rejected: pushes the retrieval-strategy choice onto the calling agent and multiplies the surface to maintain.
- Keep dense-only as the served path and treat hybrid/rerank purely as research CLIs — rejected as a long-term stance: served quality would permanently lag the best available pipeline and the two collections would keep drifting.
- Replace the local stack with a hosted vector/embedding service — out of scope for a local-first legacy fork.

## Consequences

- Agents have one retrieval interface (`search_project_docs`), consistent with the guidance in `AGENTS.md`.
- **Known divergence (unresolved):** the served MCP path is dense-only against `proshop_docs`, while the better hybrid + rerank pipeline exists only as CLIs against `proshop_docs_hybrid`. The best retrieval quality is currently unreachable from the served interface.
- **Duplication risk:** embedding/Qdrant-client code is copy-pasted across multiple files; a change to the model or collection contract must be made in several places until a shared module exists.
- **Latency cost:** the rerank step spawns a fresh process (cold model load) per query; making the served path use rerank would require a long-lived worker to keep latency acceptable.
- **Configuration surface:** `OLLAMA_URL` and `QDRANT_URL` are read from the environment and reached without validation; this is a server-side-request-forgery surface to address when the canonical path is finalized.

## Confidence

MEDIUM — the MCP-over-Qdrant interface decision is firmly in force and implemented; the canonical pipeline and collection reconciliation are still open.
