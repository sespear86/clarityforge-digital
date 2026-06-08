#!/usr/bin/env python3
"""
ClarityForge Digital — Empire game data shim (AUTON 947d2fc5 / G1).

Merges progress ramp-status, launch-kit batches/packages/manifests into
docs/game/data/empire-state.json for the static Clarity Quest game.

Usage:
  python3 scripts/build_game_data.py [--repo-root .] [--output docs/game/data/empire-state.json] [--auton 947d2fc5]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from scripts.batch_asset_prompts import LEGAL_DISCLOSURE, SHORT_DISCLOSURE

LEGAL_SOURCE = "scripts/batch_asset_prompts.py"
PAGES_BASE_HINT = "https://sespear86.github.io/clarityforge-digital/game/"
GENERIC_TAGS = frozenset(
    {"printable", "digital download", "planner", "tracker", "journal", "bundle"}
)

REQUIRED_TOP_KEYS = frozenset(
    {
        "generated_at",
        "auton_trace",
        "metrics",
        "scenario_bands",
        "acts",
        "loot_deck",
        "legendary_quests",
        "companion_signals",
        "legal_footer",
        "legal_disclosure_short",
        "legal_source",
        "pages_base_hint",
    }
)

REQUIRED_METRIC_KEYS = frozenset(
    {
        "ideas",
        "batch_listings",
        "assets_integrated",
        "packages",
        "seed_etsy_listings",
        "target_listings_day90",
        "revenue_goal_90d",
        "budget_cap_monthly",
        "phase",
        "empire_score",
        "pump_runs_detected",
        "legal_enforced_sample",
    }
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _latest_by_mtime(directory: Path, pattern: str) -> Path | None:
    matches = sorted(directory.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return matches[0] if matches else None


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def compute_empire_score(batch_listings: int, assets_integrated: int, target: int) -> int:
    if target <= 0:
        return 0
    raw = 100 * (batch_listings + 0.5 * assets_integrated) / target
    return min(100, round(raw))


def act_progress_pct(act_id: int, ideas: int, batch_listings: int, assets_integrated: int) -> int:
    if act_id == 1:
        return min(100, int((ideas or 0) / 30.0 * 55 + (batch_listings or 0) / 50.0 * 45))
    if act_id == 2:
        return min(99, int((batch_listings or 0) / 50.0 * 60 + (assets_integrated or 0) / 20.0 * 40))
    if act_id == 3:
        return min(99, int((batch_listings or 0) / 100.0 * 100))
    if act_id == 4:
        return min(99, int((batch_listings or 0) / 150.0 * 100))
    return 0


def act_unlocked(act_id: int, batch_listings: int, assets_integrated: int) -> bool:
    if act_id == 1:
        return True
    if act_id == 2:
        return batch_listings >= 50 and assets_integrated >= 20
    if act_id == 3:
        return batch_listings >= 100
    if act_id == 4:
        return batch_listings >= 150
    return False


def act_unlock_requirements(act_id: int) -> dict[str, Any]:
    if act_id == 1:
        return {"type": "always"}
    if act_id == 2:
        return {"type": "metric", "batch_listings": 50, "assets_integrated": 20}
    if act_id == 3:
        return {"type": "metric", "batch_listings": 100}
    if act_id == 4:
        return {"type": "metric", "batch_listings": 150}
    return {"type": "unknown"}


def _slugify_title(title: str, max_len: int = 24) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug[:max_len] if slug else "listing"


def _niche_from_item(item: dict[str, Any]) -> str:
    tags = item.get("tags") or []
    for tag in tags:
        t = str(tag).strip().lower()
        if t and t not in GENERIC_TAGS:
            return t
    title = item.get("title") or ""
    for part in re.split(r"[|/]", title):
        part = part.strip()
        if part and len(part) < 48:
            return _slugify_title(part, 32)
    return "general-wellness"


def _image_prompt_preview(item: dict[str, Any]) -> str:
    raw = (item.get("image_prompt") or item.get("title") or "").strip()
    if len(raw) <= 140:
        return raw + "…" if raw else "…"
    return raw[:140].rstrip() + "…"


def _hero_hint_for_title(title: str, manifest_assets: list[dict[str, Any]]) -> str | None:
    title_l = title.lower()
    for asset in manifest_assets:
        match = asset.get("batch_title_match")
        if match and match.lower() in title_l:
            return asset.get("file")
    title_slug = _slugify_title(title, 48)
    for asset in manifest_assets:
        slug = asset.get("slug") or ""
        fname = asset.get("file") or ""
        if slug and slug.replace("-", "") in title_slug.replace("-", ""):
            return fname
        if slug and any(tok in title_l for tok in slug.split("-") if len(tok) > 4):
            return fname
    return None


def _collect_batch_files(launch_kit: Path) -> list[Path]:
    paths: list[Path] = []
    for pattern in ("*batch*ready*.json", "pump_*_ready.json"):
        for p in sorted(launch_kit.glob(pattern), key=lambda x: x.stat().st_mtime):
            if p not in paths:
                paths.append(p)
    return paths


def _merge_loot_deck(
    batch_paths: list[Path],
    manifest_assets: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    seen_titles: set[str] = set()
    deck: list[dict[str, Any]] = []
    global_index = 0

    for batch_path in batch_paths:
        data = _load_json(batch_path)
        items = data.get("items") or []
        source_file = f"launch-kit/{batch_path.name}"

        for item in items:
            title = (item.get("title") or "").strip()
            if not title or title in seen_titles:
                continue
            seen_titles.add(title)
            global_index += 1
            deck.append(
                {
                    "id": f"listing-{global_index:03d}",
                    "title": title,
                    "price": item.get("price"),
                    "niche": _niche_from_item(item),
                    "image_prompt_preview": _image_prompt_preview(item),
                    "legal_enforced": True,
                    "source_file": source_file,
                    "hero_asset_hint": _hero_hint_for_title(title, manifest_assets),
                }
            )
    return deck


def _legendary_from_packages(packages_path: Path) -> list[dict[str, Any]]:
    data = _load_json(packages_path)
    packages = data.get("packages") or []
    source = f"launch-kit/{packages_path.name}"
    quests: list[dict[str, Any]] = []
    for pkg in packages:
        quests.append(
            {
                "id": pkg.get("id"),
                "title": pkg.get("title"),
                "price": pkg.get("price"),
                "aov_target": pkg.get("aov_target"),
                "includes": pkg.get("includes") or [],
                "hero_asset": pkg.get("hero_asset"),
                "tags": pkg.get("tags") or [],
                "source": source,
            }
        )
    return quests


def _auton_trace_from_sources(
    ramp: dict[str, Any] | None,
    batch_paths: list[Path],
    packages_path: Path | None,
    cli_auton: str,
) -> list[str]:
    trace: list[str] = []
    if ramp and ramp.get("auton"):
        trace.append(str(ramp["auton"]))
    for bp in batch_paths:
        try:
            b = _load_json(bp)
            if b.get("auton"):
                trace.append(str(b["auton"]))
        except (json.JSONDecodeError, OSError):
            pass
    if packages_path:
        try:
            p = _load_json(packages_path)
            if p.get("auton"):
                trace.append(str(p["auton"]))
        except (json.JSONDecodeError, OSError):
            pass
    if cli_auton:
        trace.append(cli_auton)
    deduped: list[str] = []
    seen: set[str] = set()
    for a in trace:
        if a not in seen:
            seen.add(a)
            deduped.append(a)
    return deduped


def build_empire_state(repo_root: Path, cli_auton: str) -> dict[str, Any]:
    progress = repo_root / "progress"
    launch_kit = repo_root / "launch-kit"

    ramp_path = _latest_by_mtime(progress, "*-ramp-status.json")
    ramp = _load_json(ramp_path) if ramp_path else {}
    metrics_src = ramp.get("metrics") or {}

    ideas = int(metrics_src.get("ideas") or 0)
    batch_listings = int(metrics_src.get("batch_listings") or 0)
    assets_integrated = int(metrics_src.get("assets_integrated") or 0)
    packages_count = int(metrics_src.get("packages") or 0)
    target = int(metrics_src.get("target_listings_day90") or 150)
    phase = ramp.get("phase") or "unknown"
    legal_sample = bool(ramp.get("legal_enforced", True))

    batch_paths = _collect_batch_files(launch_kit)
    pump_paths = sorted(launch_kit.glob("pump_*_ready.json"))
    pump_runs = len(pump_paths)
    last_pump_at = None
    if pump_paths:
        latest_pump = max(pump_paths, key=lambda p: p.stat().st_mtime)
        try:
            pdata = _load_json(latest_pump)
            last_pump_at = pdata.get("generated_at")
        except (json.JSONDecodeError, OSError):
            last_pump_at = None

    manifest_path = _latest_by_mtime(launch_kit, "asset_manifest_*.json")
    manifest_assets: list[dict[str, Any]] = []
    if manifest_path:
        manifest_assets = (_load_json(manifest_path).get("assets") or [])

    packages_path = _latest_by_mtime(launch_kit, "PACKAGES_*.json")
    legendary: list[dict[str, Any]] = []
    if packages_path:
        legendary = _legendary_from_packages(packages_path)
        if not packages_count:
            packages_count = len(legendary)

    loot_deck = _merge_loot_deck(batch_paths, manifest_assets)

    empire_score = compute_empire_score(batch_listings, assets_integrated, target)

    acts = []
    act_defs = [
        (1, "clearing", "The Clearing", "1-14"),
        (2, "crossroads", "The Crossroads", "15-45"),
        (3, "harvest", "The Harvest", "46-90"),
        (4, "eternal-forge", "Eternal Forge", "90+"),
    ]
    for act_id, slug, name, plan_days in act_defs:
        acts.append(
            {
                "id": act_id,
                "slug": slug,
                "name": name,
                "plan_days": plan_days,
                "unlocked": act_unlocked(act_id, batch_listings, assets_integrated),
                "progress_pct": act_progress_pct(act_id, ideas, batch_listings, assets_integrated),
                "unlock_requirements": act_unlock_requirements(act_id),
            }
        )

    metrics = {
        "ideas": ideas,
        "batch_listings": batch_listings,
        "assets_integrated": assets_integrated,
        "packages": packages_count,
        "seed_etsy_listings": int(metrics_src.get("seed_etsy_listings") or 0),
        "target_listings_day90": target,
        "revenue_goal_90d": int(metrics_src.get("revenue_goal_90d") or 0),
        "budget_cap_monthly": int(metrics_src.get("budget_cap_monthly") or 0),
        "phase": phase,
        "empire_score": empire_score,
        "pump_runs_detected": pump_runs,
        "legal_enforced_sample": legal_sample,
    }

    companion_signals = {
        "last_pump_generated_at": last_pump_at,
        "pump_runs_detected": pump_runs,
        "ci_status": "unknown",
        "next_recommended": (
            f"python3 scripts/recurring_pump.py --count 3 --wall-art --update-status --auton {cli_auton}"
        ),
        "legal_enforced_sample": legal_sample,
    }

    return {
        "generated_at": _utc_now_iso(),
        "auton_trace": _auton_trace_from_sources(ramp, batch_paths, packages_path, cli_auton),
        "metrics": metrics,
        "scenario_bands": {"base": 80, "aggressive": 150, "moonshot": 250},
        "acts": acts,
        "loot_deck": loot_deck,
        "legendary_quests": legendary,
        "companion_signals": companion_signals,
        "legal_footer": LEGAL_DISCLOSURE,
        "legal_disclosure_short": SHORT_DISCLOSURE,
        "legal_source": LEGAL_SOURCE,
        "pages_base_hint": PAGES_BASE_HINT,
    }


def validate_empire_state(state: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    missing = REQUIRED_TOP_KEYS - set(state.keys())
    if missing:
        errors.append(f"missing top-level keys: {sorted(missing)}")

    metrics = state.get("metrics")
    if not isinstance(metrics, dict):
        errors.append("metrics must be an object")
    else:
        mm = REQUIRED_METRIC_KEYS - set(metrics.keys())
        if mm:
            errors.append(f"missing metrics keys: {sorted(mm)}")

    if state.get("legal_disclosure_short") != SHORT_DISCLOSURE:
        errors.append("legal_disclosure_short must equal SHORT_DISCLOSURE from batch_asset_prompts.py")
    if state.get("legal_source") != LEGAL_SOURCE:
        errors.append(f"legal_source must be {LEGAL_SOURCE!r}")

    acts = state.get("acts")
    if not isinstance(acts, list) or len(acts) != 4:
        errors.append("acts must be a list of length 4")

    loot = state.get("loot_deck")
    if not isinstance(loot, list):
        errors.append("loot_deck must be a list")
    elif loot:
        for i, card in enumerate(loot):
            if not card.get("legal_enforced"):
                errors.append(f"loot_deck[{i}] must have legal_enforced true")
            if not card.get("id"):
                errors.append(f"loot_deck[{i}] missing id")

    legendary = state.get("legendary_quests")
    if not isinstance(legendary, list):
        errors.append("legendary_quests must be a list")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Build docs/game/data/empire-state.json from repo artifacts")
    parser.add_argument("--repo-root", default=".", help="Repository root (default: cwd)")
    parser.add_argument(
        "--output",
        default="docs/game/data/empire-state.json",
        help="Output path relative to repo-root unless absolute",
    )
    parser.add_argument("--auton", default="947d2fc5", help="AUTON id for traceability")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    if not (repo_root / "scripts" / "batch_asset_prompts.py").exists():
        print(f"ERROR: repo-root does not look like clarityforge-digital: {repo_root}", file=sys.stderr)
        return 2

    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    state = build_empire_state(repo_root, args.auton)
    errors = validate_empire_state(state)
    if errors:
        for err in errors:
            print(f"VALIDATION: {err}", file=sys.stderr)
        return 1

    out_path = Path(args.output)
    if not out_path.is_absolute():
        out_path = repo_root / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"✅ empire-state.json -> {out_path} "
        f"(empire_score={state['metrics']['empire_score']}, loot={len(state['loot_deck'])})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())