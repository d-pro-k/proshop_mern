#!/usr/bin/env python3
"""
simulate_wf2.py — log generator with sine-wave error rate.

Writes success/error events to logs.json. error_rate follows a sine wave
with a configurable period so that WF2 (n8n cron trigger) sees the error
rate cross the threshold up and down — the feature is automatically
deactivated and re-enabled.

Usage:
    python3 simulate_wf2.py --output logs.json --duration 1800 --period 300
    python3 simulate_wf2.py ... --rps 5 --amplitude 0.10 --baseline 0.05
"""

import argparse
import json
import math
import random
import time
from datetime import datetime, timezone
from pathlib import Path


def sine_error_rate(t: float, period: float, amplitude: float, baseline: float) -> float:
    """Returns instantaneous error_rate at time t.

    error_rate(t) = max(0, min(1, baseline + amplitude * sin(2pi*t/period)))
    """
    raw = baseline + amplitude * math.sin(2 * math.pi * t / period)
    return max(0.0, min(1.0, raw))


def run(
    output_path: Path,
    feature_id: str,
    duration: float,
    rps: float,
    period: float,
    amplitude: float,
    baseline: float,
) -> None:
    """Runs the log generator until duration expires."""
    # Initialize the file with an empty array if it does not exist
    if not output_path.exists():
        output_path.write_text("[]")

    start = time.time()
    interval = 1.0 / rps

    while time.time() - start < duration:
        t = time.time() - start
        rate = sine_error_rate(t, period, amplitude, baseline)
        status = "error" if random.random() < rate else "success"

        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "feature_id": feature_id,
            "status": status,
            "error_rate_now": round(rate, 3),  # debug: current sine value
        }

        # Append (read whole file, append, write back — fine for homework scale)
        try:
            existing = json.loads(output_path.read_text())
        except (json.JSONDecodeError, FileNotFoundError):
            existing = []

        existing.append(event)
        # Cap the file at the last 10_000 events so disk usage stays bounded
        if len(existing) > 10_000:
            existing = existing[-10_000:]
        output_path.write_text(json.dumps(existing, ensure_ascii=False, indent=None))

        # Print to stdout rarely (every ~5 seconds) to avoid spam
        if int(t) % 5 == 0 and int(t * rps) % int(rps * 5) == 0:
            print(f"t={int(t)}s rate={rate:.1%} status={status} total_events={len(existing)}")

        time.sleep(interval)


def main() -> None:
    p = argparse.ArgumentParser(description="WF2 log generator (sine error rate)")
    p.add_argument("--output", default="logs.json", help="Path to logs.json (default: ./logs.json)")
    p.add_argument("--feature-id", default="search_v2")
    p.add_argument("--duration", type=float, default=1800, help="Run for N seconds (default: 1800 = 30 min)")
    p.add_argument("--rps", type=float, default=5, help="Events per second (default: 5)")
    p.add_argument("--period", type=float, default=300, help="Sine period in seconds (default: 300 = 5 min)")
    p.add_argument("--amplitude", type=float, default=0.10, help="Sine amplitude (default: 0.10)")
    p.add_argument("--baseline", type=float, default=0.05, help="Sine baseline error_rate (default: 0.05)")
    args = p.parse_args()

    print(f"simulate_wf2.py — duration={args.duration}s, rps={args.rps}, period={args.period}s")
    print(f"sine: baseline={args.baseline:.1%}, amplitude={args.amplitude:.1%} -> rate in [{max(0, args.baseline-args.amplitude):.1%}; {min(1, args.baseline+args.amplitude):.1%}]")
    print(f"Threshold WF2 = 5% -> feature toggles roughly every {args.period/2:.0f}s")
    print(f"File: {args.output}")
    print("---")

    run(
        output_path=Path(args.output),
        feature_id=args.feature_id,
        duration=args.duration,
        rps=args.rps,
        period=args.period,
        amplitude=args.amplitude,
        baseline=args.baseline,
    )


if __name__ == "__main__":
    main()
