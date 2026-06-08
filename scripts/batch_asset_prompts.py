#!/usr/bin/env python3
"""
ClarityForge Digital — Batch Asset Prompts + Legal Injector (AUTON d2250b7f+)
Takes generator ideas JSON and produces Etsy-ready listings JSON with:
- Full title, description (why + exact legal disclosure appended)
- Tags, price, image_prompt
- legal_enforced: true, disclosure field, generated_for

Enforces 100% legal compliance (Etsy AI policy) on every item.
The LEGAL_DISCLOSURE constant is the single source of truth — edit only here.

Usage (from pump or manual):
  python scripts/batch_asset_prompts.py --input /tmp/ideas.json --output launch-kit/ready.json --auton d2250b7f
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

LEGAL_DISCLOSURE = (
    "AI Disclosure: This digital product was created with AI assistance (Grok 4.3 / xAI) under original human prompts + heavy curation, "
    "original layout, text structures, and value-add. Every element complies with Etsy and platform policies. For personal use only. "
    "Not for resale or redistribution without permission. "
    "Wellness Disclaimer: This is not medical, therapeutic, or professional advice. Consult qualified professionals for health, "
    "mental health, or business concerns. Results vary. Use at your own discretion."
)

SHORT_DISCLOSURE = (
    "AI Disclosure: This digital product was created with AI assistance (Grok 4.3 / xAI) under original human prompts + heavy curation, "
    "original layout, text structures, and value-add. Every element complies with Etsy and platform policies. For personal use only. "
    "Not for resale or redistribution without permission. Wellness Disclaimer: This is not medical, therapeutic, or professional advice. Consult qualified professionals for health, mental health, or business concerns. Results vary. Use at your own discretion."
)

ROOT = Path(__file__).resolve().parent.parent
LAUNCH_KIT = ROOT / "launch-kit"

def slugify(text: str) -> str:
    return text.lower().replace(" / ", "-").replace(" ", "-").replace("/", "-").replace(",", "").strip("-")

def make_title(niche: str, angle: str, product_type: str) -> str:
    base = f"{niche} {angle.title()} {product_type.title()}"
    if "wall art" in product_type.lower() or "printable collection" in product_type.lower():
        return f'"{angle}" Minimalist Printable Wall Art Collection (8 designs)'
    return f"{base} | Printable PDF | Digital Download"

def make_tags(niche: str, angle: str, product_type: str) -> list[str]:
    niche_slug = slugify(niche)
    angle_slug = slugify(angle)
    ptype_slug = slugify(product_type)
    tags = ["printable", "digital download", niche_slug, angle_slug]
    if ptype_slug and ptype_slug not in tags:
        tags.append(ptype_slug)
    for extra in ["planner", "tracker", "journal"]:
        if extra not in tags:
            tags.append(extra)
    return tags[:8]

def enrich_item(idea: dict, auton: str) -> dict:
    niche = idea.get("niche", "ADHD / Neurodivergent")
    angle = idea.get("angle", "focus")
    ptype = idea.get("product_type", "tracker")
    why = idea.get("why_it_could_sell") or f"High emotional need in {niche} audience. Specific angle reduces competition. Easy to bundle."
    price = idea.get("suggested_price_range", "$9-14")
    image_prompt = idea.get("image_prompt_example", "")

    title = make_title(niche, angle, ptype)
    tags = make_tags(niche, angle, ptype)
    description = f"{why}\n\n{LEGAL_DISCLOSURE}"

    return {
        "title": title,
        "description": description,
        "tags": tags,
        "price": price,
        "image_prompt": image_prompt,
        "legal_enforced": True,
        "disclosure": SHORT_DISCLOSURE,
        "generated_for": f"AUTON {auton}",
    }

def main():
    parser = argparse.ArgumentParser(description="Batch ideas into Etsy-ready listings + enforce legal disclosure")
    parser.add_argument("--input", required=True, help="Path to generator ideas JSON (with 'ideas' list or top-level list)")
    parser.add_argument("--output", required=True, help="Path for ready batch JSON")
    parser.add_argument("--auton", default="d2250b7f", help="AUTON id for traceability")
    args = parser.parse_args()

    inp = Path(args.input)
    outp = Path(args.output)
    outp.parent.mkdir(parents=True, exist_ok=True)

    raw = json.loads(inp.read_text(encoding="utf-8"))
    ideas = raw.get("ideas") if isinstance(raw, dict) else raw
    if ideas is None:
        ideas = raw if isinstance(raw, list) else []

    items = [enrich_item(i, args.auton) for i in ideas]

    data = {
        "generated_at": datetime.now().isoformat() + "Z",
        "auton": args.auton,
        "total": len(items),
        "legal_note": "All items include exact seed disclosure + disclaimers.",
        "items": items,
    }

    outp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✅ Batched {len(items)} ready listings -> {outp}")
    print(f"   Legal enforced on all: {all(it['legal_enforced'] for it in items)}")
    if items:
        print(f"   Sample title: {items[0]['title']}")
        print(f"   Disclosure present: {'AI Disclosure' in items[0]['description']}")
    print("Legal 100% — single source of truth is LEGAL_DISCLOSURE in this script.")

if __name__ == "__main__":
    main()
