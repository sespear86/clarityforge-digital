# ClarityForge Digital — Launch Kit (AUTON c2667b93)

**Updated**: 2026-06-07 (PT) | **Phase**: 1–2 ramp | **Goal**: $40k / 90 days, 150+ listings, ≤$200/mo

## Volume snapshot (June 2026 + df92e0c4 updates)

| Metric | Count | Location |
|--------|------:|----------|
| Product ideas (generator, prior) | 30 | `c2667b93_batch_ready.json`, `clarityforge_new_ideas.json` |
| Ready-to-list singles (prior) | 30 | `launch-kit/c2667b93_batch_ready.json` |
| High-AOV packages | 12 | `launch-kit/PACKAGES_c2667b93.json` |
| Visual assets integrated (prior) | 26 | `launch-kit/asset_manifest_c2667b93.json`, `assets/c2667b93_batch/` |
| **df92e0c4 fresh this run** | 13 ideas + 13 batch + 3 real image_gen samples | `launch-kit/pump_df92e0c4_*.json`, `assets/df92e0c4_samples/` + manifest |
| Command Center (live math) | 1 | `Command_Center_c2667b93.xlsx` (+ CSV) |
| Seed Etsy listings | 3 | CF001–CF003 (repo seed) |

**New automation (df92e0c4)**: `scripts/recurring_pump.py` (generator + batch + status), `tests/`, hardened CI (batch legal + tests + xlsx), `AGENTS.md`.

## Legal (required on every listing)

Copy the **full** block from `scripts/batch_asset_prompts.py` (`LEGAL_DISCLOSURE`) into Etsy description tail. All batch JSON items already include it in `description`.

## Upload workflow

1. **First 8**: See `First_8_Launch_Bundle.md` — copy title, description, tags, price; attach hero from `assets/c2667b93_batch/`.
2. **Bundles**: Use `PACKAGES_c2667b93.json` — create Etsy/Payhip bundle listings with PKG hero assets.
3. **Remaining singles**: Iterate `c2667b93_batch_ready.json` `items[]`; map cover via `asset_manifest_c2667b93.json` or `image_prompt` + Canva.
4. **Pinterest**: Lead with asset `12_pinterest_peri_solo_mood_energy_pin_9x16.jpg` + PKG-010 set.
5. **Finance**: Weekly update `Command_Center_c2667b93.xlsx` (Assumptions yellow cells, Snapshot, Ramp, 80-20, ROI).

## Notifications / triggers

- **GitHub Pages**: Shop links + free lead magnet (PKG-012) after CI deploy.
- **Scheduler**: `scripts/recurring_pump.sh` — daily ideas refresh (1d interval when armed).
- **Re-gate**: After first Etsy uploads, feed real orders into xlsx Ramp + ROI sheets.

## Paths (local HQ)

- **Primary**: `/home/Irikash/ClarityForge_Digital/`
- **Clone mirror**: `/tmp/clarityforge-digital/`
- **Remote**: `https://github.com/sespear86/clarityforge-digital`

## Resume

`grok -p "/bustanut --resume c2667b93"` | Mempalace: `projects/clarityforge-digital-c2667b93`
