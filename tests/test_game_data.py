#!/usr/bin/env python3
"""Tests for scripts/build_game_data.py (G1 / AUTON 947d2fc5)."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.batch_asset_prompts import SHORT_DISCLOSURE
from scripts.build_game_data import (
    act_progress_pct,
    build_empire_state,
    compute_empire_score,
    validate_empire_state,
)

EMPIRE_STATE_PATH = ROOT / "docs" / "game" / "data" / "empire-state.json"


class TestGameDataFormulas(unittest.TestCase):
    def test_empire_score_fixture_29(self):
        self.assertEqual(compute_empire_score(30, 26, 150), 29)

    def test_act_progress_fixture_june_2026(self):
        ideas, batch, assets = 30, 30, 26
        self.assertEqual(act_progress_pct(1, ideas, batch, assets), 82)
        self.assertEqual(act_progress_pct(2, ideas, batch, assets), 88)
        self.assertEqual(act_progress_pct(3, ideas, batch, assets), 30)
        self.assertEqual(act_progress_pct(4, ideas, batch, assets), 20)


class TestGameDataBuild(unittest.TestCase):
    def test_build_state_matches_fixture_metrics(self):
        state = build_empire_state(ROOT, "947d2fc5")
        m = state["metrics"]
        self.assertEqual(m["ideas"], 30)
        self.assertEqual(m["batch_listings"], 30)
        self.assertEqual(m["assets_integrated"], 26)
        self.assertEqual(m["packages"], 12)
        self.assertEqual(m["target_listings_day90"], 150)
        self.assertEqual(m["empire_score"], 29)
        self.assertTrue(m["legal_enforced_sample"])

    def test_acts_length_and_progress(self):
        state = build_empire_state(ROOT, "947d2fc5")
        acts = state["acts"]
        self.assertEqual(len(acts), 4)
        progress = [a["progress_pct"] for a in acts]
        self.assertEqual(progress, [82, 88, 30, 20])
        self.assertTrue(acts[0]["unlocked"])
        self.assertFalse(acts[1]["unlocked"])
        self.assertEqual(acts[0]["slug"], "clearing")
        self.assertIn("unlock_requirements", acts[0])

    def test_legal_ssot_emit(self):
        state = build_empire_state(ROOT, "947d2fc5")
        self.assertEqual(state["legal_disclosure_short"], SHORT_DISCLOSURE)
        self.assertEqual(state["legal_source"], "scripts/batch_asset_prompts.py")
        self.assertIn("AI Disclosure", state["legal_footer"])

    def test_loot_deck_rules(self):
        state = build_empire_state(ROOT, "947d2fc5")
        deck = state["loot_deck"]
        self.assertGreaterEqual(len(deck), 1)
        for card in deck:
            self.assertTrue(card["legal_enforced"])
            self.assertRegex(card["id"], r"^listing-\d{3}$")
            self.assertIn("image_prompt_preview", card)
            self.assertTrue(card["image_prompt_preview"].endswith("…"))
            self.assertIn("source_file", card)
            self.assertIn("niche", card)
        adhd = next((c for c in deck if "Task Initiation" in c["title"]), None)
        self.assertIsNotNone(adhd)
        if adhd:
            self.assertEqual(adhd["id"], "listing-002")
            self.assertEqual(adhd["niche"], "adhd-neurodivergent")
            self.assertEqual(
                adhd.get("hero_asset_hint"),
                "03_adhd_task_initiation_challenge_cover.jpg",
            )

    def test_legendary_quests_shape(self):
        state = build_empire_state(ROOT, "947d2fc5")
        leg = state["legendary_quests"]
        self.assertEqual(len(leg), 12)
        pkg = leg[0]
        self.assertEqual(pkg["id"], "PKG-001")
        self.assertIn("includes", pkg)
        self.assertIn("source", pkg)
        self.assertIn("launch-kit/PACKAGES", pkg["source"])

    def test_validate_empire_state_clean(self):
        state = build_empire_state(ROOT, "947d2fc5")
        self.assertEqual(validate_empire_state(state), [])

    def test_scenario_bands_and_pages_hint(self):
        state = build_empire_state(ROOT, "947d2fc5")
        self.assertEqual(
            state["scenario_bands"],
            {"base": 80, "aggressive": 150, "moonshot": 250},
        )
        self.assertIn("github.io", state["pages_base_hint"])


class TestCommittedEmpireState(unittest.TestCase):
    @unittest.skipUnless(EMPIRE_STATE_PATH.exists(), "run build_game_data.py first")
    def test_committed_json_loads_and_scores_29(self):
        data = json.loads(EMPIRE_STATE_PATH.read_text(encoding="utf-8"))
        self.assertEqual(validate_empire_state(data), [])
        self.assertEqual(data["metrics"]["empire_score"], 29)


if __name__ == "__main__":
    unittest.main()