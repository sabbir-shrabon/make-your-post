import os
import sys
import base64

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.services.poster_component_renderer import render_archetype_poster

def test_all_archetypes():
    print("Testing Canva-Grade Archetype Rendering...")
    test_cases = [
        ("social-card", "5 HABITS OF HIGH-PERFORMING FOUNDERS", "Small daily optimizations that compound into 10x output over 12 months.", "PRO TIP", None, None),
        ("editorial-hero", "THE FUTURE OF AGENTIC AI IN 2026", "How autonomous workflows are replacing manual operations.", "FEATURED", None, None),
        ("metric-callout", "FASTER WORKFLOW EXECUTION", "Measured across 10,000 automated campaign runs.", "KEY BENCHMARK", "+4.5X", None),
        ("checklist-framework", "FOUNDER MORNING ROUTINE", None, "ACTION PLAN", None, [
            "1. 500ml Water + Electrolytes",
            "2. 90-Minute Deep Work Block",
            "3. Daily 3 Priority Goals",
            "4. Zero Notifications Till 10 AM"
        ]),
        ("promo-banner", "FLASH SALE 50% OFF ALL PLANS", "Upgrade before midnight to lock in lifetime founder pricing.", "LIMITED TIME", None, None),
        ("minimal-quote", "Simplicity is the prerequisite for reliability.", None, None, None, None),
    ]

    out_dir = os.path.join(os.path.dirname(__file__), "backend", "scratch")
    os.makedirs(out_dir, exist_ok=True)

    for arch, headline, sub, badge, stat, items in test_cases:
        b64_str, img = render_archetype_poster(
            archetype_id=arch,
            headline=headline,
            subheadline=sub,
            badge_text=badge,
            stat_number=stat,
            items=items,
            brand_name="AutoPoster AI",
            handle="@autoposter",
            image_url="https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800"
        )
        out_path = os.path.join(out_dir, f"test_{arch}.png")
        raw = base64.b64decode(b64_str.split(",", 1)[1])
        with open(out_path, "wb") as f:
            f.write(raw)
        print(f"[OK] Rendered {arch} -> {out_path} ({len(raw)} bytes)")

    print("All 6 archetypes rendered successfully!")

if __name__ == "__main__":
    test_all_archetypes()
