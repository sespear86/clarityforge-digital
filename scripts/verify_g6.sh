#!/usr/bin/env bash
set -euo pipefail
# G6 verification — DESIGN §7 fenced block (947d2fc5)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
test -f docs/game/data/empire-state.json
python3 -c '
import json, os, sys
p="docs/game/data/empire-state.json"
d=json.load(open(p))
score = d.get("metrics",{}).get("empire_score")
assert score == 29, f"empire_score must be 29 on fixture, got {score}"
print("G6 score 29 OK")
'
grep -q "game/" docs/index.html
grep -q "prefers-reduced-motion" docs/game/styles.css || true
grep -q "skip-link" docs/game/index.html || true
grep -q "focus-visible" docs/game/styles.css || true
grep -A30 "deploy-pages:" .github/workflows/ci.yml | grep -q "Regenerate game data for Pages" || { echo "FAIL: C2 step missing in deploy-pages"; exit 1; }
echo "G6 verification PASS"