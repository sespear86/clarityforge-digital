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

BUST C001 ENHANCEMENT (this phase):
- --c001-bust / --include-new-assets : References + injects the 6 new generated assets (ADHD trackers, perimenopause wall art variants, solopreneur trackers) + leverages 3 previous kickoff into batches/notes.
- Pulls descs from launch-kit/c001_bust_image_gen_log.md or hardcoded (session-local safe).
- Appends volume + desc refs to 90day/progress notes and batch json.
- Raunchy comments for internal style. Batch the new with old for velocity.
- Suggested: integrate manifest load for future, but hardcoded for this c001 push.
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

# Bust c001 new assets ( + 3 prev kickoff leveraged; descs only - binaries session-local)
C001_BUST_ASSETS = [
    {"id": "c001-1", "name": "ADHD Dopamine Launchpad Daily Task Ignition tracker cover", "type": "ADHD tracker", "desc": "clean minimalist sage/beige/lavender, subtle botanicals, premium for neurodivergent dopamine/task ignition"},
    {"id": "c001-2", "name": "Perimenopause Nervous System Anchor wall art", "type": "perimenopause wall art variant", "desc": "2x3 calming focus premium wall art for peri nervous system support"},
    {"id": "c001-3", "name": "Solopreneur Aligned Abundance weekly tracker", "type": "solopreneur tracker", "desc": "weekly money/energy alignment tracker for solopreneurs, minimalist premium printable"},
    {"id": "c001-4", "name": "Perimenopause Power Pause wall art variant", "type": "perimenopause wall art variant", "desc": "wall art variant for embodied strength and somatic resets in perimenopause"},
    {"id": "c001-5", "name": "ADHD Focus Fuel Daily Dashboard", "type": "ADHD tracker / solo crossover", "desc": "daily hyperfocus management + solopreneur pipeline crossover dashboard"},
    {"id": "c001-6", "name": "Solopreneur Cycle Sync Money Map", "type": "solopreneur tracker", "desc": "monthly cycle-aware income/expense/client map tracker for perimenopausal solopreneurs"},
]
# 3 previous kickoff leveraged in this phase too (e.g. basic from 1.jpg-3.jpg or CF001-3 covers)
PREV_KICKOFF = ["kickoff-peri-tracker", "kickoff-adhd-menu", "kickoff-calm-wall"]

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
    # Bust c001 enhancement: reference new assets in batches
    parser.add_argument("--c001-bust", "--include-new-assets", action="store_true", dest="c001_bust", help="Leverage + inject bust c001 +6 assets (ADHD trackers, peri wall variants, solopreneur trackers) + 3 prev kickoff into this pump batch + notes. Exhaust phase integration.")
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

    # Bust c001: reference new assets in batches (inject descs for volume)
    c001_note = ""
    if args.c001_bust:
        asset_lines = "\n".join([f"  - {a['name']} ({a['type']}): {a['desc']}" for a in C001_BUST_ASSETS])
        prev_note = ", ".join(PREV_KICKOFF)
        c001_note = f"\n\nBUST C001 ASSETS LEVERAGED THIS PUMP (+6 new + 3 prev kickoff):\n{asset_lines}\nPrev kickoff: {prev_note}\nSee launch-kit/c001_bust_image_gen_log.md + asset_manifest_c2667b93.json (ids 27-32 + 21-26). Total volume +6 this phase. 3+6=9 leveraged sluts for empire nut. Bust a nut.\n"
        print(c001_note)
        # Optional: append descs to batch_file if json
        try:
            with open(batch_file, "r+", encoding="utf-8") as bf:
                data = json.load(bf)
                if isinstance(data, list):
                    data.append({"bust_c001_assets": C001_BUST_ASSETS, "prev_kickoff": PREV_KICKOFF})
                elif isinstance(data, dict):
                    data["bust_c001_assets_injected"] = C001_BUST_ASSETS
                bf.seek(0)
                json.dump(data, bf, indent=2)
                bf.truncate()
            print("Bust c001 assets injected into batch json.")
        except Exception as e:
            print(f"(non-fatal) Could not inject to batch: {e}")

    # 3. Optional status update (simple append for visibility) - enhanced for c001
    if args.update_status:
        note = f"\n- {datetime.now().isoformat()} | AUTON {args.auton} pump: +{args.count} ideas + batch -> {batch_file.name}\n"
        if args.c001_bust:
            note += c001_note + "\n- Bust c001 +6 volume (ADHD tracker/peri wall art variants/solopreneur trackers) +3 prev integrated. Raunch: pumped fresh assets, legal creampie. Keep er goinnnn. Bust a nut.\n"
        for p in [NINETY / f"pump_log_{args.auton}.md", PROGRESS / f"pump_log_{args.auton}.md"]:
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(p, "a", encoding="utf-8") as f:
                f.write(note)
        print(f"Status notes appended to 90day/ and progress/ (pump_log_{args.auton}.md)")

    print("Legal: enforced via batch_asset_prompts.py (full disclosure in every item).")
    print("Next: feed winners into xlsx, upload via launch-kit, run again weekly or via scheduler.")
    if args.c001_bust:
        print("Bust c001 mode: new assets batched/referenced. Exhaust options for integration this phase. Bust a nut.")

if __name__ == "__main__":
    main()
