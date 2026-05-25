#!/usr/bin/env python3
"""
simulate_wf1.py — dispatcher for the WF1 manual-trigger workflow.

Drives the n8n WF1 webhook on a timer with rotating actions.
traffic_percentage follows a sine wave so the AI Agent sees both
boundary and mid-range values. With --include-invalid, every 7th
request sends an intentionally invalid percentage (-50) so the Switch
node and MCP JSON-Schema layer can be exercised end-to-end.

Usage:
    python3 simulate_wf1.py --webhook-url https://your-n8n.com/webhook/feature-control --api-key XXX
    python3 simulate_wf1.py ... --duration 120 --interval 10
    python3 simulate_wf1.py ... --include-invalid
"""

import argparse
import math
import os
import sys
import time
from datetime import datetime

import requests


def run(
    webhook_url: str,
    api_key: str,
    feature_id: str,
    duration: float,
    interval: float,
    include_invalid: bool,
) -> None:
    """Run the WF1 dispatcher loop."""
    start = time.time()
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key,
    }

    # Action rotation (sine-driven choice of payload shape).
    actions_cycle = ["check", "test", "rollout", "check", "rollback", "check"]
    iteration = 0

    while time.time() - start < duration:
        t = time.time() - start

        # Sine-wave traffic_percentage between 10 and 90, period 60s.
        traffic_percentage = int(50 + 40 * math.sin(2 * math.pi * t / 60))
        action = actions_cycle[iteration % len(actions_cycle)]

        payload = {
            "feature_id": feature_id,
            "action": action,
        }
        if action == "rollout":
            payload["traffic_percentage"] = traffic_percentage
        elif action in ("test", "rollback"):
            payload["target_state"] = "Testing" if action == "test" else "Disabled"

        # Every 7th request — intentionally invalid (hallucination test).
        if include_invalid and iteration > 0 and iteration % 7 == 0:
            payload["traffic_percentage"] = -50  # must be rejected by Switch
            payload["action"] = "rollout"
            print(f"[{datetime.now().isoformat()}] [INVALID test] payload={payload}")
        else:
            print(f"[{datetime.now().isoformat()}] action={action} payload={payload}")

        try:
            r = requests.post(webhook_url, headers=headers, json=payload, timeout=30)
            data = (
                r.json()
                if r.headers.get("content-type", "").startswith("application/json")
                else {"raw": r.text}
            )
            print(
                f"  -> status={r.status_code} success={data.get('success')} "
                f"message={data.get('message')}"
            )
        except requests.exceptions.RequestException as e:
            print(f"  -> network error: {e}", file=sys.stderr)

        iteration += 1
        time.sleep(interval)


def main() -> None:
    p = argparse.ArgumentParser(description="WF1 dispatcher simulator")
    p.add_argument("--webhook-url", required=True,
                   help="Full URL of the /feature-control webhook")
    p.add_argument("--api-key", default=os.environ.get("N8N_API_KEY", ""),
                   help="X-API-Key header value (or env N8N_API_KEY)")
    p.add_argument("--feature-id", default="search_v2",
                   help="Target feature_id (default: search_v2)")
    p.add_argument("--duration", type=float, default=120,
                   help="Run for N seconds (default: 120)")
    p.add_argument("--interval", type=float, default=10,
                   help="Seconds between requests (default: 10)")
    p.add_argument("--include-invalid", action="store_true",
                   help="Send hallucination-test payloads (-50) every 7th request")
    args = p.parse_args()

    if not args.api_key:
        sys.exit("X-API-Key not provided: use --api-key or env N8N_API_KEY")

    print(f"Starting simulate_wf1.py — duration={args.duration}s, interval={args.interval}s")
    print(f"Webhook: {args.webhook_url}")
    print(f"Feature: {args.feature_id}, include_invalid={args.include_invalid}")
    print("---")

    run(
        webhook_url=args.webhook_url,
        api_key=args.api_key,
        feature_id=args.feature_id,
        duration=args.duration,
        interval=args.interval,
        include_invalid=args.include_invalid,
    )

    print("---\nDone.")


if __name__ == "__main__":
    main()
