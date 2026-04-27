# M2 — Report

## IDE

- Primary IDE: Codex CLI.
- Rules file: `AGENTS.md`.

## Rules diff

- Added the local port rule: this fork uses backend `PORT=5001` and CRA proxy `http://127.0.0.1:5001` because port `5000` is occupied on macOS.
- Added the Node/OpenSSL startup note for the legacy CRA stack: `NODE_OPTIONS=--openssl-legacy-provider npm run client`.
- Added repo-specific guardrails: keep backend ESM imports explicit with `.js`, do not touch Heroku deployment files casually, and isolate dependency upgrades from bugfixes.
- Added seed-data guidance after model or required-field changes so local onboarding remains repeatable.

## Local startup

I ran the project locally with Docker MongoDB, imported seed data, started the backend on `http://localhost:5001`, and started the frontend on `http://localhost:3000`. I verified product loading, frontend proxy calls, PayPal config loading, seeded admin login, and authenticated order creation.

## 3 questions

- Manual estimate: about 6-8 hours to inspect the legacy app, run it, document startup, audit findings, fix one issue, and add the optional docs/tests.
- Most useful IDE feature: fast repo-wide search and iterative patching with command verification. It made it practical to keep docs, findings, and runtime notes tied to actual code instead of assumptions.
- Where AI/runtime assumptions failed: the original setup assumed port `5000` and a plain frontend start. Local verification showed `5000` was occupied and CRA failed on modern Node without the OpenSSL legacy provider, so I aligned the fork on `5001` and documented the workaround.

## NICE-TO-HAVE and EXTRA

- Added `docs/architecture.md` with a Mermaid architecture diagram.
- Added three ADRs under `docs/adr/`.
- Added characterization tests under `experiments/characterization/`.
- Added `docker-compose.yml` and README usage notes.
- Upgraded Mongoose from `5.10.6` to `8.22.1`, adjusted removed APIs/options, and verified seed, backend startup, product/user delete flows, and order creation.
