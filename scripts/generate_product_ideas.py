#!/usr/bin/env python3
"""
ClarityForge Digital - Product Idea & Prompt Generator
A simple, fast script to generate dozens of new product ideas, image prompts, and listing concepts.

Usage:
  python generate_product_ideas.py --niche adhd --count 20
  python generate_product_ideas.py --niche menopause --count 10
  python generate_product_ideas.py --all --count 50

This is pure leverage. Run it whenever you need fresh ideas in seconds.
"""

import argparse
import json
import random
from datetime import datetime

# Core niches and angles
NICHES = {
    "adhd": {
        "name": "ADHD / Neurodivergent",
        "keywords": ["adhd", "neurodivergent", "executive function", "dopamine", "focus", "emotional regulation", "rejection sensitive", "audhd"],
        "product_types": ["planner", "tracker", "menu", "journal", "kit", "challenge", "guide", "system", "printable pack"],
        "angles": [
            "emotional regulation", "task initiation", "working memory support", "time blindness", "hyperfocus management",
            "rejection sensitivity", "burnout recovery", "dopamine menu", "body doubling alternatives", "interest-based motivation"
        ]
    },
    "menopause": {
        "name": "Perimenopause / Menopause",
        "keywords": ["perimenopause", "menopause", "hormones", "midlife", "hot flashes", "mood", "sleep", "brain fog"],
        "product_types": ["tracker", "journal", "symptom log", "wellness guide", "reflection prompts", "monthly overview"],
        "angles": [
            "symptom tracking", "sleep optimization", "mood awareness", "doctor visit prep", "lifestyle experiments",
            "nervous system support", "identity shifts", "energy management", "relationship navigation"
        ]
    },
    "solopreneur": {
        "name": "Solopreneur / Creator",
        "keywords": ["solopreneur", "freelancer", "content creator", "small business", "money", "client management"],
        "product_types": ["tracker", "planner", "financial system", "content calendar", "client kit", "invoice pack"],
        "angles": [
            "income tracking", "expense categorization", "client pipeline", "content batching", "pricing calculator",
            "energy management for business", "quarterly planning", "tax prep made simple"
        ]
    }
}

WALL_ART_THEMES = [
    "Calm & Focus", "Neurodivergent Pride", "Gentle Strength", "Rest & Restore", "Creative Flow",
    "Grounded Presence", "Quiet Joy", "Embodied Self", "Morning Light", "Evening Wind Down"
]

def generate_image_prompt(niche, product_type, angle, style="minimalist"):
    """Generate a high-quality, specific image generation prompt."""
    niche_data = NICHES.get(niche, NICHES["adhd"])
    
    base_styles = {
        "minimalist": "clean minimalist design, generous white space, soft sage green and warm beige palette, modern sans typography, subtle botanical or abstract line elements, premium digital product aesthetic",
        "elegant": "sophisticated elegant design, soft lavender and sage tones, delicate line art, empowering and calm, high-end wellness aesthetic",
        "abstract": "abstract minimalist wall art style, soft organic shapes, gentle gradients in earthy sage, warm taupe and cream, therapeutic calm aesthetic"
    }
    
    style_desc = base_styles.get(style, base_styles["minimalist"])
    
    if niche == "wall_art":
        return f"Premium minimalist abstract printable wall art for {angle.lower()}, {style_desc}, no text or minimal elegant typography, high resolution, print-ready, cohesive collection feel --ar 4:3 or 2:3"
    
    return f"Elegant premium cover or key visual for a {niche_data['name']} {product_type} about {angle}, {style_desc}, high quality digital product style, square or portrait orientation suitable for Etsy"

def generate_product_idea(niche_key, used_angles=None):
    """Generate one complete product idea."""
    if used_angles is None:
        used_angles = []
    
    niche = NICHES[niche_key]
    angle = random.choice([a for a in niche["angles"] if a not in used_angles] or niche["angles"])
    ptype = random.choice(niche["product_types"])
    
    title_idea = f"{niche['name']} {angle.title()} {ptype.title()}"
    
    return {
        "niche": niche["name"],
        "angle": angle,
        "product_type": ptype,
        "working_title": title_idea,
        "suggested_price_range": "$9-14" if ptype in ["tracker", "journal"] else "$12-19",
        "image_prompt_example": generate_image_prompt(niche_key, ptype, angle),
        "why_it_could_sell": f"High emotional need in {niche['name']} audience. Specific angle reduces competition. Easy to bundle.",
        "bundle_potential": "High — pairs well with existing planners/trackers in the same niche."
    }

def main():
    parser = argparse.ArgumentParser(description="Generate product ideas and prompts for ClarityForge Digital")
    parser.add_argument("--niche", choices=["adhd", "menopause", "solopreneur"], help="Specific niche")
    parser.add_argument("--all", action="store_true", help="Generate across all niches")
    parser.add_argument("--count", type=int, default=10, help="How many ideas to generate")
    parser.add_argument("--wall-art", action="store_true", help="Include wall art ideas")
    parser.add_argument("--output", default="product_ideas.json", help="Output filename")
    args = parser.parse_args()

    ideas = []
    used = []

    niches_to_use = [args.niche] if args.niche else list(NICHES.keys())
    
    for _ in range(args.count):
        niche_key = random.choice(niches_to_use)
        idea = generate_product_idea(niche_key, used)
        ideas.append(idea)
        used.append(idea["angle"])
    
    if args.wall_art:
        for theme in random.sample(WALL_ART_THEMES, min(5, len(WALL_ART_THEMES))):
            ideas.append({
                "niche": "Wall Art / Decor",
                "angle": theme,
                "product_type": "printable collection",
                "working_title": f'"{theme}" Minimalist Printable Wall Art Collection (8 designs)',
                "suggested_price_range": "$9-12",
                "image_prompt_example": generate_image_prompt("wall_art", "collection", theme, "abstract"),
                "why_it_could_sell": "Fast to produce, high perceived value, excellent Pinterest performance, cross-sells with everything.",
                "bundle_potential": "Bundle 2-3 collections or with planners."
            })

    output_data = {
        "generated_at": datetime.now().isoformat(),
        "total_ideas": len(ideas),
        "ideas": ideas
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(ideas)} product ideas -> {args.output}")
    print("\nQuick Preview (first 3):\n")
    for i, idea in enumerate(ideas[:3], 1):
        print(f"{i}. {idea['working_title']}")
        print(f"   Price: {idea['suggested_price_range']} | Niche: {idea['niche']}")
        print(f"   Prompt: {idea['image_prompt_example'][:120]}...")
        print()

if __name__ == "__main__":
    main()