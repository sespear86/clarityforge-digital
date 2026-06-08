# DESIGN — Clarity Quest: Empire Forge (AUTON 947d2fc5)

**Status**: Production-ready design (source of truth for Phase 5 execute-plan)  
**Date**: 2026-06-08 (PT)  
**AUTON_ID**: 947d2fc5  
**Target repo**: [sespear86/clarityforge-digital](https://github.com/sespear86/clarityforge-digital)  
**Clone path**: `/home/Irikash/.grok/auton-projects/947d2fc5/clarityforge-digital`  
**Orchestrator mirror**: `/home/Irikash/.grok/auton-projects/947d2fc5/DESIGN_GAMIFY_947d2fc5.md`  
**Upstream research**: `RESEARCH_SYNTHESIS_GAMIFY_947d2fc5.md` (project + `~/.grok/auton-projects/947d2fc5/RESEARCH_SYNTHESIS.md`)

**Subtitle**: *Play the build. Forge the empire.*

---

## 1. Executive Summary & Goals

### 1.1 What we are building

**Clarity Quest: Empire Forge** is a **zero-build static web experience** under `docs/game/`, deployed via existing GitHub Pages (`upload-pages-artifact` path `./docs` in `.github/workflows/ci.yml`). It gamifies the **real** ClarityForge velocity engine (pump → legal batch → status → xlsx → assets → MCP/Pages) so each authentic step is **elegant, calm, ADHD/wellness-friendly, and rewarding** while accelerating the $40k / 90-day mission.

The game **does not** replace `scripts/recurring_pump.py`, `batch_asset_prompts.py`, or Etsy uploads. It is a **companion play surface**: mirror repo truth, suggest the next forge action, collect real listing relics in the **Forge Codex**, and export commit-ready artifacts to `progress/game/`.

### 1.2 Goals (measurable)

| Goal | Success criterion |
|------|-------------------|
| Fun + real acceleration | Every quest maps to command, path, or attestation; completion emits pump/commit recipes. |
| Elegant brand match | Palette from `docs/index.html`: `#5c7a5e`, `#f8f5f0`, `#2c3e2d`, Georgia serif accents. PLAN lavender accents + AGENTS sage/beige lock (clean minimalist, generous white space) must be honored in all asset prompts, copy, and visuals (even if UI tokens derive from storefront). |
| ADHD / wellness-friendly | One primary CTA; focus mode; Momentum with 3-day grace; large targets; calm copy. |
| Static zero-cost | No backend/build; same-origin `docs/game/data/*.json`. |
| Bidirectional | `build_game_data.py` + CI → game; quest exports → `progress/game/`. |
| Gate-ready | G1–G7 DAG; CI smoke green; Pages path unchanged. |

### 1.3 Non-goals (MVP)

No OAuth, WebSockets, fake Etsy completion, idle revenue ticks, or second hosted product.

---

## 2. Key Decisions

| ID | Decision | Alternatives | Rationale |
|----|----------|--------------|-----------|
| KD-1 | Vanilla HTML/CSS/ESM in `docs/game/` | SvelteKit, Preact, canvas | Zero build; `./docs` deploy; MCP edits (score 9/10). |
| KD-2 | Act map + quests + Forge Codex loot | Checklist-only; idle sim | Mirrors `PLAN.md` four acts. |
| KD-3 | `scripts/build_game_data.py` → `empire-state.json` | Hand-edited only | CI pytest; deterministic merge. |
| KD-4 | `data/quests.json` + `quest-engine.js` | Quests only in JS | Extend quests without engine churn. |
| KD-5 | `localStorage` `clarityforge_game_v1` + export | Server DB | Static Pages; git-friendly exports. |
| KD-6 | Collection: **Forge Codex** (bundle copy: Nervous System Arsenal) | — | Premium wellness tone. |
| KD-7 | Web Audio chimes **off by default**; CSS confetti ≤1s | Always-on FX | `prefers-reduced-motion`. |
| KD-8 | Empire Score: `min(100, round(100 * (batch_listings + 0.5*assets_integrated) / target_listings_day90))` | Revenue-based | No false revenue signals. |

**Worked example** (June 2026 fixture from ramp-status): batch_listings=30, assets_integrated=26, target=150 → round(100 * (30 + 13) / 150) = **29**. All fixtures and tests must use 29.

| KD-9 | MVP: single-player | Party `party-state.json` | Deferred post-MVP. |
| KD-10 | Quest export: download-only | Browser MCP commit | No secrets in client. |

Optional Tailwind CDN: **reject for MVP** unless reviewer approves; use CSS variables matching storefront.

---

## 3. Architecture & Data Model

### 3.1 Layout

```
docs/
  index.html                 # nav link → game/
  game/
    index.html
    styles.css
    app.js                   # bootstrap, router
    quest-engine.js
    sync.js
    codex.js
    export.js
    audio.js                 # optional
    data/
      empire-state.json      # GENERATED
      quests.json            # STATIC (15–25 quests)
    audio/                   # optional small .ogg
progress/game/
  README.md
scripts/
  build_game_data.py
tests/
  test_game_data.py
```

### 3.2 `build_game_data.py` contract

**CLI**: `python3 scripts/build_game_data.py [--repo-root .] [--output docs/game/data/empire-state.json] [--auton 947d2fc5]`

**Inputs**:

- Latest `progress/*-ramp-status.json` (mtime) → metrics, phase.
- Latest `launch-kit/*batch*ready*.json` + `launch-kit/pump_*_ready.json` → merge `items[]` into `loot_deck` (dedupe by title).
- Latest `launch-kit/PACKAGES_*.json` → `legendary_quests`.
- Optional `launch-kit/asset_manifest_*.json` → `hero_asset_hint` on loot cards.
- Count `launch-kit/pump_*_ready.json` → `pump_runs_detected`.

**Contract enforcement (non-negotiable)**: `build_game_data.py` MUST `from scripts.batch_asset_prompts import LEGAL_DISCLOSURE, SHORT_DISCLOSURE` (or equivalent import) as the single source of truth — never duplicate the disclosure strings in the shim or game JSON. Emit `legal_footer` (full or rendered), `legal_disclosure_short`, `legal_source`. This keeps AGENTS.md legal lock intact.

**Ramp-status + launch-kit precedence** (table in full DESIGN):
- ramp-status primary for metrics/phase/score/progress/unlock.
- launch-kit for loot_deck (deduped), legendary, pump_runs.

 (See full DESIGN for complete M1-M14, G1-G7, schemas, quest catalog with real commands like forge-pump-daily, legal_streak, boss_attestation, empire_overlay, etc. All fixtures 29/[82,88,30,20]. C2 policy detailed in §6/7/8.)
