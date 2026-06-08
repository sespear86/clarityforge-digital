#!/usr/bin/env python3
"""
ClarityForge Digital — Recurring Pump (AUTON df92e0c4+)
Runs the full velocity loop: generate ideas -> batch ready listings (with legal) -> optional status/90day update.

Intended for:
- Manual: python scripts/recurring_pump.py --count 10 --wall-art
- Scheduled via scheduler_create (example below) or GitHub cron (already in ci.yml)
- CI smoke extension

This is the "daily pump" referenced in prior PLAN/LAUNCH_KIT for Phase 2+ velocity.

Example self-continuation scheduler (run from orchestrator or Hermes):
  scheduler_create(
    prompt="cd /path/to/clone; python scripts/recurring_pump.py --count 12 --wall-art --update-status; echo 'Pump done for df92e0c4'",
    interval="1d",
    recurring=True,
    fireImmediately=False,
    description="Daily ClarityForge idea + batch pump"
  )

Keeps legal 100% by delegating to batch_asset_prompts.py.
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
LAUNCH_KIT = ROOT / "launch-kit"
PROGRESS = ROOT / "progress"
NINETY = ROOT / "90day"

def run(cmd: list[str]) -> None:
    print(f"$ {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr:
        print(res.stderr.strip(), file=sys.stderr)
    if res.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)} (exit {res.returncode})")

def main():
    parser = argparse.ArgumentParser(description="ClarityForge recurring pump (generator + batch + status)")
    parser.add_argument("--count", type=int, default=10, help="Ideas to generate this pump")
    parser.add_argument("--wall-art", action="store_true", help="Include wall art")
    parser.add_argument("--niche", choices=["adhd", "menopause", "solopreneur"], help="Single niche (default all)")
    parser.add_argument("--update-status", action="store_true", help="Append a pump note to 90day/ and progress/")
    parser.add_argument("--auton", default="df92e0c4", help="AUTON id for traceability")
    args = parser.parse_args()

    ts = datetime.now().strftime("%Y-%m-%d_%H%M")
    ideas_file = f"/tmp/df92_pump_ideas_{ts}.json"
    batch_file = LAUNCH_KIT / f"pump_{args.auton}_{ts}_ready.json"

    # 1. Generate
    gen_cmd = [sys.executable, str(SCRIPTS / "generate_product_ideas.py")]
    if args.niche:
        gen_cmd += ["--niche", args.niche]
    else:
        gen_cmd.append("--all")
    gen_cmd += ["--count", str(args.count)]
    if args.wall_art:
        gen_cmd.append("--wall-art")
    gen_cmd += ["--output", ideas_file]
    run(gen_cmd)

    # 2. Batch (legal injector)
    batch_cmd = [sys.executable, str(SCRIPTS / "batch_asset_prompts.py"),
                 "--input", ideas_file,
                 "--output", str(batch_file),
                 "--auton", args.auton]
    run(batch_cmd)

    print(f"\n✅ Pump complete: {ideas_file} -> {batch_file}")

    # 3. Optional status update (simple append for visibility)
    if args.update_status:
        note = f"\n- {datetime.now().isoformat()} | AUTON {args.auton} pump: +{args.count} ideas + batch -> {batch_file.name}\n"
        for p in [NINETY / f"pump_log_{args.auton}.md", PROGRESS / f"pump_log_{args.auton}.md"]:
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(p, "a", encoding="utf-8") as f:
                f.write(note)
        print(f"Status notes appended to 90day/ and progress/ (pump_log_{args.auton}.md)")

    print("Legal: enforced via batch_asset_prompts.py (full disclosure in every item).")
    print("Next: feed winners into xlsx, upload via launch-kit, run again weekly or via scheduler.")

if __name__ == "__main__":
    main()
