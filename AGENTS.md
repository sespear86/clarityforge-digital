# AGENTS.md — ClarityForge Digital (df92e0c4+)

**Project**: Autonomous passive income empire builder for hyper-niche digital printables, trackers, wall art (ADHD/neurodivergent, perimenopause, solopreneur wellness). $40k/90 days on ≤$200/mo, 100% legal, zero marginal cost via Grok stack.

## Core Rules (non-negotiable)
- **Legal 100%**: Every generated listing, description, asset note, MD, or prompt must include the full AI Disclosure + wellness disclaimer block from `scripts/batch_asset_prompts.py` (the `LEGAL_DISCLOSURE` constant). The batch script and pump enforce it. Never bypass.
- **Brand lock**: All visuals use the exact style: "clean minimalist design, generous white space, soft sage green and warm beige palette, modern sans typography, subtle botanical or abstract line elements, premium digital product aesthetic".
- **Finish Line (this AUTON df92e0c4)**: VERDICT PASS on the full Production Readiness Gate defined in RESEARCH_SYNTHESIS.md (0 issues, tests, hardened CI, pump + batch present, fresh image_gen samples in repo, updated docs, MCP delivery, Mempalace handoff). See that file for the exact checklist.
- **Artifacts**: Generator → batch (legal) → pump (status) → xlsx update → image samples (via image_gen tool) → manifest → MCP push. All traceable to AUTON id in filenames/JSON.

## How to Run (local / CI / autonomous)
- Fresh ideas: `python scripts/generate_product_ideas.py --all --count 10 --wall-art --output new.json`
- Ready listings + legal: `python scripts/batch_asset_prompts.py --input new.json --output launch-kit/ready.json --auton df92e0c4`
- Full pump (recommended for velocity): `python scripts/recurring_pump.py --count 12 --wall-art --update-status --auton df92e0c4`
- xlsx refresh: `python scripts/build_command_center_xlsx.py`
- Tests: `python -m unittest discover -s tests` or `python -m pytest tests/`
- CI: Pushes + daily cron run the full smoke (generator + batch legal + xlsx + tests + manifest check) then Pages deploy.

## Clarity Quest: Empire Forge (AUTON 947d2fc5)
- **Play**: `docs/game/` — static ESM game on GitHub Pages at `/game/` (link from `docs/index.html`).
- **After pump or launch-kit changes**: `python3 scripts/build_game_data.py --auton 947d2fc5` → refreshes `docs/game/data/empire-state.json` (loot deck, legendary packages, empire score, legal fields from `batch_asset_prompts.py` SSOT).
- **Quest exports**: players download JSON → commit under `progress/game/` (see `progress/game/README.md`). CI **regenerates** game data in `deploy-pages` before Upload (C2); committed `data/` is a dev snapshot only.
- **Local serve**: `cd docs && python3 -m http.server 8765` → `http://127.0.0.1:8765/game/`
- **Verify**: `python3 -m pytest tests/test_game_data.py -q` and `bash scripts/verify_g6.sh`

## Adding New Work (autonomous or human)
- Update todos/state with phase (research/design/execute/gate/handoff).
- Use bg:true for image_gen batches, long subagents, gate verifiers.
- Always call scheduler_list + guard before self-continuation scheduler_create. Respect HARD 5 queued cap.
- Deliver via grok_com_github MCP (create_or_update_file / push_files) for auditability.
- After changes: run tests + smoke, update relevant MD (LAUNCH_KIT, 90day/STATUS_*, PRODUCTION_READY), append to pump_log if using pump.
- Handoff: Mempalace drawer `projects/clarityforge-digital`, new PRODUCTION_READY.md with this AUTON's evidence, resume `grok -p "/bustanut --resume df92e0c4"`.

## Conventions
- Filenames for this run: include `df92e0c4` or `pump_df92e0c4_YYYY...`.
- Legal block is the single source of truth — edit only in batch_asset_prompts.py.
- No secrets. No real sales data in repo (feed to xlsx locally).
- Images: generate via image_gen tool with locked prompt style; copy samples into assets/df92e0c4_samples/ + manifest for git.

**Bust a nut until the gate says PASS. Exact signatures per autonomous/SKILL.md.**

(Added during df92e0c4 execution. Update with new patterns.)
