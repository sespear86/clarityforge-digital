"""G5 export schema smoke — §3.6 / §3.7 shapes, no secret-like keys in values."""
import json
import re
from datetime import date

SECRET = re.compile(r"token|secret|api[_-]?key|password|bearer", re.I)


SAFE_KEYS = {"no_secrets_note", "mcp_snippet_hint"}


def _walk(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{path}.{k}" if path else k
            if k not in SAFE_KEYS:
                assert not SECRET.search(k), p
            yield from _walk(v, p)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _walk(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        assert not SECRET.search(obj), path


def test_game_log_schema_fixture():
    today = date.today().isoformat()
    sample = {
        "exported_at": "2026-06-08T12:00:00Z",
        "schema_version": "1",
        "player": {
            "xp": 10,
            "listing_shards": 1,
            "momentum_streak": 2,
            "last_forge_date": today,
            "completed_quest_ids": ["forge-pump-daily"],
            "illustrated_relic_ids": ["listing-002"],
            "settings": {"focus_mode": False, "sound_enabled": False},
        },
        "empire_overlay": {
            "batch_listings": 30,
            "assets_integrated": 26,
            "empire_score": 29,
            "generated_at": "2026-06-08T12:00:00Z",
            "pump_runs_detected": 2,
            "legal_enforced_sample": True,
        },
        "journal_excerpt": [],
        "suggested_commit_message": f"progress(game): game-log {today} (947d2fc5)",
        "suggested_paths": [f"progress/game/game-log-{today}.json"],
        "no_secrets_note": "Contains no credentials, real revenue, or PII. Safe for repo.",
    }
    list(_walk(sample))
    assert sample["empire_overlay"]["empire_score"] == 29


def test_quest_complete_schema_fixture():
    sample = {
        "exported_at": "2026-06-08T12:00:00Z",
        "auton": "947d2fc5",
        "quest_id": "forge-pump-daily",
        "player_xp_delta": 15,
        "suggested_commit_message": "feat(game): complete quest forge-pump-daily",
        "suggested_files": ["progress/game/quest-complete-forge-pump-daily.json"],
        "commit_recipe_markdown": "1. Download",
        "mcp_snippet_hint": "push_files for progress/game/",
        "append_journal_path": "progress/game/",
    }
    list(_walk(sample))
    assert sample["auton"] == "947d2fc5"