# progress/game — Clarity Quest export landing zone

**AUTON**: 947d2fc5 · **Game**: `docs/game/` (Clarity Quest: Empire Forge)

Player exports from the static game are **download-only** (no secrets in the browser). Commit them here to mirror honest quest progress in git and feed the bidirectional loop: exports → repo → pump → `build_game_data.py` → fresh `empire-state.json` on Pages.

## Quest complete (`quest-complete-<id>-<date>.json`)

**Schema (§3.6)**: `exported_at`, `auton`, `quest_id`, `player_xp_delta`, `suggested_commit_message`, `suggested_files`, `commit_recipe_markdown`, `mcp_snippet_hint`, `append_journal_path`.

```bash
# After downloading from Quests → complete → auto-download or Sync panel
git add progress/game/quest-complete-*.json
git commit -m "progress(game): complete quest forge-pump-daily"
```

**MCP hint** (optional, no credentials in JSON):

```text
grok_com_github push_files — paths under progress/game/ only
```

## Game log (`game-log-YYYY-MM-DD.json`)

**Schema (§3.7)**: `exported_at`, `schema_version: "1"`, `player` snapshot, `empire_overlay`, `journal_excerpt`, `suggested_commit_message`, `suggested_paths`, `no_secrets_note`.

```bash
git add progress/game/game-log-$(date +%Y-%m-%d).json
git commit -m "progress(game): game-log $(date +%Y-%m-%d) (947d2fc5)"
python3 scripts/build_game_data.py --auton 947d2fc5
```

## Verify export shape (local)

```bash
python3 -c "
import json, glob, re
pat = re.compile(r'token|secret|key', re.I)
for f in glob.glob('progress/game/*.json'):
    d = json.load(open(f))
    s = json.dumps(d)
    assert not pat.search(s) or 'no_secrets' in s, f
    if 'empire_overlay' in d:
        assert d['empire_overlay'].get('empire_score') is not None
    print('OK', f)
"
```

## Post-pump refresh (always)

When `launch-kit/*` or `progress/*-ramp-status.json` changes:

```bash
python3 scripts/build_game_data.py --auton 947d2fc5
python3 -m pytest tests/test_game_data.py -q --tb=line
```

CI also regenerates game data in `deploy-pages` before Upload (C2 policy).

## Play URL

- Local: `cd docs && python3 -m http.server 8765` → `http://127.0.0.1:8765/game/`
- Pages: `https://sespear86.github.io/clarityforge-digital/game/`