# Cloud Review — Model & Topology A/B Comparison

Three configurations of the GitHub Actions cloud review (`.github/workflows/claude-pr-review.yml`) were run against **the same pull request and the same diff** (the four Stage 2 security fixes), so differences reflect the model/topology, not the input.

> **N = 1 disclaimer.** This is a single observation on one real PR in this repository, not a benchmark. Token counts and dollar costs are the actual values reported by each run (`total_cost_usd`). Treat the qualitative differences as "what happened on this case," not as a general claim that one model is X% better.

## Configurations

| Config | Model | Topology | Turns | Cost (USD) | Comments posted |
|---|---|---|---|---|---|
| Sonnet single | `claude-sonnet-4-6` | 1 agent | 32 | **$0.705** | 1 summary + 7 inline |
| Opus single | `claude-opus-4-8` | 1 agent | 24 | **$1.377** | 1 summary + 4 inline |
| Opus Agent Team | `claude-opus-4-8` | lead + 3 specialist sub-agents (security / architecture / performance), parallel, peer mailbox | 43 | **$3.901** | 1 summary + 5 inline + artifact |

Cost ratio ≈ **1 : 2 : 5.5** (Sonnet single : Opus single : Opus team).

## What each configuration found

**All three agreed on the substance of the fixes:** the IDOR, JWT-algorithm, and feature-flags fixes are correct, and two issues recur in every run — `updateOrderToPaid` still trusts `paymentResult` from `req.body` (the second half of SEC-02 is unresolved), and the feature-flags change ships a frontend 401 regression. That agreement on the core is itself a useful signal.

The differences:

- **Sonnet single — broadest surface.** It was the only config to flag the **CI/infra security** of the workflow change itself (`--permission-mode bypassPermissions` as a prompt-injection vector on fork PRs; `id-token: write` without an OIDC consumer), plus a `vitest` Node-version note. More findings (7 inline), wider net, lowest cost.
- **Opus single — deeper on code correctness.** Fewer, sharper findings (4 inline). It alone caught a **null-dereference edge case**: `order.user._id.toString()` throws a 500 if the populated user was deleted. Its frontend-regression writeup was the most precise (named both callers and the absence of an `axios.defaults` token).
- **Opus Agent Team — deepest, compound findings.** The three specialists exchanged **8 mailbox messages**, which produced findings no single pass reached: performance-mate **upgraded** the `/login` "brute-force" note into a **bcrypt CPU-amplification DoS** (~50–100 ms/attempt), and surfaced an unguarded `req.body.payer.email_address` → reliable 500 / error-spam DoS. architecture-mate's explicit ADR-0003 ruling prevented the inline ownership check from being double-counted as both a security and an architecture defect. It produced a structured per-mate breakdown (13 combined findings) and a downloadable `synthesis.md` artifact — at ~5.5× the cost of the cheapest run.

## Observations

- **Breadth vs. depth.** On this case, the cheaper Sonnet single pass cast the **widest net** (it owned the CI-security findings), while Opus — especially the team — went **deeper on the code** (edge cases, compound resource-exhaustion analysis). Neither strictly dominated: the best single finding (CI prompt-injection) came from the cheapest run; the deepest analysis (bcrypt DoS, cross-cutting synthesis) came from the most expensive.
- **Team topology earns its premium only for depth.** The Agent Team's value was the cross-specialist collaboration (mailbox messages turning isolated notes into compound findings), not raw coverage. At 5.5× the cost, it suits a deliberate deep-review gate, not every PR.
- **Tiering is the practical conclusion.** Run the cheap single pass on every PR for broad, fast coverage; reserve the Agent Team for an on-demand deep review (here, gated behind a `deep-review` label) when a change warrants it.

## Method notes

- Same PR, same diff for all three runs (only the workflow's model / topology differed between runs).
- Costs are each run's reported `total_cost_usd`; turn counts are reported `num_turns`.
- The single-pass model swap (Sonnet → Opus) was a one-line `--model` change; at the time of this comparison the team run was triggered by a `deep-review` label.

## Postscript — security hardening after this comparison

Getting the review to post at all initially required `--permission-mode bypassPermissions`, and the review itself flagged that as its top finding (a prompt-injection escalation path on PR-triggered jobs). The workflow was subsequently hardened:

- **Single review (runs on every PR):** switched to an explicit least-privilege allowlist (`Read`/`Grep`/`Glob` + scoped `gh pr diff`/`view`/`comment` + the inline-comment MCP tool) with **no `bypassPermissions`** and **no broad `gh api`**. Trade-off: the inline-comment MCP tool is not registered when a custom `settings` allowlist is supplied, so this tier posts a consolidated **summary** review rather than inline threads.
- **Agent Team (the expensive tier):** legitimately needs broad tools (sub-agent spawning, file writes, mailbox), so it retains `bypassPermissions` — but is now **manual-dispatch-only** (no PR-triggered path), so PR content can never reach the broad-tool agent.
- **Defence-in-depth:** both jobs are gated to same-repo PRs; the token is scoped to `contents: read` + `pull-requests: write`.

Net: the everyday automatic review runs least-privilege with no bypass; the broad-tool tier is opt-in and unreachable from untrusted PR content.
